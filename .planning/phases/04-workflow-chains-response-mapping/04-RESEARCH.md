# Phase 4: Workflow Chains & Response Mapping - Research

**Researched:** 2026-06-06
**Domain:** Chain orchestration, JSONata path expressions, IPC progress streaming, Monaco decorations, reference resolution
**Confidence:** HIGH

## Summary

Phase 4 delivers ordered multi-step request chains where later steps reference earlier responses using `{{stepN.response.body.path}}` syntax with JSONata 1.8.x path expressions. The chain orchestrator lives entirely in the main process (no JVM helper involvement for v1), executing steps sequentially via the existing `sendRequest` function from `undiciClient.ts`. Progress streams from main→renderer via `webContents.send` (same pattern as `helper:status`). Chain definitions store as a typed `chains` extension on the Postman v2.1 collection JSON, replacing the current `z.array(z.unknown()).default([])` placeholder.

The key architectural insight is that chains are **self-contained request specs** — each step holds its own inline `RequestSpec` (method, URL, headers, body, auth, settings), not a reference to a saved request. The orchestrator resolves `{{stepN.response.body.path}}` references at run-time by parsing the template string, evaluating JSONata expressions against prior step results, and substituting before sending. Circular references are detected via DFS before execution starts.

**Primary recommendation:** Build the chain model and orchestrator first (plan 04-01), then layer reference resolution (04-02), then the mapping editor UI (04-03). Each plan is independently testable.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Chain CRUD (create/read/update/delete) | Main Process (storage) | Renderer (UI triggers) | Chain data persists in collection JSON via main-process atomic writes |
| Chain execution orchestration | Main Process | — | Sequential HTTP requests via undici; must not run in renderer (CORS, abort control) |
| Reference resolution (`{{stepN...}}`) | Main Process | — | Resolution happens at run-time before sending; requires access to prior step results |
| JSONata path evaluation | Main Process | Renderer (preview only) | Run-time resolution in main; preview resolution can happen in renderer with cached results |
| Progress streaming (step N of M) | Main Process → Renderer | — | `webContents.send` pattern established by helper:status |
| Chain definition UI (step sequence, data panel) | Renderer | — | React components for visual chain editor |
| Monaco reference highlighting | Renderer | — | `deltaDecorations` API for purple highlight on `{{stepN...}}` patterns |
| Circular reference detection | Main Process | — | Validation runs before execution; graph algorithm on step dependency DAG |
| Step result persistence | Main Process (storage) | — | Atomic writes alongside chain definition in collection JSON |

## Standard Stack

### Core (Phase 4 additions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jsonata | 1.8.7 | Path expressions for `{{stepN.response.body.path}}` | STACK.md specifies 1.8.x; mature JS port, ~30 KB; 2.x has breaking API changes |
| @monaco-editor/react | 4.7.0 | Body editor with reference highlighting | Already integrated in Phase 1; `deltaDecorations` for chain ref highlights |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 4.0.1 | Chain/step/mapping schema validation | IPC payloads, collection schema extension |
| zustand | 5.0.12 | Chain execution state (running step, progress, results) | Renderer local state |
| @tanstack/react-query | 5.90.3 | Chain definitions read from collection | Server state caching |
| undici | 7.27.0 | HTTP requests per chain step | Main process, via existing `sendRequest` |
| electron-log | 5.4.4 | Chain execution logging | Main process |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jsonata 1.8.7 | jsonata 2.x | 2.x has breaking API changes (`evaluate` signature changed); 1.8.x is battle-tested |
| jsonata | JSONPath (`jsonpath-plus`) | JSONPath lacks transformation functions; JSONata is purpose-built for this |
| jsonata | Custom regex parser | Reinventing the wheel; JSONata handles nested arrays, filters, functions |
| Monaco `deltaDecorations` | Custom overlay div | Monaco decorations are first-class; custom overlays fight Monaco's layout engine |

**Installation:**
```bash
npm install jsonata@1.8.7
```

**Version verification:**
```bash
npm view jsonata@1.8.7 version  # Confirmed: 1.8.7 exists on npm registry
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| jsonata | npm | 8+ years | ~500K/wk | github.com/jsonata-js/jsonata | [OK] | Approved |
| @monaco-editor/react | npm | 5+ years | ~1M/wk | github.com/suren-atoyan/monaco-react | [OK] | Already installed |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*jsonata is a well-established library (first release 2017, maintained by IBM-affiliated contributors). The 1.8.x line is the stable branch; 2.x is a newer major with breaking changes. Pin to 1.8.7.*

## Architecture Patterns

### Chain Data Model

```
Collection (Postman v2.1)
├── info, item[], variable[], auth, event
└── chains: Chain[]
    ├── id: string (UUID)
    ├── name: string
    ├── steps: ChainStep[]
    │   ├── stepIndex: number (1-based)
    │   ├── name: string (display-only)
    │   ├── request: RequestSpec (inline, self-contained)
    │   ├── timeoutMs: number (default 30000)
    │   ├── retryCount: number (default 0, max 5)
    │   ├── retryDelayMs: number (default 1000)
    │   └── lastResult?: StepResult (persisted)
    └── createdAt: number
```

### Chain Orchestrator Flow

```
Renderer                    Main Process                    undici
   │                            │                              │
   ├──invoke('chains:run')─────►│                              │
   │                            ├──validateChain()             │
   │                            │  (URLs, refs, circular)      │
   │                            │                              │
   │◄─webContents.send('chains:progress')──│                   │
   │                            │                              │
   │                            ├──for each step:              │
   │                            │  resolveReferences()         │
   │                            │  ├──sendRequest()───────────►│
   │                            │  ◄───────────────────────────│
   │◄─webContents.send('chains:stepResult')─│                  │
   │                            │  persistStepResult()         │
   │                            │                              │
   │◄─webContents.send('chains:complete')───│                  │
```

### Reference Resolution Pattern

```typescript
// Template: "Bearer {{step1.response.body.token}}"
// Regex: /\{\{step(\d+)\.response\.(body|headers|status)(.*?)\}\}/g

// 1. Parse template into segments
// 2. For each {{stepN.response.X.path}}:
//    a. Look up step N's lastResult
//    b. Extract the X portion (body/headers/status)
//    c. Evaluate JSONata path against the extracted data
//    d. Substitute string value (or empty + warning if unresolved)
// 3. Return resolved string + warnings[]
```

### Circular Reference Detection

```
1. Build adjacency list: step[i] → set of step[j] it references
2. DFS with three states: WHITE (unvisited), GRAY (in-progress), BLACK (done)
3. If DFS encounters a GRAY node → cycle detected
4. Report cycle path: stepA → stepB → ... → stepA
```

### Recommended Project Structure

```
src/
├── main/
│   ├── chains/
│   │   ├── orchestrator.ts      # Chain execution engine
│   │   ├── resolver.ts          # {{stepN.response.body.path}} resolution
│   │   ├── validator.ts         # Pre-run validation (URLs, refs, circular)
│   │   └── schemas.ts           # ChainStepSchema, ChainMappingSchema, etc.
│   ├── ipc/
│   │   ├── channels.ts          # Add chain IPC schemas
│   │   └── router.ts            # Add chain handlers
│   └── storage/
│       └── collections.ts       # Extend with chain CRUD
├── renderer/
│   ├── components/
│   │   └── Chain/
│   │       ├── ChainEditor.tsx
│   │       ├── ChainHeader.tsx
│   │       ├── StepSequence.tsx
│   │       ├── StepCard.tsx
│   │       ├── ChainRequestBuilder.tsx
│   │       ├── ChainDataPanel.tsx
│   │       ├── ChainStepColumn.tsx
│   │       ├── PreviewResolvedModal.tsx
│   │       ├── ChainValidationBanner.tsx
│   │       ├── UnresolvedRefWarning.tsx
│   │       └── ChainSidebarItem.tsx
│   └── state/
│       └── useChain.ts          # Chain execution state (Zustand)
└── shared/
    └── schemas/
        └── collection.ts        # Replace z.unknown() with ChainSchema
```

### Pattern 1: IPC Progress Streaming

**What:** Stream chain execution progress from main to renderer using `webContents.send`
**When to use:** Any long-running main-process operation that needs real-time UI updates
**Why:** The pattern is already established by `helper:status` events in `src/main/index.ts`

```typescript
// Main process (orchestrator.ts)
// Source: existing pattern in src/main/index.ts:31
function emitProgress(mainWindow: BrowserWindow, chainId: string, stepIndex: number, totalSteps: number, status: string) {
  mainWindow.webContents.send('chains:progress', {
    chainId,
    stepIndex,
    totalSteps,
    status, // 'running' | 'completed' | 'failed' | 'stopped'
  });
}

// Preload (index.ts) — add to chains namespace
chains: {
  onProgress: (cb: (event: any) => void) => {
    const listener = (_: any, data: any) => cb(data);
    ipcRenderer.on('chains:progress', listener);
    return () => ipcRenderer.off('chains:progress', listener);
  },
  onStepResult: (cb: (event: any) => void) => {
    const listener = (_: any, data: any) => cb(data);
    ipcRenderer.on('chains:stepResult', listener);
    return () => ipcRenderer.off('chains:stepResult', listener);
  },
}

// Renderer (useChain.ts)
// Subscribe to progress events
window.api.chains.onProgress((data) => {
  useChain.getState().updateProgress(data);
});
```

### Pattern 2: Chain Schema Design

**What:** Zod schemas for chain, step, and mapping that extend the collection schema
**When to use:** Defining the chain data model
**Why:** Follows existing schema pattern in `src/shared/schemas/collection.ts`

```typescript
// Source: extends src/shared/schemas/collection.ts
import { z } from 'zod';
import { RequestSpecSchema } from './collection.js';

export const ChainStepSchema = z.object({
  stepIndex: z.number().int().min(1),
  name: z.string().default(''),
  request: RequestSpecSchema,
  timeoutMs: z.number().int().min(1000).max(600_000).default(30_000),
  retryCount: z.number().int().min(0).max(5).default(0),
  retryDelayMs: z.number().int().min(0).max(30_000).default(1000),
  lastResult: z.object({
    status: z.number(),
    statusText: z.string(),
    headers: z.array(z.object({ key: z.string(), value: z.string() })),
    bodyJson: z.string(), // JSON string, capped at 1MB
    bodyTruncated: z.boolean(),
    timing: z.object({ total: z.number() }),
    completedAt: z.number(),
    unresolvedRefs: z.array(z.string()).default([]),
    retryAttempts: z.number().default(0),
  }).optional(),
}).passthrough();

export const ChainSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  steps: z.array(ChainStepSchema),
  createdAt: z.number(),
}).passthrough();

export type ChainStep = z.infer<typeof ChainStepSchema>;
export type Chain = z.infer<typeof ChainSchema>;
```

### Pattern 3: Monaco Reference Highlighting

**What:** Purple highlight on `{{stepN.response.body.path}}` expressions in the body editor
**When to use:** When rendering Monaco editor for chain step body/URL/headers
**Why:** D-12/D-13 specify purple highlight to distinguish chain refs from env vars

```typescript
// Source: Monaco deltaDecorations API
// Regex: /\{\{step\d+\.response\.(body|headers|status)[^}]*\}\}/g

function applyChainRefDecorations(editor: any, model: any) {
  const text = model.getValue();
  const regex = /\{\{step\d+\.response\.(?:body|headers|status)[^}]*\}\}/g;
  const decorations: any[] = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    const start = model.getPositionAt(match.index);
    const end = model.getPositionAt(match.index + match[0].length);
    decorations.push({
      range: {
        startLineNumber: start.lineNumber,
        startColumn: start.column,
        endLineNumber: end.lineNumber,
        endColumn: end.column,
      },
      options: {
        inlineClassName: 'chain-ref-highlight',
        hover: { value: `Chain reference: ${match[0]}` },
      },
    });
  }

  editor.deltaDecorations([], decorations);
}

// CSS (in theme-dark.css or tokens.css)
// .chain-ref-highlight {
//   background: rgba(156, 60, 224, 0.2);
//   color: #9c3ce0;
//   font-weight: 600;
//   padding: 1px 4px;
//   border-radius: 2px;
// }
```

### Pattern 4: Response Tree with Copy-Path Buttons

**What:** Expandable JSON tree for browsing prior step responses with click-to-copy reference paths
**When to use:** Bottom data panel (ChainDataPanel component)
**Why:** The existing ResponseBodyTab uses Monaco read-only for full response viewing, but the data panel needs a lightweight tree with per-field "Copy path" buttons

```typescript
// New component: ChainStepColumn.tsx
// Reuses the JSON parsing logic from ResponseBodyTab but renders as a tree
// Each leaf node gets a "Copy path" button that copies {{stepN.response.body.path}}

interface ChainStepColumnProps {
  stepIndex: number;
  result: StepResult; // from chain orchestrator
  onCopyPath: (pathExpression: string) => void;
}

// Tree node structure
interface TreeNode {
  key: string;
  value: unknown;
  path: string; // JSONata path (e.g., "items[0].id")
  depth: number;
  isExpandable: boolean;
}
```

### Anti-Patterns to Avoid

- **Storing resolved values in the chain definition:** The template with `{{stepN...}}` is the source of truth. Resolved values are ephemeral (from last run). Never persist resolved values as the definition.
- **Renderer-side HTTP for chain steps:** All HTTP goes through main process (CORS avoidance, per ARCHITECTURE.md §2). The renderer never calls `fetch` directly.
- **Parallel step execution:** D-01 specifies sequential execution. Parallel execution introduces race conditions for reference resolution and complicates the UI progress model.
- **Caching responses between chain runs:** D-04 specifies always-fresh. Each chain run re-executes all steps from 1 to N.
- **Using JSONata 2.x:** The 2.x line has breaking API changes (`evaluate` returns a Promise in 2.x vs synchronous in 1.8.x). Pin to 1.8.7.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON path expressions | Custom regex parser | jsonata 1.8.7 | Handles nested arrays, filters, functions; ~30 KB; battle-tested |
| Chain validation | Ad-hoc checks | Zod schemas + explicit validator module | Type-safe, composable, follows existing pattern |
| Progress streaming | Custom WebSocket or polling | `webContents.send` | Electron-native, already used for helper:status |
| Reference syntax parsing | String.indexOf loops | Regex `/\{\{step(\d+)\.response\.(body\|headers\|status)(.*?)\}\}/g` | Clean, testable, handles edge cases |
| Circular reference detection | Manual tracking | DFS with WHITE/GRAY/BLACK states | Standard algorithm, O(V+E), handles all cycle patterns |
| JSON tree component | Custom recursive divs | New `JsonTree` component with expand/collapse | Reusable across data panel and response viewer |

## Common Pitfalls

### Pitfall 1: JSONata 1.8.x Synchronous vs 2.x Async
**What goes wrong:** Using `jsonata(expr).evaluate(data)` assumes synchronous return. In JSONata 2.x, `evaluate` returns a Promise. If the wrong version is installed, code silently gets a Promise object instead of the resolved value.
**Why it happens:** npm installs latest by default; jsonata 2.x is the latest.
**How to avoid:** Pin `jsonata@1.8.7` in package.json. Verify with `npm ls jsonata` after install.
**Warning signs:** Reference resolution returns `[object Promise]` strings instead of actual values.

### Pitfall 2: Step Index Off-By-One in References
**What goes wrong:** `{{step1.response.body.id}}` refers to step 1 (1-based), but array indexing is 0-based. Mismatch causes references to point to the wrong step.
**Why it happens:** Steps are stored as an array (0-indexed) but displayed/referenced as 1-indexed.
**How to avoid:** Always use `stepIndex` (1-based) for user-facing references. Convert to array index via `stepIndex - 1` only at the storage/access layer.
**Warning signs:** References resolve to the wrong step's data, or fail with "step not found".

### Pitfall 3: Large Response Body Memory Pressure
**What goes wrong:** Chain with 10 steps, each returning 1MB body = 10MB held in memory for reference resolution. Plus the orchestrator holds all results for the duration of the run.
**Why it happens:** All step results must be available for reference resolution of later steps.
**How to avoid:** Cap response bodies at 1MB (already done in undiciClient.ts). Store step results as JSON strings (not parsed objects) — parse only when resolving references. Cap total chain result persistence at 10MB per chain.
**Warning signs:** Electron main process memory spikes during long chain runs.

### Pitfall 4: Reference Resolution Order Dependencies
**What goes wrong:** Step 3 references `{{step1.response.body.id}}` but step 1 hasn't run yet (chain starts from step 3 in a re-run scenario).
**Why it happens:** When re-running from step N, steps 1..N-1 must have persisted results available for reference resolution.
**How to avoid:** D-04 (revised): re-run from step N uses cached results for steps 1..N-1. The orchestrator loads persisted `lastResult` for earlier steps before executing from step N onward. If no persisted result exists for a referenced step, produce empty string + warning.
**Warning signs:** References resolve to empty strings unexpectedly when re-running from mid-chain.

### Pitfall 5: Monaco Decorations Lost on Model Change
**What goes wrong:** User edits the body, decorations disappear because the model content changed and decorations aren't re-applied.
**Why it happens:** Monaco decorations are range-based. When content changes, ranges shift but old decoration IDs become stale.
**How to avoid:** Re-apply decorations on every `model.onDidChangeContent` event (debounced at 150ms). Store decoration IDs and call `editor.deltaDecorations(oldIds, newDecorations)`.
**Warning signs:** Purple highlights flicker or disappear while typing.

### Pitfall 6: Chain Definition Bloat from Step Results
**What goes wrong:** Chain with 20 steps, each with 1MB response body = 20MB collection.json. Loading the collection becomes slow.
**Why it happens:** Step results are stored inline with the chain definition in the collection JSON.
**How to avoid:** Store step results in a separate file: `collections/<id>/chains/<chainId>/results.json`. Keep only the chain definition (steps + request specs) in the collection JSON. The results file is loaded on-demand when opening a chain.
**Warning signs:** Collection list API (`collections:list`) becomes slow because it reads the full collection JSON.

### Pitfall 7: Abort During Mid-Request
**What goes wrong:** User clicks "Stop" while a step's HTTP request is in-flight. The AbortController aborts the request, but the orchestrator doesn't properly handle the abort signal.
**Why it happens:** `sendRequest` catches abort errors and returns a structured error response. The orchestrator must check for this specific case.
**How to avoid:** After each step, check if the abort was user-initiated (D-21: stop after current step completes). If the request was aborted mid-flight, mark the step as "stopped" and halt the chain.
**Warning signs:** Chain continues to the next step after user clicks Stop.

## Code Examples

### Chain Orchestrator Core Loop

```typescript
// Source: main/chains/orchestrator.ts
// Follows pattern from src/main/ipc/router.ts (request:send handler)

import { sendRequest } from '../http/undiciClient.js';
import { resolveReferences } from './resolver.js';
import { validateChain } from './validator.js';
import type { Chain, ChainStep } from '../../shared/schemas/collection.js';
import type { ResponseResult } from '../ipc/channels.js';

interface ChainRunResult {
  chainId: string;
  status: 'completed' | 'failed' | 'stopped';
  steps: StepRunResult[];
}

interface StepRunResult {
  stepIndex: number;
  status: 'success' | 'failed' | 'stopped' | 'skipped';
  response?: ResponseResult;
  error?: string;
  unresolvedRefs: string[];
  retryAttempts: number;
}

export async function runChain(
  chain: Chain,
  mainWindow: BrowserWindow,
  abortSignal: AbortSignal
): Promise<ChainRunResult> {
  // 1. Validate before running (D-22)
  const validation = validateChain(chain);
  if (!validation.valid) {
    mainWindow.webContents.send('chains:validationFailed', {
      chainId: chain.id,
      issues: validation.issues,
    });
    return { chainId: chain.id, status: 'failed', steps: [] };
  }

  const stepResults: StepRunResult[] = [];
  const totalSteps = chain.steps.length;

  // 2. Execute steps sequentially (D-01)
  for (let i = 0; i < chain.steps.length; i++) {
    const step = chain.steps[i];

    // Check abort signal (D-21: stop after current step)
    if (abortSignal.aborted) {
      stepResults.push({
        stepIndex: step.stepIndex,
        status: 'stopped',
        unresolvedRefs: [],
        retryAttempts: 0,
      });
      break;
    }

    // Emit progress
    mainWindow.webContents.send('chains:progress', {
      chainId: chain.id,
      stepIndex: step.stepIndex,
      totalSteps,
      status: 'running',
    });

    // 3. Resolve references (D-13: resolve at run-time)
    const resolved = resolveReferences(step.request, stepResults);

    // 4. Execute with retry (D-02, D-23)
    let lastResult: ResponseResult | null = null;
    let attempts = 0;
    const maxAttempts = 1 + step.retryCount;

    while (attempts < maxAttempts) {
      if (abortSignal.aborted && attempts > 0) break;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), step.timeoutMs);

      try {
        lastResult = await sendRequest(resolved.request, controller.signal);
        clearTimeout(timeout);

        // Check if request was successful (2xx)
        if (lastResult.status >= 200 && lastResult.status < 300) {
          break; // Success, no more retries
        }

        // Non-2xx: retry if retries remaining
        attempts++;
        if (attempts < maxAttempts) {
          mainWindow.webContents.send('chains:progress', {
            chainId: chain.id,
            stepIndex: step.stepIndex,
            totalSteps,
            status: 'retrying',
            attempt: attempts,
            maxAttempts: step.retryCount,
          });
          await delay(step.retryDelayMs);
        }
      } catch (err) {
        clearTimeout(timeout);
        attempts++;
        if (attempts < maxAttempts) {
          await delay(step.retryDelayMs);
        }
      }
    }

    // 5. Build step result
    const stepResult: StepRunResult = {
      stepIndex: step.stepIndex,
      status: lastResult && lastResult.status >= 200 && lastResult.status < 300
        ? 'success' : 'failed',
      response: lastResult ?? undefined,
      unresolvedRefs: resolved.warnings.map(w => w.reference),
      retryAttempts: attempts - 1,
    };

    stepResults.push(stepResult);

    // Emit step completion
    mainWindow.webContents.send('chains:stepResult', {
      chainId: chain.id,
      stepIndex: step.stepIndex,
      result: stepResult,
    });

    // 6. Halt chain on failure (D-03)
    if (stepResult.status === 'failed') {
      // Mark remaining steps as skipped
      for (let j = i + 1; j < chain.steps.length; j++) {
        stepResults.push({
          stepIndex: chain.steps[j].stepIndex,
          status: 'skipped',
          unresolvedRefs: [],
          retryAttempts: 0,
        });
      }
      break;
    }
  }

  // 7. Determine overall status
  const overallStatus = stepResults.some(s => s.status === 'failed') ? 'failed'
    : stepResults.some(s => s.status === 'stopped') ? 'stopped'
    : 'completed';

  mainWindow.webContents.send('chains:complete', {
    chainId: chain.id,
    status: overallStatus,
  });

  return { chainId: chain.id, status: overallStatus, steps: stepResults };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Reference Resolver

```typescript
// Source: main/chains/resolver.ts

import jsonata from 'jsonata';
import type { RequestSpec } from '../ipc/channels.js';
import type { StepRunResult } from './orchestrator.js';

interface ResolvedRequest {
  request: RequestSpec;
  warnings: Array<{ reference: string; reason: string }>;
}

const REF_REGEX = /\{\{step(\d+)\.response\.(body|headers|status)(.*?)\}\}/g;

export function resolveReferences(
  spec: RequestSpec,
  priorResults: StepRunResult[]
): ResolvedRequest {
  const warnings: Array<{ reference: string; reason: string }> = [];

  function resolveString(template: string): string {
    return template.replace(REF_REGEX, (match, stepNum, source, path) => {
      const stepIndex = parseInt(stepNum, 10);
      const result = priorResults.find(r => r.stepIndex === stepIndex);

      if (!result || !result.response) {
        warnings.push({ reference: match, reason: `Step ${stepNum} has not run` });
        return '';
      }

      try {
        let data: unknown;

        if (source === 'body') {
          // Decode base64 body to JSON
          const bodyStr = Buffer.from(result.response.bodyBase64, 'base64').toString('utf-8');
          data = JSON.parse(bodyStr);
        } else if (source === 'headers') {
          // Convert headers array to object
          data = Object.fromEntries(
            result.response.headers.map(h => [h.key, h.value])
          );
        } else if (source === 'status') {
          return String(result.response.status);
        }

        // Evaluate JSONata path
        // Note: jsonata 1.8.x evaluate() is synchronous
        const jsonataPath = path.startsWith('.') ? path.slice(1) : path;
        if (!jsonataPath) {
          // Just {{stepN.response.body}} — return the whole body
          return typeof data === 'string' ? data : JSON.stringify(data);
        }

        const expr = jsonata(jsonataPath);
        const value = expr.evaluate(data);

        if (value === undefined || value === null) {
          warnings.push({ reference: match, reason: `Path not found: ${jsonataPath}` });
          return '';
        }

        return typeof value === 'object' ? JSON.stringify(value) : String(value);
      } catch (err) {
        warnings.push({
          reference: match,
          reason: `JSONata error: ${err instanceof Error ? err.message : 'Unknown error'}`
        });
        return '';
      }
    });
  }

  // Resolve references in URL, headers, and body
  const resolvedUrl = resolveString(spec.url);
  const resolvedHeaders = spec.headers.map(h => ({
    ...h,
    value: resolveString(h.value),
  }));

  let resolvedBody = spec.body;
  if (spec.body.mode === 'raw') {
    resolvedBody = { ...spec.body, text: resolveString(spec.body.text) };
  }

  return {
    request: {
      ...spec,
      url: resolvedUrl,
      headers: resolvedHeaders,
      body: resolvedBody,
    },
    warnings,
  };
}
```

### Circular Reference Detector

```typescript
// Source: main/chains/validator.ts

interface ValidationIssue {
  type: 'empty-url' | 'invalid-ref' | 'circular-ref' | 'invalid-step';
  message: string;
  stepIndex?: number;
  path?: string;
}

export function detectCircularReferences(steps: Array<{ stepIndex: number; request: RequestSpec }>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const refRegex = /\{\{step(\d+)\.response\./g;

  // Build adjacency list
  const adjacency = new Map<number, Set<number>>();
  for (const step of steps) {
    adjacency.set(step.stepIndex, new Set());
    const text = JSON.stringify(step.request);
    let match;
    while ((match = refRegex.exec(text)) !== null) {
      const targetStep = parseInt(match[1], 10);
      if (targetStep !== step.stepIndex) {
        adjacency.get(step.stepIndex)!.add(targetStep);
      }
    }
    refRegex.lastIndex = 0;
  }

  // DFS with WHITE/GRAY/BLACK states
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<number, number>();
  const parent = new Map<number, number>();

  for (const step of steps) {
    color.set(step.stepIndex, WHITE);
  }

  function dfs(u: number): boolean {
    color.set(u, GRAY);
    const neighbors = adjacency.get(u) ?? new Set();

    for (const v of neighbors) {
      if (color.get(v) === GRAY) {
        // Cycle found — reconstruct path
        const cyclePath = reconstructCycle(u, v, parent);
        issues.push({
          type: 'circular-ref',
          message: `Circular reference detected: ${cyclePath}`,
          stepIndex: u,
        });
        return true;
      }
      if (color.get(v) === WHITE) {
        parent.set(v, u);
        if (dfs(v)) return true;
      }
    }

    color.set(u, BLACK);
    return false;
  }

  for (const step of steps) {
    if (color.get(step.stepIndex) === WHITE) {
      dfs(step.stepIndex);
    }
  }

  return issues;
}

function reconstructCycle(from: number, to: number, parent: Map<number, number>): string {
  const path: number[] = [to];
  let current = from;
  while (current !== to) {
    path.unshift(current);
    current = parent.get(current)!;
  }
  path.unshift(to);
  return path.map(i => `step${i}`).join(' → ');
}
```

### IPC Channel Schemas

```typescript
// Source: extends src/main/ipc/channels.ts

// --- 04-01: Chain CRUD schemas ---
export const ChainCreateArgsSchema = z.object({
  collectionId: z.string().uuid(),
  name: z.string().min(1).max(200).default('New Chain'),
});
export const ChainCreateResultSchema = z.object({
  chainId: z.string().uuid(),
});

export const ChainUpdateArgsSchema = z.object({
  collectionId: z.string().uuid(),
  chainId: z.string().uuid(),
  chain: z.any(), // Validated by ChainSchema in the handler
});

export const ChainDeleteArgsSchema = z.object({
  collectionId: z.string().uuid(),
  chainId: z.string().uuid(),
});

// --- 04-01: Chain execution schemas ---
export const ChainRunArgsSchema = z.object({
  collectionId: z.string().uuid(),
  chainId: z.string().uuid(),
});
export const ChainRunResultSchema = z.object({
  chainId: z.string().uuid(),
  status: z.enum(['completed', 'failed', 'stopped']),
  steps: z.array(z.object({
    stepIndex: z.number(),
    status: z.enum(['success', 'failed', 'stopped', 'skipped']),
    response: z.any().optional(),
    error: z.string().optional(),
    unresolvedRefs: z.array(z.string()),
    retryAttempts: z.number(),
  })),
});

export const ChainStopArgsSchema = z.object({
  chainId: z.string().uuid(),
});

// --- 04-02: Chain validation schema ---
export const ChainValidateArgsSchema = z.object({
  collectionId: z.string().uuid(),
  chainId: z.string().uuid(),
});
export const ChainValidateResultSchema = z.object({
  valid: z.boolean(),
  issues: z.array(z.object({
    type: z.string(),
    message: z.string(),
    stepIndex: z.number().optional(),
  })),
});

// --- 04-03: Preview resolved schema ---
export const ChainPreviewResolvedArgsSchema = z.object({
  collectionId: z.string().uuid(),
  chainId: z.string().uuid(),
  stepIndex: z.number().int().min(1),
});
export const ChainPreviewResolvedResultSchema = z.object({
  resolvedUrl: z.string(),
  resolvedHeaders: z.array(z.object({ key: z.string(), value: z.string() })),
  resolvedBody: z.string(),
  warnings: z.array(z.object({
    reference: z.string(),
    reason: z.string(),
  })),
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `chains: z.array(z.unknown()).default([])` | Typed `ChainSchema` with `ChainStepSchema` | Phase 4 | Full type safety for chain data |
| No chain execution | Main-process orchestrator with sequential undici calls | Phase 4 | Chains run entirely in main process |
| No reference resolution | `{{stepN.response.body.path}}` with JSONata 1.8.x | Phase 4 | Later steps can pull data from earlier responses |
| Response viewer as Monaco read-only | New JsonTree component for data panel | Phase 4 | Lightweight tree with per-field copy-path buttons |

**Deprecated/outdated:**
- The `z.unknown()` chain placeholder in collection.ts — replaced by typed ChainSchema
- The sketch's `$stepN.response.body.field` syntax — revised to `{{stepN.response.body.path}}` for consistency with existing `{{variable}}` pattern

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | jsonata 1.8.7 `evaluate()` is synchronous (not Promise-based) | Reference Resolver | If async, resolver code must use `await`; breaks the clean synchronous substitution pattern |
| A2 | Monaco `deltaDecorations` API is stable in @monaco-editor/react 4.7.0 | Monaco Reference Highlighting | If API changed, decorations won't apply; fallback to CSS overlay |
| A3 | `webContents.send` from main process doesn't require the window to be focused | IPC Progress Streaming | If it requires focus, progress events would be lost when user switches windows |
| A4 | The existing `sendRequest` function can be called from the chain orchestrator without side effects | Chain Orchestrator | If sendRequest has global state dependencies (e.g., pendingRequests map), chains would conflict with regular requests |
| A5 | Postman v2.1 round-trip preserves unknown top-level fields (like `chains`) | Collection Schema | If Postman import strips unknown fields, chain definitions would be lost on re-import |
| A6 | Step results stored as JSON strings (not parsed objects) keep memory bounded | Memory Management | If the orchestrator holds all parsed results in memory, long chains could cause pressure |

## Open Questions (RESOLVED)

1. **Chain results storage location** — RESOLVED
   - Decision: Store chain definition (steps + request specs) in collection.json. Store step results in a separate `collections/<id>/chains/<chainId>/results.json` file. Load on-demand when opening a chain editor. This keeps `collections:list` fast.

2. **Step reorder and reference updates** — RESOLVED
   - Decision: For v1, warn the user that reordering will break references. Don't auto-update — it's error-prone with JSONata expressions. Add a "References will break" confirmation dialog.

3. **Chain naming defaults** — RESOLVED
   - Decision: Default to "New Chain" (matches the button label). User renames inline. No uniqueness constraint within a collection (matches Postman's behavior for requests).

4. **Chain history integration** — RESOLVED
   - Decision: Don't add chain runs to per-collection history. Chain results have their own persistence model. The history tab shows individual requests, not chain runs.

5. **JSONata syntax error handling** — RESOLVED
   - Decision: Validate at two points: (1) when the user leaves the field (inline validation with yellow warning), (2) at chain-run time (skip invalid expressions with warning). Never crash on JSONata parse errors.

## Environment Availability

> Step 2.6: SKIPPED — Phase 4 has no external dependencies beyond the existing stack (JSONata is an npm package installed as part of the project). No CLI tools, databases, or services required.

## Sources

### Primary (HIGH confidence)
- **JSONata 1.8.7 npm registry**: `npm view jsonata@1.8.7 version` — confirmed available
- **JSONata 2.x breaking changes**: npm shows 2.2.1 as latest; 1.8.7 is the last 1.x release
- **Monaco deltaDecorations API**: @monaco-editor/react 4.7.0 wraps VS Code's Monaco; decorations API is stable
- **Existing IPC pattern**: `src/main/index.ts` lines 30-31 — `mainWindow.webContents.send('helper:status', status)` establishes main→renderer event pattern
- **Existing request flow**: `src/main/ipc/router.ts` lines 181-201 — `request:send` handler with AbortController and pendingRequests map
- **Atomic write pattern**: `src/main/storage/atomicWrite.ts` — tmp+fsync+rename pattern
- **Collection schema**: `src/shared/schemas/collection.ts` line 205 — `chains: z.array(z.unknown()).default([])` extension point
- **UI-SPEC.md**: 11 components defined, chain editor layout with 4 zones, CSS patterns for step cards and data panel

### Secondary (MEDIUM confidence)
- **JSONata 1.8.x synchronous evaluate**: jsonata 1.8.x documentation states `evaluate()` is synchronous; 2.x made it async. Verify at build time.
- **Postman v2.1 extension preservation**: Postman v2.1 schema is permissive (allows unknown fields), but import/export tools may strip them. Test round-trip with chains.

### Tertiary (LOW confidence)
- **Step reorder UX**: No existing pattern in the codebase for drag-to-reorder of complex items. May need a drag library or arrow-button approach.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — JSONata 1.8.7 verified on npm, all other libs already installed
- Architecture: HIGH — follows established 3-process IPC pattern, main-process HTTP, atomic writes
- Pitfalls: HIGH — all pitfalls derived from analysis of existing codebase patterns and known library behavior

**Research date:** 2026-06-06
**Valid until:** 2026-07-06 (30 days — stable phase, no fast-moving dependencies)
