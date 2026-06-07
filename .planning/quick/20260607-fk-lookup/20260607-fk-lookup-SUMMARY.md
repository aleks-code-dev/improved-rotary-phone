---
phase: quick
plan: 20260607-fk-lookup
subsystem: renderer
tags: [database, body-editor, ui]
dependency_graph:
  requires: []
  provides: [fk-lookup-dialog, fk-detection]
  affects: [body-tab]
tech_stack:
  added: []
  patterns: [memoized-json-parsing, modal-dialog]
key_files:
  created:
    - src/renderer/components/Database/FkLookupDialog.tsx
    - src/renderer/lib/fkDetect.ts
  modified:
    - src/renderer/components/RequestEditor/BodyTab.tsx
decisions:
  - "Use first column value as FK value when a row is selected"
  - "FK buttons rendered in toolbar (not inline in editor) for discoverability"
metrics:
  duration: ~5min
  completed: "2026-06-07"
---

# Quick Task 20260607-fk-lookup: FK Lookup Button in Body Editor Summary

FK detection in JSON body fields (`categoryId`, `product_id`) with DB lookup dialog for selecting reference values.

## What Was Built

### FkLookupDialog (`src/renderer/components/Database/FkLookupDialog.tsx`)
- Modal overlay with search input pre-filled from FK derived snake_case term
- Table list filtered by search term, compact row picker
- Loads rows via `window.api.db.fetchRows` when a table is clicked
- Selecting a row calls `onSelectRow` with the row data
- Escape key closes dialog, styled with project dark-theme CSS variables

### FK Detection Utility (`src/renderer/lib/fkDetect.ts`)
- `isFkField(key)`: detects `*Id` (camelCase) and `*_id` (snake_case) suffixes
- `toSnakeCaseFk(key)`: derives search term (`categoryId` → `category`, `product_id` → `product`)

### BodyTab Integration (`src/renderer/components/RequestEditor/BodyTab.tsx`)
- Parses JSON body to find root-level FK keys via `useMemo`
- Renders lookup buttons in toolbar (🔍 icon + field name) for each FK key
- Clicking opens `FkLookupDialog` with derived search term
- Selected row value updates the FK field in the JSON body
- No-DB state: button shows tooltip "Connect to a DB first", dimmed styling
- Tables loaded from `window.api.db.listTables` when dialog opens

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all functionality is wired end-to-end.

## Threat Flags

None — no new security surface introduced (reuses existing `window.api.db.*` IPC calls).

## Self-Check

- [x] `src/renderer/components/Database/FkLookupDialog.tsx` exists
- [x] `src/renderer/lib/fkDetect.ts` exists
- [x] `src/renderer/components/RequestEditor/BodyTab.tsx` modified
- [x] Commit `4fa4bc3`: FkLookupDialog component
- [x] Commit `54ca5a6`: FK detection + BodyTab integration
