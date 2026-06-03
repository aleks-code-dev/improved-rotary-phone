# Phase 1: Foundation & Postman Parity - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning
**Mode:** auto — all gray areas auto-resolved with recommended (Postman-converged) defaults

<domain>
## Phase Boundary

Phase 1 delivers the **3-process desktop architecture** (Electron renderer + Node main + Java 21 JVM helper subprocess) and ships a **fully usable Postman alternative** covering CORE-01..10:

- HTTP request building and sending (all 7 methods) with main-process undici HTTP (avoids browser CORS)
- Headers, query params, path params, body (none / form-data / url-encoded / raw / binary)
- Auth (None / Bearer / Basic / API key)
- cURL command generation and import
- Response viewer (status, headers, body, timing, search)
- 4-scope variables (Local / Data / Env / Collection / Global) with `{{name}}` substitution
- Named collections with nested folders
- Per-collection request history (cap 100)
- Postman v2.1 import/export round-trip
- 3-pane UI shell (sidebar / request editor / response viewer) with resizable splitters
- JVM helper subprocess (long-lived, supervised, restart on crash with backoff) — used later phases; not strictly required for CORE-*

The headline differentiator (Spring scanning) is **NOT in this phase** — that's Phase 2.

**Carrying forward from earlier phases / project context:**
- Stack is locked: Electron 42.3.2 + React 19.2.0 + Vite 8 + TypeScript 5.6+ + Zustand 5 + TanStack Query 5 + Zod 4 + undici 7 (main process) + Monaco + Java 21 LTS + jsonrpc4j 1.6 + safeStorage (NOT keytar). All verifications: HIGH confidence (per `research/STACK.md`).
- 3-process architecture: Renderer ↔ Main (Pattern 2 invoke/handle + Zod validation) ↔ JVM Helper (JSON-RPC 2.0 on stdio, long-lived). All HTTP goes through main process.
- Storage: JSON files in `app.getPath('userData')`; collection format = Postman v2.1 with `chains` extension; atomic writes (tmp → fsync → rename); secrets via Electron `safeStorage`.
- Database credentials: out of scope for Phase 1 (Phase 4). Helper-offline graceful degradation is required.

</domain>

<decisions>
## Implementation Decisions

### App layout (3-pane UI)

- **D-01:** **3-pane Postman-style layout.** Left sidebar (collapsible) holds Collections / Environments / History navigation. Center top = request editor (tabs for multi-open requests). Center bottom = response viewer. Resizable splitters between all three regions. Status bar at the bottom shows helper state + active env + last-save indicator.
- **D-02:** **Sidebar groups:** Collections tree (with nested folders, drag-to-reorder), Environments list (with active env indicator), History (per-collection, time-sorted). User can hide/show each group via sidebar toolbar.
- **D-03:** **Editor area has tabs** for multiple open requests. Each tab shows method badge (color-coded by verb) + truncated name + dirty indicator + close X. Middle-click or X to close. Ctrl+T opens a new tab; Ctrl+Shift+T reopens last closed.
- **D-04:** **Request editor sub-tabs:** Params (query + path), Headers, Body, Auth, Tests (placeholder for v2), Settings. Each is a sub-tab in the editor panel; only "Settings" and "Auth" are off the main flow.
- **D-05:** **Response viewer sub-tabs:** Body (pretty / raw / preview), Headers, Cookies, Timing. Pretty-JSON by default with monospace font, collapsible nodes, in-response search (Ctrl+F). Preview tab renders HTML safely (sandboxed iframe, no scripts).

### Theme & appearance

- **D-06:** **System-following theme by default** with manual dark/light override in Settings → Appearance. Both themes fully designed. Theme tokens in CSS variables; never hardcode colors.
- **D-07:** **Method badges color-coded by HTTP verb** (GET=blue, POST=green, PUT=orange, PATCH=purple, DELETE=red, HEAD/OPTIONS=gray). Standard color palette across the industry.

### Variable scoping (CORE-03)

- **D-08:** **4 scopes** with standard precedence `Local > Data > Env > Collection > Global`. Local = transient runtime values; Data = CSV/JSON-loaded test data; Env = per-environment (dev/staging/prod); Collection = per-collection; Global = across everything.
- **D-09:** **`{{name}}` syntax** in URL, headers, body. Substitution is lazy at send-time (not at edit-time). Unknown variables become `{{name}}` literal in the request and emit a warning chip on the response panel.
- **D-10:** **Variables tab** in the sidebar opens a 4-row table (one row per scope) showing all resolved variables and their source. Quick-add via + button per scope. Bulk-edit via right-click.
- **D-11:** **No script-based variable mutation in v1.** Variables are only set by the user, the active env, or the collection. (Pre-request scripts deferred to v2.)

### Body editor (CORE-05, CORE-08)

- **D-12:** **Monaco editor** for raw JSON / XML / text / GraphQL body modes. JSON language service enabled by default (auto-complete, hover docs, error squiggles, format-on-paste). Other raw modes get plain text treatment.
- **D-13:** **Form-data and url-encoded** modes use a simple key/value table (add row, remove row, dropdown for type=text/file in form-data). Binary mode = single file upload.
- **D-14:** **Mode switcher** in the body editor header: a horizontal radio row "none · form-data · url-encoded · raw · binary" with "raw" opening a content-type dropdown (JSON / XML / Text / GraphQL).
- **D-15:** **Pretty-print / format button** in the body editor toolbar when content is JSON or XML.

### cURL interop (CORE-02)

- **D-16:** **Generate cURL on every request.** "Code" dropdown in the request editor toolbar offers "Copy as cURL" (HTTPie and Fetch are deferred to v2). Output is a stable, copy-pasteable cURL command with `--data-raw` for bodies, `-u user:pass` for Basic auth (with placeholder if password is in env var), `-H` for every header.
- **D-17:** **Import cURL from clipboard / file.** File menu → Import → "cURL command" or "Raw text". Parser handles the common subset: `-X`, `-H`, `-d` / `--data` / `--data-raw`, `-u`, `-F`, `-G` / `--get` (query), `--url`. Unparseable input shows a friendly error.

### History (CORE-09)

- **D-18:** **Per-collection history** stored in `collections/<id>/history/<entryId>.json` (JSON files, not SQLite). Cap 100 per collection; oldest auto-pruned. Each entry: timestamp, request (full), response (status + headers + truncated body to 1MB), duration, env snapshot id.
- **D-19:** **History list view** in the sidebar. Click an entry → loads the request into a new tab (response is view-only, not re-sent). Right-click → "Re-send in new tab" / "Delete".
- **D-20:** **History search** within a collection: simple substring match on URL, method, and response status. Full-text on body is deferred to v2.

### Tabs (multi-request)

- **D-21:** **Tabs persist across app restarts** (last open tabs restored on launch, with unsaved-changes prompt). Tab state stored in `state.json` next to `settings.json`.
- **D-22:** **Tab drag-reorder** within the tab bar. Detach a tab into a new window is deferred to v2.

### Per-request settings (CORE-05, CORE-06)

- **D-23:** **Settings sub-tab** in the request editor. Fields: timeout (default 30000ms, max 600000ms = 10min), follow redirects (default true, max 10), SSL certificate verification (default true), "Save cookies to jar" (default false in v1 — cookie jar is v1.5). Settings are persisted on the request (not per-collection).
- **D-24:** **Timing breakdown** in the response panel: DNS / Connect / TLS / Request / Wait / Response, each in ms. Computed from undici's timing API.

### Authentication (CORE-07)

- **D-25:** **Four auth types in v1:** None, Bearer Token, Basic Auth (username + password), API Key (in header OR query). OAuth 1/2 + mTLS deferred to v2.
- **D-26:** **Auth credentials in v1 stored in environment variables** (per env), not in plain request fields. Marking a field as "secret" masks the value (••••••) with reveal button. Secrets are also written into the collection's `auth` block (Postman v2.1 shape) but masked in the UI.

### First-run & data dir

- **D-27:** **First-run data-dir picker.** On first launch, show a dialog: "Where should PostmanClone store your data?" Default = `app.getPath('userData')`. User can change. If the chosen folder is inside a known cloud-synced path (Dropbox / OneDrive / iCloud Drive / Google Drive — detected by path prefix + known folder ids), show a warning chip with explanation. (PITFALLS m-5.)
- **D-28:** **Settings page** has a "Data location" section showing the current dir, a "Change location" button, and the same cloud-sync warning. "Open data folder" reveals it in OS file manager.
- **D-29:** **No telemetry in v1.** No anonymous usage, no error reporting, no auto-update phone-home. Future-proof: error log goes to `logs/app.log` and is accessible via Help → Open logs folder.

### Helper-offline degraded mode

- **D-30:** **All CORE-01..10 work without the JVM helper.** Helper only required for SPRING (Phase 2), BODY (Phase 3), DB (Phase 4). If helper crashes, status bar shows "Helper offline — Spring features unavailable" with a "Restart helper" button.
- **D-31:** **Supervisor restart policy:** exponential backoff 1s → 2s → 4s → ... → 30s, max 3 restarts in 60s. After 3 in 60s, status turns red and user must click "Restart helper" manually. stderr → `logs/helper.log`.

### Cookie jar (deferred)

- **D-32:** **Cookie jar is OUT of v1.** Per-request cookie storage is v1.5 (CORE-09 history records cookies per response but does not auto-resend them in v1). Tracks the "manual copy" workflow.

### Proxy

- **D-33:** **Per-environment proxy.** Each env can have an optional `proxy` field (URL like `http://host:8080`). No global proxy in v1. Empty = no proxy. Proxy auth via user:pass in URL.
- **D-34:** **"Diagnose Connection" button** in Settings → Network. Runs an in-process HTTP probe (NOT renderer fetch) to the active env's base URL; shows DNS / Connect / TLS / first-byte timing. Helps users debug CORS-equivalent issues from the main process.

### Keyboard shortcuts

- **D-35:** **Essential shortcuts (v1 set):**
  - `Ctrl/Cmd+Enter` — Send request in focused tab
  - `Ctrl/Cmd+S` — Save request (prompts for collection/folder if new)
  - `Ctrl/Cmd+Shift+S` — Save As (new request in collection)
  - `Ctrl/Cmd+K` — Quick switcher (open request / collection / env by name)
  - `Ctrl/Cmd+T` — New request tab
  - `Ctrl/Cmd+W` — Close current tab
  - `Ctrl/Cmd+Shift+T` — Reopen last closed tab
  - `Ctrl/Cmd+Shift+C` — Copy as cURL
  - `Ctrl/Cmd+/` — Toggle comment in body editor (JSON/XML)
  - `Ctrl/Cmd+F` — Find in response body
  - `F1` — Help / keyboard shortcut reference

### Postman v2.1 import / export (CORE-10)

- **D-36:** **Import** accepts a `.json` Postman v2.1 collection (file picker or drag-drop). Validates against the v2.1 schema with Zod. Shows a preview ("This will import 42 requests across 3 folders into collection 'MyApp'") before commit. On commit, creates a new collection in PostmanClone.
- **D-37:** **Export** writes a v2.1-compliant collection JSON. Includes auth blocks, vars at the right scope, scripts (preserved as raw text but NOT executed), tests (preserved as raw text, not run). Chains export as a top-level `chains` extension on the collection. v2+ would add a round-trip equality test fixture.
- **D-38:** **Round-trip test:** maintain a 20+ real Postman collection fixture in `tests/fixtures/postman/` and assert import → export → re-import yields the same effective request collection. PITFALLS low-confidence area; build this in Phase 1 to de-risk Phase 5.

### Code generation (deferred)

- **D-39:** **No client code-gen in v1.** Generating a typed client (TS/Java/Python) from a request collection is v2. v1 is about being able to *send* requests, not generate code to send them from elsewhere.

### the agent's Discretion

The following are flexible — the planner/researcher can refine based on what makes sense at plan time:

- The exact keybinding for "Send" if the user has remapped `Enter` in their OS — fall back to plain `Enter` when `Ctrl+Enter` doesn't work.
- The default empty-state for new tabs (blank request vs. last-used request).
- The list of "common headers" pre-populated in the headers table (Content-Type, Accept, User-Agent?).
- Whether the response panel's timing breakdown shows in milliseconds or auto-formats (3.2s vs 3200ms).
- Exact color tokens (OKLCH vs HSL) — pick what Monaco and the rest of the UI agree on.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context

- `.planning/PROJECT.md` — Core Value, Active requirements (CORE-01..10), Constraints (desktop app, read-only on Spring project, DB drivers)
- `.planning/REQUIREMENTS.md` — Full requirement definitions + Traceability table (CORE-01..10 → Phase 1)
- `.planning/ROADMAP.md` § Phase 1 — Success criteria, dependency notes
- `.planning/STATE.md` — Current position + decisions accumulated (stack, architecture, security, body-gen model)
- `.planning/research/SUMMARY.md` — Executive summary + stack + features + architecture + pitfalls + implications (327 lines, HIGH confidence)
- `.planning/research/STACK.md` — Prescriptive stack with versions (740 lines)
- `.planning/research/ARCHITECTURE.md` — 3-process architecture in detail (558 lines)
- `.planning/research/PITFALLS.md` — 28 pitfalls with phase mapping (693 lines)
- `.planning/research/FEATURES.md` — v1/v2 split + table-stakes vs differentiators (462 lines)

### Stack component docs (pin to these)

- Electron 42 `safeStorage` (async API) — `.planning/research/STACK.md` §3 + https://www.electronjs.org/docs/latest/api/safe-storage
- Electron 42 IPC Pattern 2 (invoke/handle) — `.planning/research/STACK.md` §1 + https://www.electronjs.org/docs/latest/tutorial/ipc
- undici 7 — `.planning/research/STACK.md` §3 + https://github.com/nodejs/undici/blob/main/docs/docs/best-practices/undici-vs-builtin-fetch.md
- jsonrpc4j 1.6 (Java helper → main JSON-RPC server) — `.planning/research/STACK.md` §4 + https://github.com/briandilley/jsonrpc4j/releases
- JavaParser 3.28.1 — `.planning/research/STACK.md` §4 + https://context7.com/javaparser/javaparser
- Zod 4 IPC payload validation — `.planning/research/STACK.md` §1 + https://context7.com/colinhacks/zod
- Vite 8.0.0 + `@vitejs/plugin-react` v6 — `.planning/research/STACK.md` §2
- React 19.2.0 — `.planning/research/STACK.md` §2
- Zustand 5 + TanStack Query 5 — `.planning/research/STACK.md` §2
- Monaco + `@monaco-editor/react` — `.planning/research/STACK.md` §2
- `keytar` REJECTED (archived 2022-12-15) — `.planning/research/PITFALLS.md` C-6 + https://github.com/atom/node-keytar

### Postman format

- Postman v2.1 Collection Format — https://learning.postman.com/collection-format/working-with-collections/ + `.planning/research/STACK.md` §6
- `.planning/research/ARCHITECTURE.md` §6 — Storage layout (Postman v2.1 with `chains` top-level extension)

### JSON-RPC 2.0 (helper IPC)

- JSON-RPC 2.0 spec — https://www.jsonrpc.org/specification
- `.planning/research/ARCHITECTURE.md` §4 — Main ↔ helper IPC contract (newline-framed JSON on stdio, stdout = messages, stderr = logs)

### Pitfalls Phase 1 must avoid

- C-7: CORS / preflight — renderer `fetch` blocked; all HTTP through main via undici. `.planning/research/PITFALLS.md` + `.planning/research/ARCHITECTURE.md` §2
- M-3: Secret-aware logging from first history save. `.planning/research/PITFALLS.md`
- M-5: Data-dir cloud-sync warning. `.planning/research/PITFALLS.md`
- m-1: Cap body display at 1MB (history truncation). `.planning/research/PITFALLS.md`
- m-5: First-run data dir warning. `.planning/research/PITFALLS.md`
- m-9: Tauri/Electron capabilities scoping. `.planning/research/PITFALLS.md`
- m-10: Long-path support on Windows (`\\?\` prefix). `.planning/research/PITFALLS.md`
- C-1 + C-3 NOT applicable to Phase 1 (no DTO walking yet) — re-verify at Phase 3.

### No external specs

- No proprietary spec docs / ADRs in this repo. Stack and decisions are fully captured in `.planning/research/`. Requirements are in `.planning/REQUIREMENTS.md`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

**None yet — greenfield project.** No existing code in the repo at the start of Phase 1. The reusable assets are the **research documents** (canonical refs above) which collectively act as the "codebase context" for planning. The user is explicitly choosing the greenfield path; no legacy code to integrate with.

### Established Patterns

**Patterns from research (locked):**

- **3-process IPC pattern** (`.planning/research/ARCHITECTURE.md` §2-4):
  - Renderer → Main: `ipcRenderer.invoke` + `ipcMain.handle` (Pattern 2), channel naming `<domain>:<verb>`, all payloads Zod-validated
  - Main → JVM Helper: JSON-RPC 2.0 over stdio (newline-framed), stdout = messages, stderr = logs
  - Renderer never imports `electron` or `fs`
  - Helper never initiates network calls

- **Storage pattern** (`.planning/research/ARCHITECTURE.md` §6):
  - All persistent data under `app.getPath('userData')`
  - Atomic writes: write to `<file>.tmp` → fsync → rename
  - Collection format = Postman v2.1 with `chains` as top-level extension
  - Secrets via `safeStorage` (DPAPI/Keychain/libsecret) — not plaintext, not logged

- **State management pattern** (`.planning/research/ARCHITECTURE.md` §2 + STACK.md §2):
  - Zustand 5 for cross-tab UI state (open tabs, current selection, theme)
  - TanStack Query 5 for server-state cache (collections, environments, history reads from disk)
  - React 19 features used as they stabilize

- **HTTP client pattern** (`.planning/research/ARCHITECTURE.md` §2 + STACK.md §3):
  - All HTTP in main process via undici 7 (avoids browser CORS entirely)
  - Per-request isolated dispatcher; no shared state across requests
  - `Origin` header set deliberately to match target host

- **Helper supervisor pattern** (`.planning/research/ARCHITECTURE.md` §4):
  - Long-lived helper, not per-request (one 2-5s cold start, then ~50ms per call)
  - Restart only on crash (exponential backoff 1s→30s, max 3 in 60s)
  - stderr → `logs/helper.log` via `electron-log`

### Integration Points

- **electron-vite scaffold** (`.planning/research/STACK.md` §1 + §9): wraps main + preload + renderer in one pipeline. Phase 1's first deliverable is the scaffold.
- **electron-builder** (`.planning/research/STACK.md` §1): for packaging (squirrel/dmg/AppImage/deb). Not exercised in Phase 1 (no distribution yet), but config lands in Phase 1.
- **electron-log 5** (`.planning/research/STACK.md` §3): for file-based logging in main + preload. Used from day one of Phase 1.
- **electron-store** (`.planning/research/STACK.md` §3): for `settings.json` and `state.json` (open tabs, last-opened collection). Not for collection/env data — those use atomic-rename JSON files.
- **Zod 4** (`.planning/research/STACK.md` §2): every IPC payload has a Zod schema. The Zod schemas are the source of truth for the IPC contract.

</code_context>

<specifics>
## Specific Ideas

- **Look-and-feel anchor:** Postman / Insomnia. The user explicitly framed this as a "postman clone" and the research shows industry-converged patterns. Phase 1 should look and feel familiar to anyone who's used Postman — that's the explicit bar.
- **Java Spring developer focus:** UI labels and error messages should be developer-friendly (no marketing-speak). Response time, status code, content-type always visible. "Copy as cURL" is one click away.
- **Local-first:** No accounts, no login, no cloud sync, no telemetry. The data dir is the user's; the user can move it.
- **The 3-pane UI must be a familiar IDE pattern** (sidebar / editor / response) — not novel. Resizable splitters with remembered widths per phase.
- **"Send" is the central action** — Ctrl+Enter should always work from anywhere in the request editor. Response panel must never be modal.
- **Helper status is always visible** (status bar). The user knows in one glance whether Spring features are available.

</specifics>

<deferred>
## Deferred Ideas

These came up in research and discussion but are NOT in Phase 1 scope. Captured here so they aren't lost.

### To v1.5 or v2 (deferred to other phases)

- **Cookie jar** (auto-send cookies from prior responses) — D-32, v1.5 candidate. Add to Phase 1.5 backlog or fold into Phase 5 (chains) where cookie state across chain steps is more useful.
- **Per-request proxy** — D-33 says per-env. Per-request proxy in v2.
- **OAuth 2.0 / mTLS / OAuth1** — D-25, AUTH-01..03 in v2 Requirements.
- **Image / PDF response preview** — RESP-01 in v2.
- **Response assertions** (status, JSON path, header match) — RESP-02 in v2.
- **Pre-request scripts / test scripts** — full scripting engine deferred (REPLACES by Chain + MAP in v1, full scripting v2+).
- **Detach tab into new window** — D-22, v1.5.
- **Global search across all collections** — D-20, v2.
- **Code generation (TS/Java/Python client from request collection)** — D-39, v2.
- **HTTPie / Fetch code-gen styles** — D-16, v2 (cURL is v1).
- **Tabs persisting per-collection** (current design: persist global last-open) — could revisit in v1.5.

### Already in v1 but other phases (not Phase 1)

- **OpenAPI import** — IMPRT-01, v2.
- **Spring project scan + endpoint detection** — Phase 2 (SPRING-01..05).
- **DTO body generation from class schema** — Phase 3 (BODY-01..03).
- **DB body generation from JDBC rows** — Phase 4 (DB-01..07).
- **Request chains** — Phase 5 (CHAIN-01..05).
- **Response-to-body field mapping (drag from response tree)** — Phase 5 (MAP-01..04).

### Reviewed but not folded (from prior research)

None — no prior phase CONTEXT.md exists; this is the first phase. No folded todos from `cross_reference_todos` (no todos exist yet).

</deferred>

---

*Phase: 1-Foundation & Postman Parity*
*Context gathered: 2026-06-03*
*Mode: auto — all gray areas auto-resolved with Postman-converged recommended defaults*
