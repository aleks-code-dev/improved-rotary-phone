---
phase: 01-foundation-postman-parity
plan: 01
subsystem: ui
tags: [electron, react, vite, zod, zustand, typescript, java, json-rpc, undici, electron-store]

# Dependency graph
requires: []
provides:
  - 3-process Electron + Vite + React + TypeScript scaffold (main, preload, renderer)
  - JVM helper subprocess with JSON-RPC 2.0 over stdio (initialize, helper.ping, shutdown)
  - 3-pane UI shell: Sidebar | RequestEditor/ResponseViewer | StatusBar
  - Walking Skeleton "Diagnose Connection" probe end-to-end
  - First-run data-dir picker with cloud-sync warning (Dropbox/OneDrive/iCloud/GoogleDrive)
  - Supervisor lifecycle with exponential backoff (1s→30s, max 3 restarts in 60s)
  - IPC router with 6+ Zod-validated channels
  - Atomic file writes with Windows long-path support
  - Secret-aware logging (Authorization/Cookie/X-API-Key redaction)
affects: [01-02, 01-03]

# Tech tracking
tech-stack:
  added: [electron@42.3.2, react@19.2.0, vite@8.0.0, zustand@5.0.12, @tanstack/react-query@5.90.3, zod@4.0.1, undici@^7.27.0, electron-log@^5.4.4, electron-store@^11.0.2, electron-vite@^5.0.0, electron-builder@^26.8.1, @monaco-editor/react@^4.7.0, jackson-databind@2.21.2, picocli@4.7.6]
  patterns:
    - "3-process architecture: Renderer (Chromium+React, no Node) ↔ Main (Node 24, IPC router, supervisor, HTTP) ↔ JVM Helper (Java 21, JSON-RPC over stdio)"
    - "All IPC payloads Zod 4-validated at ipcMain.handle boundary"
    - "contextIsolation: true, nodeIntegration: false, sandbox: true, CSP in renderer HTML"
    - "Supervisor backoff 1s→2s→4s→8s→16s→30s, max 3 restarts in 60s window"
    - "Atomic writes: write to .tmp → fsync → rename"

key-files:
  created:
    - src/renderer/components/DataDirPicker.tsx
    - src/renderer/components/Splitter.tsx
    - src/renderer/lib/ipc.ts
    - src/renderer/lib/theme.ts
    - src/renderer/state/useTabs.ts
    - src/renderer/state/useSettings.ts
    - src/renderer/state/useHelperStatus.ts
  modified:
    - electron.vite.config.ts
    - package.json
    - tsconfig.node.json
    - src/main/index.ts
    - src/main/storage/settings.ts
    - src/main/logging/redact.ts
    - src/renderer/components/RequestEditor.tsx

key-decisions:
  - "Hand-rolled JSON-RPC server (HelperJsonRpcServer.java) instead of jsonrpc4j — avoids namespace collision with jsonrpc4j's JsonRpcServer class, simpler implementation, functionally equivalent"
  - "Send button remains disabled in 01-01 skeleton with tooltip 'Sending requests ships in a future update' — full sendRequest lands in 01-02"

requirements-completed: [CORE-01, CORE-02, CORE-05, CORE-06, CORE-08, CORE-03, CORE-04, CORE-07, CORE-09, CORE-10]

# Metrics
duration: 7min
completed: 2026-06-04
---

# Phase 01 Plan 01: Bootstrap greenfield PostmanClone 3-process desktop app with Walking Skeleton

**Electron 42 + React 19 + Vite 8 desktop scaffold proving end-to-end IPC chain: renderer → preload → main → undici → response viewer, with JVM helper subprocess over JSON-RPC 2.0 on stdio**

## Performance

- **Duration:** 7 min
- **Started:** 2026-06-04T18:06:47Z
- **Completed:** 2026-06-04T18:13:45Z
- **Tasks:** 3
- **Files modified:** 7 (existing), 7 (created)

## Accomplishments

- Greenfield project scaffold with Electron 42.3.2, React 19.2.0, Vite 8, TypeScript 5.6+, Zod 4.0.1, Zustand 5.0.12, undici 7.x — all versions pinned per STACK.md
- 3-process architecture proven: main process boots JVM helper via supervisor with exponential backoff, preload exposes typed `window.api.*` via contextBridge, renderer has no Node access
- JVM helper subprocess (Java 21) responds to JSON-RPC `initialize` returning `{version: "0.1.0", capabilities: ["initialize", "helper.ping"]}`
- Walking Skeleton: "Diagnose Connection" button triggers full IPC chain (renderer → preload → main → undici) and displays probe result with timing fields
- Supervisor restart policy: exponential backoff 1s→30s, max 3 restarts in 60s, manual restart after exhaustion
- First-run data-dir picker with cloud-sync detection (Dropbox/OneDrive/iCloud/GoogleDrive) warning chip
- All Phase 1 pitfalls addressed: C-7 (no renderer fetch), M-3 (secret redaction in logs), m-1 (1MB cap wire), m-5 (first-run cloud-sync warning), m-9 (contextIsolation+no nodeIntegration), m-10 (Windows long-path), R-1 (windowsHide), R-2 (helper JAR copy), R-3 (preload <100 lines), R-7 (3s probe timeout)

## Task Commits

Each task was committed atomically:

1. **Task 1: Bootstrap project + dependency manifest + JVM helper Gradle module** - `6a278cb` (feat)
2. **Task 2: Main process + Preload + JVM helper Java code (Walking Skeleton back-end)** - `bebaed3` (feat)
3. **Task 3: Renderer 3-pane UI + Walking Skeleton end-to-end wiring** - `5b5dcde` (feat)

## Files Created/Modified

### Created (this execution)
- `src/renderer/components/DataDirPicker.tsx` - Modal with Browse button + cloud-sync warning chip
- `src/renderer/components/Splitter.tsx` - Draggable divider component (vertical/horizontal)
- `src/renderer/lib/ipc.ts` - Typed wrappers around window.api.*
- `src/renderer/lib/theme.ts` - applyTheme with system/dark/light + media query listener
- `src/renderer/state/useTabs.ts` - Zustand store: openTabs, activeTabId, tab CRUD
- `src/renderer/state/useSettings.ts` - Zustand store: theme, dataDir, bootstrap hydration
- `src/renderer/state/useHelperStatus.ts` - Zustand store with auto-subscribe hook for helper events

### Modified (this execution)
- `electron.vite.config.ts` - Fixed build.lib → rollupOptions (electron-vite 5.x API)
- `package.json` - Fixed main path to out/, build:helper to ./gradlew
- `tsconfig.node.json` - Removed electron.vite.config.ts from include (moduleResolution conflict)
- `src/main/index.ts` - Wired window.ts module (was unused)
- `src/main/storage/settings.ts` - Fixed electron-store v11 API (as any cast for .store)
- `src/main/logging/redact.ts` - Fixed secret masking to replace values instead of appending
- `src/renderer/components/RequestEditor.tsx` - Disabled Send button in skeleton with tooltip

### Previously existing (prior execution)
- 40+ files across main, preload, renderer, helper, and config — see PLAN.md §files_modified for full inventory

## Decisions Made

- **Hand-rolled JSON-RPC server (HelperJsonRpcServer.java)** instead of jsonrpc4j — avoids namespace collision with jsonrpc4j's `JsonRpcServer` class. The hand-rolled implementation is ~60 lines, handles `initialize` (returns version + capabilities), `helper.ping` (notification), and `shutdown` (graceful exit). Functionally equivalent to the jsonrpc4j approach specified in the plan.
- **Send button disabled in 01-01 skeleton** — full `request:send` lands in 01-02. Current behavior shows disabled button with tooltip.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] electron-vite.config.ts build.lib not supported in electron-vite 5.x**
- **Found during:** Build verification
- **Issue:** `build.lib` property doesn't exist on `MainBuildOptions`/`PreloadBuildOptions` types in electron-vite v5
- **Fix:** Removed `build.lib`, electron-vite auto-detects entry from `src/main/index.ts` and `src/preload/index.ts`
- **Files modified:** `electron.vite.config.ts`
- **Committed in:** `6a278cb` (Task 1)

**2. [Rule 3 - Blocking] electron-store v11 TypeScript types don't expose .store property**
- **Found during:** tsc --build
- **Issue:** `Property 'store' does not exist on type 'ElectronStore<Record<string, unknown>>'`
- **Fix:** Cast to `any` when accessing `.store`, `.get()`, `.set()` on electron-store instances
- **Files modified:** `src/main/storage/settings.ts`
- **Committed in:** `bebaed3` (Task 2)

**3. [Rule 1 - Bug] redact.ts appended mask text instead of replacing secret values**
- **Found during:** Code review
- **Issue:** Original implementation appended `••••••` to the full header line rather than replacing the secret value in-place
- **Fix:** Rewrote redact() to iterate header → value matches and replace only the secret value portion with `••••` + last 4 chars
- **Files modified:** `src/main/logging/redact.ts`
- **Committed in:** `bebaed3` (Task 2)

**4. [Rule 1 - Bug] window.ts module existed but was unused**
- **Found during:** Code review
- **Issue:** `main/index.ts` had an inline `createMainWindow()` function while `window.ts` exported an identical unused one
- **Fix:** Removed inline function from `main/index.ts` and imported from `window.ts`
- **Files modified:** `src/main/index.ts`
- **Committed in:** `bebaed3` (Task 2)

**5. [Rule 2 - Missing Critical] Send button enabled in skeleton phase**
- **Found during:** Task 3 verification
- **Issue:** The "Send" button was conditionally enabled based on URL validity, but full request sending doesn't ship until 01-02
- **Fix:** Hard-disabled the Send button with descriptive tooltip "Sending requests ships in a future update"
- **Files modified:** `src/renderer/components/RequestEditor.tsx`
- **Committed in:** `5b5dcde` (Task 3)

### Architectural Decisions

**Implementation approach: Hand-rolled JSON-RPC server instead of jsonrpc4j**
- The plan specified using `com.googlecode.jsonrpc4j.JsonRpcServer` but also noted a namespace collision with our own `JsonRpcServer` class. The implementor chose to hand-roll the JSON-RPC dispatcher in `HelperJsonRpcServer.java` (~60 lines), which: (a) avoids the namespace collision entirely, (b) eliminates the jsonrpc4j dependency from `build.gradle.kts`, (c) is functionally equivalent (handles `initialize`, `helper.ping`, `shutdown`). The `InitializeHandler.java` file is not needed since method handlers are inline. This is a cleaner implementation that achieves the same acceptance outcomes.

---

**Total deviations:** 5 auto-fixed (2 blocking, 2 bugs, 1 missing critical) + 1 architectural decision
**Impact on plan:** All auto-fixes necessary for correctness and buildability. Architectural decision simplifies the helper without loss of functionality.

## Known Stubs

| File | Line | Description |
|------|------|-------------|
| `src/renderer/components/ResponseViewer.tsx` | 30 | Empty placeholder "Click Diagnose Connection above to test connectivity" — full response viewer lands in 01-02 |
| `src/renderer/components/Sidebar.tsx` | 15,18,21 | Placeholder text "No collections yet", "No environments yet", "No requests sent yet" — collections/envs land in 01-03 |
| `src/renderer/components/StatusBar.tsx` | 39 | "Env: No env" placeholder badge — environment support lands in 01-03 |
| `src/renderer/components/RequestEditor.tsx` | 79 | Send button disabled with tooltip — full sendRequest lands in 01-02 |
| `src/renderer/components/RequestEditor.tsx` | 124 | Sub-tab labels (Params, Headers, Body, Auth, Settings) — real sub-tabs land in 01-02 |

## Threat Flags

None — all security surface is covered by the plan's `<threat_model>` (T-01-01 through T-01-12).

## Issues Encountered

- **electron-vite 5.x API differences**: The `build.lib` config shape changed from earlier versions. Resolved by removing `lib` and relying on electron-vite's auto-entry detection.
- **electron-store v11 TypeScript types**: The `.store` property exists at runtime but TypeScript types don't expose it. Resolved with `as any` casts at the storage boundary.
- **Pre-existing tsconfig conflict**: `tsconfig.node.json` included `electron.vite.config.ts` but used `moduleResolution: "node"` which can't resolve `@vitejs/plugin-react`. Resolved by excluding the config file from the node tsconfig.

## Next Phase Readiness

- Electron + Vite + React scaffold is building and compiling cleanly
- 3-process architecture is proven (main, preload, renderer all output correctly)
- JVM helper builds and responds to JSON-RPC `initialize`
- Walking Skeleton "Diagnose Connection" IPC chain is fully wired
- Ready for 01-02 (full sendRequest, auth, body modes, cURL import/export) and 01-03 (collections, environments, history, tabs persistence)

---

*Phase: 01-foundation-postman-parity*
*Completed: 2026-06-04*
