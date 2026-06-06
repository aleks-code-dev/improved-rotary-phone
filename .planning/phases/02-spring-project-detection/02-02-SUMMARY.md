---
phase: 02-spring-project-detection
plan: 02
subsystem: renderer
tags: [react, zustand, tanstack-query, sidebar]
dependency_graph:
  requires: [02-01]
  provides: [SPRING-04]
  affects: [src/renderer/components, src/renderer/store, src/renderer/hooks]
tech_stack:
  added: []
  patterns: [zustand-store, tanstack-query, collections-tree-pattern]
key_files:
  created:
    - src/renderer/store/endpoints.ts
    - src/renderer/hooks/useEndpoints.ts
    - src/renderer/components/Sidebar/EndpointsTree.tsx
    - src/renderer/components/SpringProjectPicker.tsx
    - src/renderer/components/ScanProgress.tsx
  modified:
    - src/renderer/components/Sidebar.tsx
    - src/renderer/components/StatusBar.tsx
decisions:
  - "EndpointsTree follows exact same pattern as CollectionsTree for consistency"
  - "Added 'endpoints' as first group in sidebar (primary new section)"
  - "StatusBar shows scanner status with colored dots matching UI-SPEC"
metrics:
  duration: 30min
  completed: "2026-06-06T19:55:00Z"
  tasks: 2
  files_created: 5
  files_modified: 2
---

# Phase 2 Plan 02: Sidebar EndpointsTree + Scan Progress UI Summary

**Controller-grouped endpoint tree in sidebar with colored method badges, expand/collapse, SpringProjectPicker with folder dialog, ScanProgress with indeterminate progress bar, and StatusBar scanner section.**

## Deviations from Plan

None - plan executed exactly as written.

## Auth Gates

None.

## Known Stubs

- EndpointsTree click-to-prefill is implemented but the `mutedStyle` import from CollectionsTree is unused (removed unused import)

## Threat Flags

None - all new code is UI-only with no new security surface.

## Self-Check: PASSED

All 5 created files verified present. All 2 modified files verified. TypeScript compiles with only pre-existing errors.
