# Phase 4: Workflow Chains & Response Mapping - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-06
**Phase:** 4-Workflow Chains & Response Mapping
**Areas discussed:** Chain execution model, Variable reference syntax, Mapping editor UX, Error handling & partial re-run

---

## Chain execution model

### Q1: How should a chain execute?

| Option | Description | Selected |
|--------|-------------|----------|
| Sequential in main process | Main process executes steps sequentially using undici. Simple, predictable, matches Postman runner. | ✓ |
| Parallel where possible | Steps with no dependency run concurrently. Faster but adds complexity. | |
| You decide | Agent discretion. | |

**User's choice:** Sequential in main process
**Notes:** None

### Q2: Timeout and retry configuration?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-step timeout + retry | Each step has its own timeout (default 30s) and retry count (default 0). Per-step, not per-chain. | ✓ |
| Per-chain timeout + retry | One setting for entire chain. Simpler but inflexible. | |
| You decide | Agent discretion. | |

**User's choice:** Per-step timeout + retry
**Notes:** None

### Q3: What happens on step failure?

| Option | Description | Selected |
|--------|-------------|----------|
| Halt chain | Chain stops immediately. Failed step shows red. User can re-run from failed step. | ✓ |
| Continue on failure | Failed step shows red, chain continues. Downstream mappings get empty values. | |
| Per-step halt/skip toggle | Per-step control. Adds UI complexity. | |
| You decide | Agent discretion. | |

**User's choice:** Halt chain
**Notes:** None

### Q4: Re-run single step behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Use cached prior responses | Re-run only step N, use cached responses from 1..N-1. Fast but stale. | |
| Re-run from step 1 to N | Re-run all steps 1..N fresh. Slow but always current data. | ✓ |
| You decide | Agent discretion. | |

**User's choice:** Re-run from step 1 to N
**Notes:** User explicitly chose "always fresh" over the recommended cached approach.

### Q5: Per-step results display?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline on step cards | Step cards show status badge, HTTP status, timing, collapsed body. Click to expand. | ✓ |
| Results table below chain | Dedicated table with columns for each result field. | |
| You decide | Agent discretion. | |

**User's choice:** Inline on step cards
**Notes:** None

### Q6: Step result persistence?

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory only | Results ephemeral, lost on tab close or app restart. | |
| Persist to disk | Results saved alongside chain definition, survive restart. | ✓ |
| You decide | Agent discretion. | |

**User's choice:** Persist to disk
**Notes:** User chose persistence over the recommended in-memory approach.

### Q7: Step request source?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline request spec per step | Each step holds its own complete request. Chain is self-contained. | ✓ |
| Reference saved requests by ID | Steps reference collection items by ID. DRY but creates hidden coupling. | |
| You decide | Agent discretion. | |

**User's choice:** Inline request spec per step
**Notes:** None

### Q8: Chain execution progress UI?

| Option | Description | Selected |
|--------|-------------|----------|
| Pulse on active step + progress bar | Active step pulses with spinner, progress bar shows step N of M. Non-blocking. | ✓ |
| Blocking progress modal | Modal blocks interaction during execution. Simpler but locks UI. | |
| You decide | Agent discretion. | |

**User's choice:** Pulse on active step + progress bar
**Notes:** None

---

## Variable reference syntax

### Q1: Reference syntax format?

| Option | Description | Selected |
|--------|-------------|----------|
| {{stepN.response.body.path}} | Curly-brace syntax matching existing {{variable}} pattern. Familiar to Postman users. | ✓ |
| $stepN.response.body.path | Dollar-prefix syntax. More compact, visually distinct from env vars. | |
| You decide | Agent discretion. | |

**User's choice:** {{stepN.response.body.path}}
**Notes:** None

### Q2: How to insert references?

| Option | Description | Selected |
|--------|-------------|----------|
| Click-to-copy from bottom panel | Bottom panel shows response fields with copy buttons. Click → expression inserted at cursor. | ✓ |
| Drag from response tree to body | Drag-drop creates mapping. More intuitive but needs drag-drop infra. | |
| Autocomplete dropdown in editor | Type '{{' → dropdown shows available steps/fields. | |
| You decide | Agent discretion. | |

**User's choice:** Click-to-copy from bottom panel
**Notes:** None

### Q3: When to resolve references?

| Option | Description | Selected |
|--------|-------------|----------|
| Resolve at run-time, show template in editor | Main process resolves before HTTP send. Editor shows template. Preview button for resolved view. | ✓ |
| Show resolved values inline in editor | Editor shows resolved values as ghost text from last run. | |
| You decide | Agent discretion. | |

**User's choice:** Resolve at run-time, show template in editor
**Notes:** None

### Q4: Unresolved reference behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Empty string + warning, continue | Insert empty string, log warning, step shows yellow indicator. Chain doesn't halt. | ✓ |
| Fail step + halt chain | Step fails with "Reference not found" error. Strict. | |
| You decide | Agent discretion. | |

**User's choice:** Empty string + warning, continue
**Notes:** None

### Q5: Where can references be used?

| Option | Description | Selected |
|--------|-------------|----------|
| URL + headers + body | References work everywhere. Consistent syntax in all three places. | ✓ |
| Body only | References only in body. URLs/headers use env vars only. | |
| You decide | Agent discretion. | |

**User's choice:** URL + headers + body
**Notes:** None

### Q6: Step identification?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-numbered, names display-only | Steps identified by position number. Names for display only. References use numbers. | ✓ |
| User-named steps, references use name | References use names like {{login.response.body.token}}. More readable but fragile. | |
| You decide | Agent discretion. | |

**User's choice:** Auto-numbered, names are display-only
**Notes:** None

### Q7: Path expression language?

| Option | Description | Selected |
|--------|-------------|----------|
| Simple dot-path | Simple dot-notation. Covers 90% of cases. No external dependency. | |
| JSONata expressions | Full JSONata 1.8.x. Powerful: filtering, transformations. Already in stack. | ✓ |
| You decide | Agent discretion. | |

**User's choice:** JSONata expressions
**Notes:** User chose the more powerful option over the recommended simpler approach.

---

## Mapping editor UX

### Q1: Where does the mapping UI live?

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom panel with step columns | Collapsible bottom panel (sketch 10-B). Prior step responses as columns with JSON trees. | ✓ |
| Mappings sub-tab in request editor | Dedicated sub-tab alongside Params, Headers, Body. Structured but separated from body editor. | |
| You decide | Agent discretion. | |

**User's choice:** Bottom panel with step columns
**Notes:** None

### Q2: Preview resolved body?

| Option | Description | Selected |
|--------|-------------|----------|
| Preview button → resolved body modal | Button in toolbar opens modal with resolved body. Read-only. | ✓ |
| Inline ghost text in editor | Resolved values as ghost text behind references in editor. | |
| You decide | Agent discretion. | |

**User's choice:** Preview button → resolved body modal
**Notes:** None

### Q3: Response tree format?

| Option | Description | Selected |
|--------|-------------|----------|
| Expandable JSON tree with copy buttons | JSON tree (expand/collapse) with copy-path buttons per field. Reuses Phase 1 response viewer. | ✓ |
| Flat key-value list | Flat list of paths. Simpler but loses nested structure. | |
| You decide | Agent discretion. | |

**User's choice:** Expandable JSON tree with copy buttons
**Notes:** None

### Q4: Chain editing layout?

| Option | Description | Selected |
|--------|-------------|----------|
| Steps bar + request builder + data panel | Top: horizontal steps (009-A). Middle: request builder. Bottom: collapsible data panel (10-B). | ✓ |
| Sidebar steps + right content area | Left sidebar vertical list, right side shows builder + panel. | |
| You decide | Agent discretion. | |

**User's choice:** Steps bar + request builder + data panel
**Notes:** None

### Q5: How to create a chain?

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar 'New Chain' button | Button next to 'New Request' and 'New Folder'. Creates chain with one empty step. | ✓ |
| Collection context menu | Right-click collection → 'Create Chain'. More hidden. | |
| You decide | Agent discretion. | |

**User's choice:** Sidebar 'New Chain' button
**Notes:** None

---

## Error handling & partial re-run

### Q1: Error display?

| Option | Description | Selected |
|--------|-------------|----------|
| Red step card + error in response area | Failed step turns red with status code. Click to see error details in response area. | ✓ |
| Separate errors panel | Dedicated errors panel at bottom. Step cards show red dot. | |
| You decide | Agent discretion. | |

**User's choice:** Red step card + error in response area
**Notes:** None

### Q2: Re-run result behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Re-run 1→N, all fresh, replace results | All steps 1..N re-executed with fresh requests. All results replaced. | ✓ |
| Re-run N→end, preserve prior results | Re-run from N onward. Prior results preserved. | |
| You decide | Agent discretion. | |

**User's choice:** Re-run 1→N, all fresh, replace results
**Notes:** Consistent with D-04 (always fresh).

### Q3: Stop button behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Stop after current step | Halts after current step completes. Doesn't abort mid-request. Completed steps keep results. | ✓ |
| Abort immediately | Immediately aborts in-flight request and halts. | |
| You decide | Agent discretion. | |

**User's choice:** Stop after current step
**Notes:** None

### Q4: Pre-run validation?

| Option | Description | Selected |
|--------|-------------|----------|
| Validate references + URLs before run | Check valid URLs, existing step references, no circular refs. Show issues list if invalid. | ✓ |
| No pre-validation | Just run and fail at first broken step. | |
| You decide | Agent discretion. | |

**User's choice:** Validate references + URLs before run
**Notes:** None

### Q5: Retry behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Retry same request with delay | Wait configured delay, re-send same request. Fixed delay, not exponential. | ✓ |
| Retry with exponential backoff | Exponential backoff (1s, 2s, 4s...). | |
| You decide | Agent discretion. | |

**User's choice:** Retry same request with delay
**Notes:** None

---

## agent's Discretion

No areas were explicitly deferred to agent discretion. All 22 questions received a user-selected answer. The "agent's Discretion" section in CONTEXT.md lists areas that were NOT discussed (chain import/export, step reorder, naming, etc.) where the planner/researcher have flexibility.

## Deferred Ideas

None — discussion stayed within phase scope.
