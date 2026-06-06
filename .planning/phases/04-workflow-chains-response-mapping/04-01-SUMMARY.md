---
phase: 04-workflow-chains-response-mapping
plan: 01
subsystem: chains
tags: [chain, orchestrator, ipc, persistence, jsonata]
key-files:
  created:
    - src/main/chains/orchestrator.ts
    - src/main/chains/resolver.ts
    - src/main/chains/validator.ts
  modified:
    - src/shared/schemas/collection.ts
    - src/main/ipc/channels.ts
    - src/main/ipc/router.ts
    - src/main/storage/collections.ts
    - src/preload/index.ts
    - package.json
metrics:
  files_created: 3
  files_modified: 7
  commits: 1
---

# Plan 04-01: Chain Data Model, Orchestrator, IPC, and Persistence

## What Was Built

Established the chain execution engine in the main process. Installed jsonata@1.8.7 for `{{stepN.response.body.path}}` reference resolution. Defined ChainSchema, ChainStepSchema, and StepResultSchema replacing the `z.unknown()` placeholder in collection.ts. Created the chain orchestrator with sequential step execution via undici, per-step timeout/retry (D-02, D-23), abort control (D-21), selective re-run from step N using cached results (D-04), and progress streaming to renderer via `webContents.send`. Created the reference resolver using JSONata 1.8.7 (synchronous evaluate). Created the chain validator with circular reference detection via DFS (D-22). Added chain CRUD functions to collections storage. Added chain IPC handlers for create, update, delete, run, stop, validate, and previewResolved. Added the chains namespace to the preload bridge with event listeners for progress, stepResult, complete, and validationFailed events.

## Deviations

None — all decisions follow the locked CONTEXT.md decisions D-01..D-23 and RESEARCH.md patterns.

## Self-Check

PASSED — TypeScript compiles with no errors. All schemas validate. IPC handlers follow the established pattern from router.ts. Preload namespace matches the WindowApi interface convention.

## Commits

| Commit | Description |
|--------|-------------|
| 23df11b | feat(04-01): chain data model, orchestrator, IPC, and persistence |
