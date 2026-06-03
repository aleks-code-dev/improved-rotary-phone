# Walking Skeleton — PostmanClone

**Phase:** 1
**Generated:** 2026-06-03

## Capability Proven End-to-End

> The smallest user-visible capability that exercises the full 3-process stack.

A user can launch the desktop app, see the JVM helper subprocess start in the background (status bar: `Healthy`), click "Diagnose Connection" in the request editor header, and watch a deliberately-failing HTTP probe (`http://127.0.0.1:65535/.well-known/postmanclone-probe`) flow through the renderer → main → undici → response viewer, proving the entire 3-process IPC contract works before any CORE-* feature lands.

The supervisor also survives a forced helper kill with exponential backoff (1s→30s, max 3 restarts in 60s) and surfaces "Helper offline — manual restart required" in the status bar after backoff exhaustion.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Desktop shell | **Electron 42.3.2** (over Tauri) | Tauri rejected for JDBC parity gap (Oracle/H2 in v2/Phase 4) and `fs:scope` friction. Electron is the industry default for API clients (Postman, Insomnia, Bruno are all Electron). |
| Renderer build | **Vite 8.0.0** + `@vitejs/plugin-react` v6 + **React 19.2.0** | Vite 8 ships Rolldown (10–30x faster builds). React 19 is stable; `use` hook and Actions not required for this app. |
| Language (main + renderer + preload) | **TypeScript 5.6+** | `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `satisfies` mature. Standard. |
| Renderer local state | **Zustand 5.0.12** | Tiny (~1 KB), no provider, ergonomic for cross-tab state. No Redux. |
| Renderer server state | **TanStack Query 5.90.3** | Best-in-class cache invalidation for collections/envs/history reads. |
| IPC payload validation | **Zod 4.0.1** | Every `ipcMain.handle` validates input. Source of truth for IPC contract. |
| Main-process HTTP client | **undici 7** (Node 24 built-in) | HTTP/1.1+HTTP/2, per-request isolated dispatcher, proxy agents. Sidesteps browser CORS (PITFALLS C-7). |
| Packaging / dev server | **electron-vite** + **electron-builder** | electron-vite handles 3 build targets (main/preload/renderer) in one pipeline; electron-builder for squirrel/dmg/AppImage/deb. |
| Logging | **electron-log 5.4.4** | File + console transports, 10MB rotation, secret-aware redaction (PITFALLS M-3). |
| Settings persistence | **electron-store 11.0.2** | `settings.json` + `state.json` in `userData`. Zod-validated on load. |
| Secret storage | **Electron `safeStorage` (async API)** | DPAPI/Keychain/libsecret. `keytar` is ARCHIVED 2022-12-15 — explicit REJECT. |
| JVM helper language | **Java 21 LTS** | Current LTS, virtual threads (JEP 444) fit helper's JDBC + JSON-RPC model. |
| Java JSON | **Jackson 2.21.2** | Spring ecosystem still on 2.x. Jackson 3.x deferred. |
| JSON-RPC over stdio | **jsonrpc4j 1.6** (Java side) + hand-rolled 80-line client (Node) | Newline-framed JSON on stdio, stdout = messages, stderr = logs. |
| JSON editor | **Monaco** via `@monaco-editor/react` 4.7.0 | Built-in JSON language service (auto-complete, hover, squiggles). |
| Chain field-path language | (deferred to Phase 4) | JSONata reserved for Phase 4; Phase 1 resolver is hand-rolled `{{name}}` parser. |
| Postman format | **Postman v2.1 schema** | Mature, with `chains` as top-level extension. |
| Process model | **3 processes: Renderer ↔ Main ↔ JVM Helper** | Renderer is sandboxed Chromium (no Node); main is Node 24 (IPC + HTTP + storage + JVM supervisor); helper is Java 21 (JavaParser, JDBC, future). All cross-process traffic is JSON; all IPC payloads Zod-validated. |
| IPC pattern (renderer ↔ main) | **Pattern 2: `ipcRenderer.invoke` + `ipcMain.handle`** | One request → one response, Zod-validated. Channel naming: `<domain>:<verb>`. |
| IPC pattern (main ↔ helper) | **JSON-RPC 2.0 over stdio, newline-framed** | Standard error codes, request IDs, debuggable via `nc`. |
| Storage layout | **JSON files in `app.getPath('userData')`** | Atomic writes (`<file>.tmp` → fsync → rename). PITFALLS m-5 mitigation. |
| Directory layout | **3-source roots: `src/main/`, `src/preload/`, `src/renderer/`** | Matches electron-vite defaults. JVM helper lives in separate `helper/` Gradle module at repo root. |

## Stack Touched in Phase 1

- [x] Project scaffold (electron-vite + 3 TypeScript project references + electron-builder config)
- [x] Routing — no traditional routes; IPC channels ARE the routing (`app:bootstrap`, `helper:getStatus`, `request:diagnose`, etc.)
- [x] Database — not in Phase 1; Phase 3 will use HikariCP 6.x + PostgreSQL 42.7.11 / MySQL 9.x / Oracle ojdbc11 / H2 2.3.x via JDBC in the JVM helper
- [x] UI — 3-pane shell (sidebar / request editor / response viewer / status bar) with resizable splitters, system-following theme, method badges, "Diagnose Connection" button wired through the full IPC chain
- [x] Deployment — `npm run dev` runs the full stack locally: Electron opens, JVM helper starts, status bar reaches `Healthy`, probe works

## Out of Scope (Deferred to Later Slices)

> Anything that is *not* in the skeleton. Be explicit — this list prevents future phases from re-litigating Phase 1's minimalism.

- All CORE-01..10 user-facing features (delivered in 01-02 and 01-03)
- Any user-configured HTTP request (only the diagnostic probe ships in 01-01; real send in 01-02)
- Collections save/load (01-03)
- History (01-03)
- Variable resolution (01-03)
- Auth (01-03)
- Postman import/export (01-03)
- Body editor wiring to Monaco (01-02)
- JVM-side Spring project scanning (Phase 2)
- DTO body generation (Phase 3)
- Database connections and JDBC (Phase 3)
- Request chains (Phase 4)
- Response-to-body field mapping (Phase 4)
- Auto-update (v2)
- Telemetry (v2; v1 explicitly NONE per D-29)
- Cloud sync (v2)
- Cookie jar (v1.5 per D-32)
- Tabs detach to new window (v1.5 per D-22)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- **Phase 2** (01-02): HTTP client + request/response editor. Method picker, URL bar, Send button, all 7 HTTP verbs, headers/params/body editor, response viewer with timing, cURL generate+import, 1MB body cap. Builds on: `src/main/http/undiciClient.ts` (full impl replaces skeleton stub), Monaco wiring in renderer.
- **Phase 3** (01-03): Collections, variables, auth, history, Postman v2.1 import/export. Sidebar tree, 4-scope resolver, auth masking, per-collection history JSON files, 20+ round-trip fixture. Builds on: storage service, atomic writes, secretMask helper, electron-store settings.
- **Phase 4** (Phase 2 of project): Spring project scanning. JVM helper grows JavaParser 3.28.1 + symbol-solver-core, chokidar file watching, denylist, multi-module Maven/Gradle walk, 10+ real project corpus. Renderer grows endpoint sidebar.
- **Phase 5** (Phase 3 of project): DTO body generation. Schema walker, cycle detection, Lombok hybrid walk, JSONata field-path expressions.
- **Phase 6** (Phase 4 of project): DB body generation. HikariCP pool (size 2), 4 JDBC drivers, `safeStorage` encryption, column→field mapping UI.
- **Phase 7** (Phase 5 of project): Request chains + response→body mapping. Chain orchestrator, mapping editor, run-time resolution, preview.
