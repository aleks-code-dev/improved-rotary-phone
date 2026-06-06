---
quick: 260607-0in
title: Fix DB panel not resizeable, Load Tables no-op, and 'Not connected' errors
date: 2026-06-07
type: execute
tasks: 2
subsystem: database
tags: [database, react, electron, ipc, error-handling, ui, persistence]

# Dependency graph
requires:
  - phase: 08-01
    provides: DatabasePanel container with DbConnectionForm, DbTableTree, DbRowDetail
provides:
  - Resize handle on DatabasePanel using existing Splitter; width persisted to localStorage (key pc.dbPanelWidth), clamped to [240,700]px, default 340px
  - Save→connect lifecycle: DbConnectionForm now opens the HikariCP pool in the helper after a successful connections.create; surfaces connect errors in the existing testResult UI; keeps form open on failure
  - Auto-connect on select: DatabasePanel's connection-list onClick opens the pool if not already connected; status dot updates in-memory
  - Load Tables loading + error states: DbTableTree now tracks tablesLoading/tablesError; silent catch replaced with explicit error capture
  - db:listTables re-throws errors (and throws on helper offline) so the renderer's catch block actually surfaces them
affects: [database, helper-restart-recovery, error-surfacing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Re-throw IPC errors instead of swallowing + returning safe defaults; let the renderer decide how to surface them"
    - "Idempotent auto-connect on selection guarded by !conn.connected — db:connect in router.ts is already idempotent (DbConnectionManager.connect closes existing pool first)"
    - "Use existing reusable Splitter component for resizable panel edges (no new resize infra)"

key-files:
  modified:
    - src/renderer/App.tsx
    - src/renderer/components/Database/DatabasePanel.tsx
    - src/renderer/components/Database/DbConnectionForm.tsx
    - src/renderer/components/Database/DbTableTree.tsx
    - src/main/ipc/router.ts

key-decisions:
  - "Re-throw in db:listTables (not { error } envelope) — simpler, lets ipcMain.handle propagate to renderer's catch"
  - "Persist dbPanelWidth to localStorage (not electron-store) — first localStorage usage in the codebase; UI-only preference that doesn't need to round-trip through main"
  - "Auto-connect on select guarded by !conn.connected — db:connect is idempotent in the helper (closes existing pool) but guarding avoids the round-trip on already-connected rows"
  - "onConnectionCreated signature changed to (connectionId: string) — saves a full list refresh to update the connected dot in-place"

# Metrics
duration: ~5min
completed: 2026-06-07
---

# Quick 260607-0in: Fix DB panel not resizeable, Load Tables no-op, and 'Not connected' errors

**Resizable right-pane DatabasePanel with persistent width, Save→connect lifecycle that actually opens the HikariCP pool, auto-reconnect on selection, and surfaced Load Tables errors instead of silent failure.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-07T00:35:00Z
- **Completed:** 2026-06-07T00:40:00Z
- **Tasks:** 2/2
- **Files modified:** 5 (App.tsx, DatabasePanel.tsx, DbConnectionForm.tsx, DbTableTree.tsx, router.ts)
- **Commits:** 2 atomic

## Accomplishments

- Wired the existing unused `<Splitter>` component between the main pane and the DatabasePanel; drag resizes between 240-700px with localStorage persistence
- `DbConnectionForm.handleSave` now invokes `db.connect` after `connections.create`; surfaces connect errors via the existing red `✗` `testResult` indicator and keeps the form open on failure
- `DatabasePanel` connection-list `onClick` auto-opens the HikariCP pool when selecting a row whose pool isn't yet open (helper restart recovery)
- `DbTableTree` Load Tables button shows "Loading…" while in flight; the silent `catch { /* ignore */ }` was replaced with explicit error capture and a red `✗ <message>` indicator above the "No tables found" placeholder
- `db:listTables` IPC handler in main now re-throws errors (and throws on helper offline) so the renderer's catch actually fires; the main-process `log.error` is still called for forensics
- Build green; 82/82 unit tests pass (the 2 e2e test files at `tests/e2e/` fail to load with a pre-existing Playwright setup issue — they were untracked, not modified by this quick)

## Task Commits

1. **Task 1: Add resize handle to DatabasePanel** - `e269d9f` (fix(db): make DatabasePanel resizable via Splitter)
2. **Task 2: Wire Save→connect, auto-connect on select, surface Load Tables errors** - `3f011dc` (fix(db): wire save→connect, auto-connect on select, surface listTables errors)

## Files Created/Modified

- `src/renderer/App.tsx` — Added `dbPanelWidth` state with localStorage hydration + persistence; imported `<Splitter>`; renders `<Splitter>` + `<DatabasePanel width={dbPanelWidth} />` inside the `{dbPanelOpen && ...}` branch
- `src/renderer/components/Database/DatabasePanel.tsx` — Function now accepts `width: number` prop; outer flex column uses `width` instead of hard-coded 340; `handleConnectionCreated` takes `connectionId: string` and marks the row as `connected: true` after `refreshConnections()`; connection-list `onClick` auto-calls `db.connect` when `!conn.connected`
- `src/renderer/components/Database/DbConnectionForm.tsx` — `onConnectionCreated` prop signature changed to `(connectionId: string) => void`; `handleSave` now destructures `{ id }` from `connections.create`, calls `db.connect({ connectionId: id })`, surfaces `!result?.ok` in the existing `testResult` UI, and only clears the form on full success
- `src/renderer/components/Database/DbTableTree.tsx` — Added `tablesLoading` and `tablesError` state; `loadTables` sets them around the IPC call; button shows "Loading…" and `disabled` while in flight; error renders in red (`--ds-method-delete`) above the "No tables found" placeholder
- `src/main/ipc/router.ts` — `db:listTables` catch block re-throws (and helper-offline branch throws); `log.error` retained for forensics

## Decisions Made

- **Re-throw in `db:listTables` over `{ error }` envelope** — `ipcMain.handle` already propagates thrown errors to the renderer's `invoke()` as a rejection, so re-throw is the minimal change that gets the error to `DbTableTree`'s catch block. An envelope would have required changing the return type signature on both sides.
- **Re-throw **and** log** — kept the `log.error('db:listTables failed', { error: err.message })` call in the catch block before re-throwing, so main-process forensics still work without the renderer having to mirror the log.
- **Helper-offline branch now throws `'Helper offline'`** — previously returned `[]`; the previous behavior made "helper not running" indistinguishable from "no tables" in the UI. The renderer now shows `✗ Helper offline`.
- **localStorage for `pc.dbPanelWidth`, not `electron-store`** — first localStorage usage in the codebase. UI-only window-local preference; doesn't need to round-trip through main process / persist across machines.
- **Default 340px clamp `Number.isFinite(v) && v >= 240 && v <= 700`** — corrupt or out-of-range stored values fall back to the default rather than producing a broken layout.

## Deviations from Plan

None - plan executed exactly as written. The pre-existing dirty file content in `DbConnectionForm.tsx`, `DbTableTree.tsx`, and `router.ts` (uncommitted redesign work) was necessarily included in the commit when staging those files for the Save→connect + error-surfacing changes; only the files specified in the plan were modified.

## Issues Encountered

None.

## Next Phase Readiness

Phase 9 (Chain UI Redesign) is unblocked. The DatabasePanel is now functionally complete for v3.0; future work on pool-leak-on-delete and post-helper-restart re-hydration is documented as deferred (per plan's Risks section) and can ship in a later quick.
