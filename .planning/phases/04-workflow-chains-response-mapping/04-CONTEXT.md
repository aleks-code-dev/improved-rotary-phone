# Phase 4: Workflow Chains & Response Mapping - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 delivers **ordered multi-step request chains** where later steps reference earlier responses — completing the "Spring project → live API playground" story end to end.

1. **Chain Model & Execution** (CHAIN-01, CHAIN-03, CHAIN-04, CHAIN-05): User defines an ordered chain of N requests inside a collection. Each step has its own inline request spec (method, URL, headers, body), per-step timeout/retry config, and a display name. The chain orchestrator in the main process runs steps sequentially using the existing undici HTTP client. Step results (response body, status, timing) persist to disk. On failure, the chain halts. Re-running from a specific step re-runs from that step to the end, using cached results for earlier steps.

2. **Variable References** (CHAIN-02): Later steps reference earlier responses using `{{stepN.response.body.path}}` syntax with JSONata 1.8.x expressions for the path. References work in URL, headers, and body. Inserted via click-to-copy from a bottom data panel. Resolved at chain-run time (not edit time). Unresolved references produce an empty string + warning and do not halt the chain.

3. **Response→Body Mapping Editor** (MAP-01..04): Bottom collapsible panel (sketch 010-B) shows prior step responses as expandable JSON trees with copy-path buttons. Steps are displayed as a horizontal sequence (sketch 009-A). A "Preview Resolved" button shows the body with all references filled in. Chains appear in the collection sidebar with a "New Chain" button.

**Carrying forward from earlier phases:**
- Stack: Electron 42.3.2 + React 19.2.0 + Vite 8 + TypeScript 5.6+ + Zustand 5 + TanStack Query 5 + Zod 4 + undici 7 + Monaco + Java 21 LTS + jsonrpc4j 1.6 + safeStorage (NOT keytar) + HikariCP 6
- 3-process architecture: Renderer ↔ Main (Pattern 2 invoke/handle + Zod) ↔ JVM Helper (JSON-RPC 2.0 stdio, long-lived)
- Storage: JSON files in `app.getPath('userData')`, atomic writes, secrets via `safeStorage`
- Theme: Dark (#1a1b1e background, #25262b surface, #373a40 borders). System sans-serif (Inter) + JetBrains Mono. Compact spacing (4/6/10/14px scale)
- Collection schema: `chains: z.array(z.unknown()).default([])` already exists in `src/shared/schemas/collection.ts`
- UI patterns from prior phases: Vertical tab strip, pill bar body modes, attached method badge URL bar, Monaco editor for JSON body, method color badges

</domain>

<decisions>
## Implementation Decisions

### Chain Execution Model (discussed 2026-06-06)

- **D-01:** **Sequential execution in main process.** The chain orchestrator lives in the main process and executes steps one-by-one using the existing undici HTTP client. No parallel execution — simple, predictable, matches Postman runner behavior.
- **D-02:** **Per-step timeout + retry.** Each chain step has its own timeout (default 30s, max 600s) and retry count (default 0, max 5) with a configurable fixed delay between retries. Settings are per-step, not per-chain.
- **D-03:** **Halt chain on failure.** When a step fails (non-2xx, timeout, network error), the chain stops immediately. Failed step shows red status with error details. User can re-run from the failed step onward.
- **D-04:** **Re-run from step N onward using cached results (per CHAIN-04).** When the user re-runs from a specific step N, only steps N through the end are re-executed with fresh HTTP requests. Steps 1..N-1 retain their previous persisted results and are used for reference resolution. All step results from N onward are replaced. The user can right-click any step and select "Re-run from here". The "Run Chain" button in the header always runs from step 1.
- **D-05:** **Step results persist to disk.** Response bodies (up to 1MB cap), status codes, and timing persist alongside the chain definition in the collection. Results survive app restart. Re-running a chain replaces all results.
- **D-06:** **Inline request spec per step.** Each chain step holds its own complete request spec (method, URL, headers, body, auth, settings). Steps don't reference saved requests in the collection — the chain is self-contained. Editing a chain step doesn't affect saved requests and vice versa.
- **D-07:** **Progress: pulse on active step + progress bar.** During chain execution, the active step card pulses/highlights with a spinner. Completed steps show green/red status. A thin progress bar shows "Step N of M". The UI remains fully responsive — user can scroll, inspect completed steps, or cancel.
- **D-08:** **Step results inline on step cards.** Each step card in the horizontal sequence shows: status badge (green/red/gray), HTTP status code, response time, and a collapsed response body. Click a step card to expand and see full response.

### Variable Reference Syntax (discussed 2026-06-06)

- **D-09:** **`{{stepN.response.body.path}}` syntax.** Chain variable references use curly-brace syntax matching the existing `{{variable}}` pattern. The step number + JSONata path is the reference. Example: `{{step1.response.body.userId}}`, `{{step2.response.headers.X-Auth-Token}}`.
- **D-10:** **JSONata 1.8.x for path expressions.** The path portion after `stepN.response.` uses full JSONata syntax. Supports filtering (`items[price>10]`), transformations, and functions. The JSONata library (1.8.x) is already in the stack per STACK.md.
- **D-11:** **Click-to-copy from bottom panel.** Users insert references by browsing prior step responses in the bottom data panel and clicking a "Copy path" button on a field. The `{{stepN.response.body.path}}` expression is inserted at the cursor position in the body editor, URL field, or header value.
- **D-12:** **References usable in URL, headers, and body.** A single consistent syntax works in all three places. URL path: `/users/{{step1.response.body.id}}`. Header: `Authorization: Bearer {{step1.response.body.token}}`. Body: `{"userId": "{{step1.response.body.id}}"}`.
- **D-13:** **Resolve at run-time, show template in editor.** At chain-run time, the main process resolves all `{{stepN.response.body.path}}` references before sending the HTTP request. The editor always shows the template with references (not resolved values). A "Preview Resolved" button (MAP-04) shows the resolved body.
- **D-14:** **Empty string + warning on unresolved reference.** When a reference can't be resolved (path doesn't exist, step hasn't run), the chain logs a warning, inserts an empty string, and continues running. The step result shows a yellow warning indicator listing unresolved references. The chain does NOT halt.
- **D-15:** **Auto-numbered steps, names are display-only.** Steps are identified by their position number (1, 2, 3...). Users can optionally set a display name/label. References always use the step number, never the name. Names are for human readability only.

### Mapping Editor UX (discussed 2026-06-06)

- **D-16:** **Bottom panel with step columns (sketch 10-B).** A collapsible bottom panel below the request builder shows previous step responses as columns. Each column = one prior step, showing its response body fields as an expandable JSON tree with "Copy path" buttons. Also shows headers and status as top-level nodes. Reuses the existing response viewer tree component from Phase 1.
- **D-17:** **Preview button → resolved body modal.** A "Preview Resolved" button in the body editor toolbar opens a modal showing the body with all `{{stepN...}}` references replaced by their resolved values (from the last chain run, or placeholder text if chain hasn't run). Read-only, not editable.
- **D-18:** **Chain layout: steps bar + request builder + data panel.** Top: horizontal step sequence (009-A) — step cards with arrows, click to select a step. Middle: request builder for the selected step (identical to main request editor — method, URL, tabs). Bottom: collapsible data panel (010-B) showing prior step responses.
- **D-19:** **Sidebar "New Chain" button.** A "New Chain" button in the collection sidebar (next to "New Request" and "New Folder") creates a chain with one empty step. User clicks '+' to add more steps. Chain appears in the sidebar as a top-level item with a chain icon.

### Error Handling & Re-run (discussed 2026-06-06)

- **D-20:** **Red step card + error in response area.** Failed step card turns red with the HTTP status code (or error code for network failures). Clicking the step shows error details in the response area — same format as a regular failed request. The step number is preserved so references from later steps still make sense.
- **D-21:** **Stop after current step.** A "Stop" button in the chain header during execution halts the chain after the current step completes (doesn't abort mid-request). Completed steps keep their results; unstarted steps remain gray.
- **D-22:** **Validate references + URLs before run.** Before running, the orchestrator validates: (1) all steps have a valid URL, (2) all `{{stepN...}}` references point to existing steps, (3) no circular references. If validation fails, show a list of issues and don't start.
- **D-23:** **Retry same request with fixed delay.** When a step has retry count > 0 and fails, wait the configured delay (default 1s), then re-send the same HTTP request. Repeat up to the retry count. If all retries fail, halt the chain. The step result logs how many retries were attempted.

### the agent's Discretion

The following were identified as gray areas but not discussed — the planner and researcher have flexibility:

- **Chain import/export format:** How chains serialize into the Postman v2.1 `chains` extension. Whether the Postman import/export preserves chain definitions. The exact JSON shape for chain + step + mapping storage.
- **Chain-to-chain references:** Whether a step in one chain can reference responses from a different chain. Deferred — v1 chains are self-contained.
- **Step reorder UX:** How steps are reordered in the horizontal sequence (drag? arrow buttons?). How reordering affects existing references (do references auto-update when step numbers change?).
- **Chain naming conventions:** Default name for new chains ("New Chain" vs "Chain 1" vs untitled). Whether chain names must be unique within a collection.
- **Bulk step operations:** Duplicate step, copy step to another chain, import request from collection into chain step.
- **Chain history:** Whether chain runs are recorded in the per-collection history (CORE-09) or have their own history. What the history entry looks like for a chain run.
- **JSONata error handling:** What happens when a JSONata expression is syntactically invalid — fail at validation time vs fail at resolution time.
- **Step result retention policy:** Max number of persisted chain run results per chain. Whether old results are auto-pruned (like history cap 100).
- **Helper-offline behavior:** Chain execution works entirely in the main process (undici) — the JVM helper is not needed. But if future chain steps need DTO resolution or DB data, the helper would be required. For v1, chains are pure HTTP.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context

- `.planning/PROJECT.md` — Core Value, Active requirements (CHAIN-01..05, MAP-01..04), Constraints (desktop app, read-only Spring project, DB drivers)
- `.planning/REQUIREMENTS.md` — Full requirement definitions + Traceability table (Phase 4 rows: CHAIN-01..05, MAP-01..04)
- `.planning/ROADMAP.md` § Phase 4 — Success criteria (5 items), dependency on Phase 3, plan outline (04-01..03)
- `.planning/STATE.md` — Current position, accumulated decisions from Phases 1-3

### Prior phase context

- `.planning/phases/01-foundation-postman-parity/01-CONTEXT.md` — Phase 1 decisions: 3-process IPC, storage layout, theme, keyboard shortcuts, body editor conventions, Postman v2.1 round-trip
- `.planning/phases/03-body-generation-dto-db/03-CONTEXT.md` — Phase 3 decisions: DTO body generation UX, DB connection management, column→field mapping

### Research docs (stack + architecture)

- `.planning/research/STACK.md` — Prescriptive stack with versions: JSONata 1.8.x (§2), undici 7 (§3), Zustand 5 + TanStack Query 5 (§2), Monaco (§2)
- `.planning/research/ARCHITECTURE.md` §6 — Storage layout (Postman v2.1 with `chains` top-level extension)
- `.planning/research/PITFALLS.md` — Relevant pitfalls for Phase 4

### Sketch findings (UI direction)

- `.opencode/skills/sketch-findings-postman-clone/SKILL.md` — Design direction: dark palette, method colors, compact spacing, monospace fonts
- `.opencode/skills/sketch-findings-postman-clone/references/chain-requests.md` — Chain UI: horizontal step sequence (009-A), bottom data panel (010-B), `$stepN.response.body.field` syntax (now revised to `{{stepN.response.body.path}}`), CSS patterns for step cards and arrows

### Existing code (Phase 1-3 patterns)

- `src/shared/schemas/collection.ts` — Collection schema with `chains: z.array(z.unknown()).default([])` extension point. Phase 4 replaces `z.unknown()` with a typed ChainSchema.
- `src/main/ipc/channels.ts` — Zod schemas for all IPC payloads. Phase 4 adds chain CRUD + execution channels.
- `src/main/ipc/router.ts` — IPC handler registration pattern. Phase 4 adds chain orchestrator handlers.
- `src/main/http/undiciClient.ts` — HTTP request sending. Phase 4's chain orchestrator calls this for each step.
- `src/main/storage/collections.ts` — Collection CRUD. Phase 4 extends with chain CRUD within a collection.
- `src/main/storage/atomicWrite.ts` — Atomic file writes. Phase 4 uses this for chain result persistence.

### Key constraints to respect

- **Postman v2.1 compliance:** Chains are stored as a `chains` extension on the collection JSON. Must not break Postman v2.1 round-trip (CORE-10).
- **1MB body cap:** Step response bodies are truncated at 1MB (same as history, per Phase 1 D-18).
- **Main-process HTTP:** All chain HTTP goes through the main process (undici). No renderer-side fetch (CORS avoidance, per ARCHITECTURE.md §2).
- **JSONata 1.8.x:** The path expression language for `{{stepN.response.body.*}}` references. Client-side JS library, ~30 KB.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`sendRequest`** (`src/main/http/undiciClient.ts`): The existing HTTP client. Chain orchestrator calls this for each step. Already handles abort, timing, auth, proxy.
- **`RequestSpecSchema`** (`src/main/ipc/channels.ts` + `src/shared/schemas/collection.ts`): The Zod-validated request schema. Each chain step's inline request spec uses this same schema.
- **`ResponseResultSchema`** (`src/main/ipc/channels.ts`): The response result schema. Chain step results extend this with step index, retry count, and mapping resolution metadata.
- **`CollectionSchema`** (`src/shared/schemas/collection.ts`): Already has `chains` field. Phase 4 defines the ChainSchema, ChainStepSchema, and ChainMappingSchema and plugs them into the collection.
- **`writeFileAtomic`** (`src/main/storage/atomicWrite.ts`): Used for persisting chain results to disk.
- **Monaco editor** (already integrated): The body editor already supports JSON with syntax highlighting. Phase 4 adds reference expression highlighting (purple background per sketch 10-B).
- **Response viewer tree** (Phase 1): The expandable JSON tree in the response viewer. Reused in the bottom data panel for browsing prior step responses.

### Established Patterns

- **IPC handler registration** (`src/main/ipc/router.ts`): New channels follow `<domain>:<verb>` naming (e.g., `chains:create`, `chains:run`, `chains:stop`). All payloads Zod-validated.
- **Zustand + TanStack Query** (renderer state): Chain execution state (running step, progress, results) via Zustand. Chain definitions via TanStack Query (read from collection).
- **Atomic writes** (Phase 1): Chain results use the same `<file>.tmp` → fsync → rename pattern.
- **AbortController** (Phase 1): Used for cancelling in-flight requests. Chain "Stop" button uses this for the current step.

### Integration Points

- **Collection sidebar** — "New Chain" button alongside "New Request" and "New Folder". Chain items appear in the tree with a chain icon.
- **Request editor tabs** — Clicking a chain step opens its request editor (identical layout to regular requests). The bottom data panel is an additional section below the request builder.
- **IPC router** — New chain channels register in the existing router. The renderer calls `ipcRenderer.invoke('chains:run', { chainId })` → main → orchestrator → sequential undici calls.
- **Collection storage** — Chain definitions are part of the collection JSON. CRUD operations go through the existing `collections:update` IPC channel.

</code_context>

<specifics>
## Specific Ideas

- **Chain is a first-class collection artifact.** Chains sit alongside requests and folders in the collection sidebar. They have their own icon (e.g., a chain link or workflow icon). They are not nested inside folders — they are top-level items in the collection.
- **Horizontal step sequence is the visual anchor.** The sketch finding 009-A (horizontal cards with arrows) is the primary UI pattern for chains. This is NOT a list, NOT tabs, NOT a vertical sequence. The horizontal flow with arrows communicates "data flows left→right" which matches the chain metaphor.
- **Bottom data panel is collapsible.** The sketch 10-B bottom panel shows prior step responses. It's collapsible (chevron toggle) so users can hide it when they don't need to browse responses. When collapsed, the request builder gets full height.
- **Reference expressions are visually distinct.** In the body editor, `{{stepN.response.body.path}}` references get a purple highlight background (per sketch 10-B: `background: rgba(156,60,224,0.2)`, `color: var(--color-method-patch)`). This makes chain references visually different from environment variables (`{{baseUrl}}`).
- **Chain runs are NOT recorded in regular request history.** Chain runs have their own result persistence (per-step results saved alongside the chain definition). They don't pollute the per-collection request history (CORE-09).
- **The chain orchestrator is a pure main-process module.** No IPC to the helper, no renderer-side logic. The orchestrator reads chain steps, resolves references, calls undici for each step, writes results, emits progress events to the renderer. Simple, testable, no cross-process coordination.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. All identified gray areas not discussed are captured under "the agent's Discretion" above.

</deferred>

---

*Phase: 4-Workflow Chains & Response Mapping*
*Context gathered: 2026-06-06 via /gsd-discuss-phase (4 areas discussed: Chain execution model, Variable reference syntax, Mapping editor UX, Error handling & partial re-run)*
