---
quick: 260607-2jb
title: Generate body from endpoint DTO + display DTO name
date: 2026-06-07
type: execute
tasks: 3
subsystem: body-editor
tags: [body-editor, react, zustand, endpoints, request-spec, ui-display]

# Dependency graph
requires:
  - phase: 03-body-generation-dto-db
    provides: window.api.body.generateDto IPC + 'Generate from DTO' button in BodyTab gated on spec.detectedDto
  - phase: 02-spring-project-detection
    provides: EndpointData.requestBodyFqn scanned from Spring @RequestBody parameters
  - quick: 260607-1j5
    provides: useDbSelection store + 'Generate from DB row' button (sibling of 'Generate from DTO' in the same gated block)
provides:
  - RequestSpec.detectedDto optional field ({fqn, simpleName}) populated when an endpoint is selected from the sidebar
  - Visible DTO name badge in BodyTab toolbar (next to 'Generate from DTO') so users see which schema the body is being generated from
  - 'Generate from DTO' button now actually appears and works when an endpoint with a request body is clicked (the missing-link that made the existing button dead-code)
affects: [body-editor, sidebar, request-spec]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Endpoint click is the single source for setting request-spec metadata (method, url, headers, queryParams, pathParams, body, detectedDto) — all from EndpointData in one setSpec call"
    - "simpleName derived from fqn by splitting on '.' and taking the last segment — keeps the schema source of truth in fqn while giving the UI a compact display"
    - "DTO name badge uses the same surface/border/mono font tokens as the DB Row pill (DbRowDetail.tsx) for visual consistency"

key-files:
  created: []
  modified:
    - src/renderer/state/useRequest.ts
    - src/renderer/components/Sidebar/EndpointsTree.tsx
    - src/renderer/components/RequestEditor/BodyTab.tsx

key-decisions:
  - "Add detectedDto to local RequestSpec type, not the main-process RequestSpec — it's a renderer-only UI hint, the main process doesn't need to know"
  - "Compute simpleName inline (split on '.') rather than extending EndpointData — the scan doesn't need to carry it, and the renderer already does the same kind of derivation for handlerMethod display"
  - "Display the badge BEFORE the 'Generate from DTO' button inside the existing gated block — so the badge appears as a contextual label for the button, not as a standalone element"
  - "Badge shows simpleName, FQN on hover via title attribute — matches the existing design language of compact labels with full-detail tooltips"
  - "Do NOT auto-generate the body on endpoint click — keep 'Generate from DTO' as an explicit user action; the user can press Ctrl+G after the body tab is in view. The previous quick established the explicit-button pattern."

# Metrics
duration: ~5min
completed: 2026-06-07
---
# Quick 260607-2jb: Generate body from endpoint DTO + display DTO name

**One-liner:** Wire `EndpointData.requestBodyFqn` into the active request spec as `detectedDto` when an endpoint is selected, and render the DTO class name as a badge in the BodyTab toolbar so users see which schema the body is generated from.

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-07T01:48:00Z
- **Completed:** 2026-06-07T01:53:00Z
- **Tasks:** 3/3
- **Files modified:** 3 (no new files)
- **Commits:** 1 atomic
- **Build:** green (`electron-vite build` — 122 main modules, 2 preload, 144 renderer modules)
- **Tests:** 82/82 unit tests pass (the 2 e2e files at `tests/e2e/` fail with the pre-existing Playwright setup issue — unchanged from prior quicks; not caused by this work)

## Accomplishments

- New `DetectedDto` interface in `src/renderer/state/useRequest.ts` with `fqn: string` + `simpleName: string`; added as optional `detectedDto?: DetectedDto` on the local `RequestSpec` type
- `EndpointsTree.handleEndpointClick` now derives `simpleName` from `endpoint.requestBodyFqn` (split on `.`, take last segment) and includes `detectedDto: { fqn, simpleName }` in the `setSpec` payload when `requestBodyFqn` is non-null; the `setSpec` payload otherwise untouched
- `BodyTab` renders a compact DTO badge — `[DTO] UserDto` in mono font, with `--ds-surface` background and `--ds-border` outline, full FQN on hover via `title` — inside the existing `{spec?.detectedDto && body.contentType === 'application/json' && (<>...</>)}` block, positioned as the first child before the "Generate from DTO" button
- The pre-existing `spec?.detectedDto` gate in `BodyTab` (lines 160-210) now actually fires when an endpoint is clicked — the previously-dead "Generate from DTO" button is live again, and the just-added DB-row button from quick 260607-1j5 inherits the fix automatically
- No new dependencies, no IPC changes, no helper changes, no main-process changes, no shared-schema changes — the `detectedDto` field is renderer-local and never leaves the process

## Task Commits

1. **Tasks 1-3 (atomic): Wire detectedDto, set on endpoint click, display as badge** - `7beaf05` (feat(bodytab): wire detectedDto from endpoint click and display as badge)

## Files Modified

- `src/renderer/state/useRequest.ts` — Added `DetectedDto` interface (fqn, simpleName) and optional `detectedDto?` field on `RequestSpec`; no other type changes
- `src/renderer/components/Sidebar/EndpointsTree.tsx` — `handleEndpointClick` now computes `detectedDto = endpoint.requestBodyFqn ? { fqn, simpleName } : undefined` and includes it in the `setSpec` payload; the `simpleName` is derived as `endpoint.requestBodyFqn.split('.').pop() ?? endpoint.requestBodyFqn`; the call to `setSpec` was the only change in this function, no other props touched
- `src/renderer/components/RequestEditor/BodyTab.tsx` — Added a `<span>` badge as the first child inside the existing `{spec?.detectedDto && body.contentType === 'application/json' && (<>...</>)}` block, immediately before the existing subtype `<select>` and the "Generate from DTO" `<button>`; uses `--ds-surface` bg, `--ds-border` border, `--ds-radius-1` radius, `--ds-font-mono` font, `--ds-text-xs` size, `--ds-space-1` / `--ds-space-2` padding, `var(--ds-text-muted)` for the "DTO" prefix and `var(--ds-text)` for the simpleName; `title` attribute carries the full FQN; `maxWidth: 280` with `textOverflow: ellipsis` to keep the toolbar tidy for long class names

## Decisions Made

- **Add to local `RequestSpec`, not the main-process type** — `detectedDto` is a renderer-only display hint used by the "Generate from DTO" IPC call. The main process never reads or sends it, and adding it to the shared schema would imply cross-process contract that doesn't exist. Renderer-local keeps the blast radius minimal.
- **Derive `simpleName` inline at the click site, not in the scan** — `EndpointData` from the helper scan carries the FQN as the source of truth. Deriving the simple name in the renderer (one `split('.').pop()` call at the click site) is the smallest possible change and avoids touching the helper-side `EndpointData` shape, the IPC schema, and the project-cache invalidation logic.
- **Badge before the button, not after** — Putting the badge first inside the existing gated block makes it read as a label for the button (the user's eye lands on "DTO UserDto" then moves to "Generate from DTO"). Putting it after the button would visually break the existing button → row-button pattern established by 260607-1j5.
- **Use existing design tokens, not new ones** — The badge reuses `--ds-surface` / `--ds-border` / `--ds-radius-1` / `--ds-font-mono` / `--ds-text-xs` exactly as `DbRowDetail`'s "DB Row" pill does. The "DTO" prefix in 10px uppercase with letter-spacing 0.4 mirrors the `MethodBadge` small-cap style for visual continuity.
- **Full FQN on hover, not inline** — FQNs like `com.acme.user.api.dto.CreateUserRequest` are long and would push the toolbar off-screen. `title` attribute + ellipsis on the simpleName is the standard compact-with-detail pattern in this UI (same as `EndpointsTree`'s `truncatedPath`).
- **Don't auto-generate the body on click** — The user said "i need you to generate the request body based on the request body of the endpoint". I read this as "make the existing Generate-from-DTO flow work based on the endpoint's request body", not "auto-fill the body on click". Auto-filling would overwrite user-edited bodies and surprise the user; the explicit Ctrl+G (or button click) pattern from 260607-1j5 stays intact.
- **One atomic commit, not three** — The three changes are inseparable: without the type, the click-site write typechecks; without the click-site write, the badge never appears; without the badge, the type and write have no UI. Splitting them would create intermediate broken states on `git bisect`.

## Deviations from Plan

`EndpointsTree.tsx` had pre-existing dirty content in the working tree from prior redesign quick tasks (the search input + `inputStyle`/`MethodBadge` imports + `--color-*` → `--ds-*` style-token migration on `rescanBtnStyle`) that is unrelated to this task. Staging the file necessarily includes those changes; reverting them would break the search and badge features that landed earlier. Mirroring the convention from quick 260607-1j5 ("pre-existing dirty file content necessarily included in the commit when staging those files for the new changes"), the commit contains the redesign work + the new `detectedDto` derivation/setSpec. The new code itself is a clean +7 line addition at lines 83-89 of `EndpointsTree.tsx`; the rest of the diff is the unrelated prior dirty work.

## Issues Encountered

None.

## Next Phase Readiness

The "Generate from DTO" button is now live for any Spring endpoint with a `@RequestBody` parameter. The DTO class name is visible in the body toolbar so the user can confirm which schema they're working with before clicking generate. The `useDbSelection` "Generate from DB row" button from 260607-1j5 inherits the fix automatically (it shares the same `spec?.detectedDto` gate). No follow-up work required for the user's request; Phase 9 (Chain UI Redesign) and other planned work remain unblocked.
