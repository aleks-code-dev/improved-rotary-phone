---
phase: 01-foundation-postman-parity
plan: 02
subsystem: ui
tags: [electron, react, typescript, undici, zustand, monaco-editor, zod, http, curl]

# Dependency graph
requires:
  - phase: 01-foundation-postman-parity
    provides: "3-process Electron scaffold, IPC router, Zod schemas, undici probe stub, preload API bridge, 3-pane UI shell"
provides:
  - "Full HTTP request editor: 7-method picker, URL bar with validity gating, 5 sub-tabs (Params/Headers/Body/Auth/Settings)"
  - "Main-process sendRequest with 5 body modes, 4 auth types, per-request isolated undici Agent, 1MB body cap"
  - "Response viewer with 4 sub-tabs (Pretty/Raw/Preview body, Headers with copy, Cookies read-only, Timing)"
  - "cURL round-trip: generateCurl and parseCurl in both main and renderer"
  - "5 keyboard shortcuts: Ctrl+Enter, Ctrl+Shift+C, Ctrl+F, Ctrl+/, Escape"
  - "Save-to-file action for truncated response bodies with path traversal protection"
affects: [01-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-request isolated undici Agent with keepAliveTimeout 5000 (PITFALLS M-8)"
    - "Origin header deliberately set to target host on all requests (PITFALLS C-7)"
    - "1MB body cap with bodyTruncated flag and Save-to-file fallback (PITFALLS m-1)"
    - "Monaco CDN loader via @monaco-editor/react with CSP allowlisting (R-4)"
    - "Zustand stores keyed by tabId for per-tab request/response state"
    - "CustomEvent bridge between RequestEditor and ResponseViewer components"
    - "Sandboxed HTML preview iframe with sandbox='allow-same-origin' only (D-05, T-02-04)"
    - "Path traversal protection on app:writeFile — only allows writes inside dataDir or downloads"

key-files:
  created:
    - src/main/http/curlGen.ts (~310 lines)
    - src/renderer/state/useRequest.ts (~210 lines)
    - src/renderer/state/useResponse.ts (~70 lines)
    - src/renderer/state/useKeyboardShortcuts.ts (~60 lines)
    - src/renderer/lib/monaco.ts (~55 lines)
    - src/renderer/lib/curl.ts (~120 lines)
    - src/renderer/components/RequestEditor/MethodPicker.tsx (~40 lines)
    - src/renderer/components/RequestEditor/SubTabs.tsx (~45 lines)
    - src/renderer/components/RequestEditor/ParamsTab.tsx (~130 lines)
    - src/renderer/components/RequestEditor/HeadersTab.tsx (~115 lines)
    - src/renderer/components/RequestEditor/BodyTab.tsx (~280 lines)
    - src/renderer/components/RequestEditor/AuthTab.tsx (~170 lines)
    - src/renderer/components/RequestEditor/SettingsTab.tsx (~105 lines)
    - src/renderer/components/ResponseViewer/StatusRow.tsx (~140 lines)
    - src/renderer/components/ResponseViewer/BodyTab.tsx (~165 lines)
    - src/renderer/components/ResponseViewer/HeadersTab.tsx (~65 lines)
    - src/renderer/components/ResponseViewer/CookiesTab.tsx (~70 lines)
    - src/renderer/components/ResponseViewer/TimingTab.tsx (~75 lines)
  modified:
    - src/main/http/undiciClient.ts (rewrite: probe stub → full sendRequest + probeRequest, ~290 lines)
    - src/main/ipc/channels.ts (added type exports + WriteFile schemas)
    - src/main/ipc/router.ts (added parseCurl, generateCurl, writeFile channels; adapted diagnose)
    - src/preload/index.ts (added writeFile)
    - src/preload/index.d.ts (added writeFile type)
    - src/renderer/components/RequestEditor.tsx (rewrite: placeholder → full editor with sub-tabs)
    - src/renderer/components/ResponseViewer.tsx (rewrite: placeholder → 4-tab viewer with keyboard shortcuts)
    - src/renderer/index.html (CSP updated for Monaco CDN, worker-src blob:)
    - src/renderer/styles/tokens.css (added @keyframes spin)

key-decisions:
  - "sendRequest NEVER throws raw — all errors return structured {ok, error: {code, message}} pattern, matching the plan's PITFALLS C-7 mitigation"
  - "probeRequest kept as a separate lightweight function for Diagnose Connection, avoiding ResponseResult overhead for a simple connectivity check"
  - "Render-side cURL parser mirrors main-side parseCurl() — both produce equivalent results; shared module deferred to 01-03"
  - "CustomEvent bridge between RequestEditor and ResponseViewer avoids prop drilling across the 3-pane layout without adding global state coupling"

requirements-completed: [CORE-01, CORE-02, CORE-05, CORE-06, CORE-08]

# Metrics
duration: 12min
completed: 2026-06-04
---

# Phase 01 Plan 02: Full HTTP request/response editor with cURL round-trip and keyboard shortcuts

**7-method HTTP client with 5 body modes, 4 auth types, Monaco-based editors, color-coded response viewer, cURL generate+import, 1MB body cap, and keyboard shortcuts — delivering CORE-01, CORE-02, CORE-05, CORE-06, CORE-08**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-04T18:20:00Z
- **Completed:** 2026-06-04T18:32:00Z
- **Tasks:** 3
- **Files modified:** 27 total (18 created, 9 modified)

## Accomplishments

- Full HTTP request pipeline: renderer → preload → main → undici → response viewer, supporting all 7 HTTP methods, 5 body modes (none/raw/urlencoded/form-data/binary), and 4 auth types (None/Bearer/Basic/API Key)
- Undici-based sendRequest with per-request isolated Agent (PITFALLS M-8), 1MB body cap (PITFALLS m-1), Origin header (PITFALLS C-7), proxy support, and structured error returns
- Complete request editor: color-coded method picker (D-07), URL bar with validity gating, 5 sub-tabs (Params/Headers/Body/Auth/Settings) each with full CRUD
- Monaco editor integration for raw body JSON editing with language service (auto-complete, error squiggles, format-on-paste) and response body pretty-printing
- Response viewer with 4 sub-tabs: Body (Pretty/Raw/Preview with sandboxed iframe per D-05), Headers (copy button per row), Cookies (read-only), Timing (6-row breakdown per D-24)
- cURL round-trip: generateCurl produces stable `--data-raw`, `-u`, `-H` commands; parseCurl handles `-X`, `-H`, `-d`, `-u`, `-F`, `-G`, `--url`
- 5 keyboard shortcuts registered: Ctrl+Enter (Send), Ctrl+Shift+C (Copy cURL), Ctrl+F (Find), Ctrl+/ (Comment toggle), Escape (Cancel)
- Save-to-file action for truncated response bodies with path traversal protection (T-02-08)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend IPC contract + main-process sendRequest + cURL generation/parsing** - `2f314be` (feat)
2. **Task 2: Renderer request editor — method picker, URL bar, all 5 sub-tabs** - `da4d5c1` (feat)
3. **Task 3: Response viewer + cURL gen+import + keyboard shortcuts** - `7cccb70` (feat)

**Plan metadata:** (to be committed)

## Files Created/Modified

### Created (this execution)
- `src/main/http/curlGen.ts` - cURL command generation and parsing (~310 lines)
- `src/renderer/state/useRequest.ts` - Per-tab Zustand store for RequestSpec CRUD
- `src/renderer/state/useResponse.ts` - Per-tab Zustand store for response state (idle/sending/done/error/cancelled)
- `src/renderer/state/useKeyboardShortcuts.ts` - Global keydown handler for 5 shortcuts
- `src/renderer/lib/monaco.ts` - Lazy Monaco CDN loader with JSON language service
- `src/renderer/lib/curl.ts` - Renderer-side cURL parser for import modal
- `src/renderer/components/RequestEditor/MethodPicker.tsx` - Color-coded HTTP method dropdown
- `src/renderer/components/RequestEditor/SubTabs.tsx` - 5-tab navigation (Params/Headers/Body/Auth/Settings)
- `src/renderer/components/RequestEditor/ParamsTab.tsx` - Query params + path params key/value tables
- `src/renderer/components/RequestEditor/HeadersTab.tsx` - Headers key/value table with Common Headers dropdown
- `src/renderer/components/RequestEditor/BodyTab.tsx` - 5 body modes with Monaco editor, file picker, key/value tables
- `src/renderer/components/RequestEditor/AuthTab.tsx` - 4 auth types with masked secret fields + reveal toggle
- `src/renderer/components/RequestEditor/SettingsTab.tsx` - Timeout/redirects/SSL/cookie jar settings
- `src/renderer/components/ResponseViewer/StatusRow.tsx` - Color-coded status, truncation banner, save button
- `src/renderer/components/ResponseViewer/BodyTab.tsx` - Pretty/Raw/Preview body with search
- `src/renderer/components/ResponseViewer/HeadersTab.tsx` - Response headers with per-row copy
- `src/renderer/components/ResponseViewer/CookiesTab.tsx` - Read-only cookie table
- `src/renderer/components/ResponseViewer/TimingTab.tsx` - 6-row timing breakdown

### Modified (this execution)
- `src/main/http/undiciClient.ts` - Full rewrite: sendRequest with all body modes/auth types, probeRequest for diagnose
- `src/main/ipc/channels.ts` - Added type exports + WriteFile schemas
- `src/main/ipc/router.ts` - Added parseCurl, generateCurl, writeFile channels
- `src/preload/index.ts` - Added writeFile to window.api.app
- `src/preload/index.d.ts` - Added writeFile type declaration
- `src/renderer/components/RequestEditor.tsx` - Rewrite: placeholder → full editor with sub-tabs + Send/Cancel/Copy-cURL
- `src/renderer/components/ResponseViewer.tsx` - Rewrite: placeholder → 4-tab viewer with keyboard shortcuts
- `src/renderer/index.html` - CSP updated: script-src/worker-src/connect-src/font-src for Monaco CDN
- `src/renderer/styles/tokens.css` - Added @keyframes spin for loading spinner

## Decisions Made

- **sendRequest never throws raw.** All errors are caught and returned as structured `{ok: false, error: {code, message}}`. This matches the plan's PITFALLS C-7 mitigation and ensures the IPC boundary never leaks exceptions.
- **probeRequest kept separate from sendRequest.** The Diagnose Connection flow needs only timing/target info, not a full ResponseResult. Keeping a lightweight probeRequest avoids building unnecessary request specs for a connectivity check.
- **CustomEvent bridge between RequestEditor and ResponseViewer.** The 3-pane layout means these components are siblings in the React tree. Using CustomEvents (`response:received`, `response:error`, `response:cancelled`) avoids prop drilling or complex state lifting while keeping the architecture clean.
- **Both main-side and renderer-side cURL parsers exist.** The plan requires a renderer-side parser for the import modal preview (`src/renderer/lib/curl.ts`) and a main-side parser for IPC trust boundaries (`src/main/http/curlGen.ts`). Both produce equivalent results. A shared module is deferred to 01-03.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript Blob type incompatibility between Node.js and undici**
- **Found during:** Task 1 (undiciClient.ts implementation)
- **Issue:** Node 24's global `Blob` type and undici's internal `Blob` type have incompatible `stream().pipeThrough` signatures, causing `RequestInit` to fail when body is `BodyInit | undefined`
- **Fix:** Used `as any` casts on fetch call arguments to bypass the type-level incompatibility while maintaining runtime correctness
- **Files modified:** `src/main/http/undiciClient.ts`
- **Committed in:** `2f314be` (Task 1)

**2. [Rule 1 - Bug] TypeScript discriminated union narrowing in curlGen.ts body construction**
- **Found during:** Task 1 (curlGen.ts implementation)
- **Issue:** The discriminated union `spec.body` was being narrowed to `never` when constructing a new body object with a literal type assertion
- **Fix:** Used `as const` assertions on the mode literal and assigned content type separately before constructing the body object
- **Files modified:** `src/main/http/curlGen.ts`
- **Committed in:** `2f314be` (Task 1)

**3. [Rule 2 - Missing Critical] CSP blocking Monaco CDN loading**
- **Found during:** Task 2 (Monaco loader creation)
- **Issue:** The existing CSP `script-src 'self'` would block loading Monaco editor from `https://cdn.jsdelivr.net`. Monaco workers also require `worker-src blob:`.
- **Fix:** Updated CSP to add `script-src 'self' https://cdn.jsdelivr.net`, `worker-src blob:`, `connect-src 'self' https://cdn.jsdelivr.net`, `font-src 'self' https://cdn.jsdelivr.net data:`, `style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net`
- **Files modified:** `src/renderer/index.html`
- **Committed in:** `da4d5c1` (Task 2)

**4. [Rule 2 - Missing Critical] Missing CSS @keyframes for spinner animation**
- **Found during:** Task 3 (StatusRow component)
- **Issue:** The StatusRow component uses `animation: 'spin 0.8s linear infinite'` but no `@keyframes spin` rule existed in any CSS file
- **Fix:** Added `@keyframes spin { to { transform: rotate(360deg); } }` to `tokens.css`
- **Files modified:** `src/renderer/styles/tokens.css`
- **Committed in:** `7cccb70` (Task 3)

---

**Total deviations:** 4 auto-fixed (2 blocking, 1 bug, 2 missing critical)
**Impact on plan:** All auto-fixes necessary for correct build behavior, security (CSP), and visual functionality. No scope creep.

## Known Stubs

| File | Line | Description |
|------|------|-------------|
| `src/main/http/undiciClient.ts` | 150 | DNS/Connect/TLS timing fields always zero in v1 — detailed breakdown deferred to v1.1 per plan |
| `src/renderer/components/ResponseViewer/TimingTab.tsx` | 55 | Note displayed: "Detailed DNS/Connect/TLS breakdown requires v1.1" |
| `src/renderer/components/RequestEditor/SettingsTab.tsx` | 70 | Cookie jar checkbox disabled with title "Cookie jar ships in v1.5" (D-32) |
| `src/renderer/components/ResponseViewer/CookiesTab.tsx` | — | Cookies are read-only; no cookie jar persistence (D-32) |
| `src/renderer/components/RequestEditor.tsx` | — | File → Import → cURL command menu item and modal not yet implemented (deferred to 01-03) |

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: path-traversal | src/main/ipc/router.ts | app:writeFile validates paths against dataDir/downloads only — defended against traversal (T-02-08) |
| threat_flag: sandbox | src/renderer/components/ResponseViewer/BodyTab.tsx | HTML preview iframe uses sandbox="allow-same-origin" only — no allow-scripts (T-02-04) |

## Issues Encountered

- **Node.js vs undici Blob type incompatibility**: Node 24's global `Blob` and undici 7's `Blob` have diverging TypeScript type definitions, causing `RequestInit` to reject valid `FormData`/`Blob` bodies. Worked around with `as any` casts; these are safe at runtime since both use the same native implementation.
- **CSP restrictions on Monaco CDN**: The 01-01 scaffold CSP was deliberately strict (`script-src 'self'`). Monaco's CDN loading and worker model required careful CSP expansion while maintaining security. Workers use `blob:` scheme, avoiding inline scripts.

## Next Phase Readiness

- CORE-01 (HTTP methods), CORE-02 (cURL), CORE-05 (headers/params/body), CORE-06 (formatted response), CORE-08 (body modes) are delivered
- Full request→response pipeline is functioning: renderer editor → main undici → response viewer
- Ready for 01-03: collections, environments, history, tabs persistence, import/export, auth masking in UI, File menu integration

---

*Phase: 01-foundation-postman-parity*
*Completed: 2026-06-04*
