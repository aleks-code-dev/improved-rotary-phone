# Phase 1: Foundation & Postman Parity - Research

**Researched:** 2026-06-03
**Domain:** Desktop developer tool — 3-process architecture + Postman parity (CORE-01..10)
**Mode:** mvp (Walking Skeleton required)
**Confidence:** HIGH for stack/architecture, MEDIUM for cross-process IPC integration nuances

---

<user_constraints>
## User Constraints (from 01-CONTEXT.md)

### Locked Decisions (verbatim, paraphrased for compactness — full text in 01-CONTEXT.md)

- **D-01..D-05:** 3-pane Postman-style UI (sidebar / editor tabs / response viewer), collapsible sidebar with Collections/Environments/History groups, request-editor tabs with method badges, sub-tabs (Params/Headers/Body/Auth/Tests/Settings), response sub-tabs (Body pretty-raw-preview / Headers / Cookies / Timing).
- **D-06..D-07:** System-following theme with manual dark/light override; method badges color-coded by verb.
- **D-08..D-11:** **4 scopes** with precedence `Local > Data > Env > Collection > Global`; `{{name}}` lazy substitution at send-time; unknown variables emit warning chip; no script-based mutation in v1.
- **D-12..D-15:** Monaco for raw (JSON/XML/Text/GraphQL) body with JSON language service; form-table for form-data / url-encoded; file upload for binary; mode switcher row; pretty-print button.
- **D-16..D-17:** "Copy as cURL" on every request (stable template, `--data-raw` for body, `-u` for basic); cURL import from clipboard/file (parse `-X`, `-H`, `-d`, `-u`, `-F`, `-G`, `--url`).
- **D-18..D-20:** Per-collection history, cap 100, JSON files at `collections/<id>/history/<entryId>.json`; click loads to new tab (view-only); substring search on URL/method/status.
- **D-21..D-22:** Tabs persist across restarts; drag-reorder within bar; detach to window = v1.5.
- **D-23..D-24:** Per-request Settings (timeout max 600s, redirects max 10, SSL verify default on, cookie-jar save off in v1); timing breakdown (DNS/Connect/TLS/Request/Wait/Response) from undici.
- **D-25..D-26:** Auth = None/Bearer/Basic/API key only; credentials in env vars, masked in UI; written into collection's `auth` block but masked.
- **D-27..D-29:** First-run data-dir picker with cloud-sync detection (Dropbox/OneDrive/iCloud/Google Drive); Settings page can change it; **no telemetry in v1**; logs only at `logs/app.log`.
- **D-30..D-31:** All CORE-01..10 work **without** the JVM helper; helper required for SPRING/BODY/DB. Supervisor: exponential backoff 1s→30s, max 3 in 60s; after exhausted → user must click "Restart helper" manually. stderr → `logs/helper.log`.
- **D-32:** Cookie jar OUT of v1 (v1.5). History records cookies per response but doesn't auto-resend.
- **D-33..D-34:** Per-environment proxy (URL + optional user:pass auth). "Diagnose Connection" button in Settings → Network → in-process HTTP probe.
- **D-35:** Keyboard shortcuts — Ctrl+Enter (Send), Ctrl+S/Shift+S (Save/As), Ctrl+K (Quick switcher), Ctrl+T (New tab), Ctrl+W (Close), Ctrl+Shift+T (Reopen), Ctrl+Shift+C (Copy as cURL), Ctrl+/ (Toggle comment), Ctrl+F (Find in response), F1 (Help).
- **D-36..D-38:** Postman v2.1 import (file picker + drag-drop, Zod-validated, preview before commit) + export (lossy for `auth` but preserves blocks, scripts/tests as raw text, chains as `chains` top-level extension); **20+ real Postman collection fixture for round-trip** built in Phase 1 to de-risk Phase 5.
- **D-39:** No code-gen in v1; cURL only (HTTPie/Fetch deferred).

### the agent's Discretion

- Exact keybinding for "Send" if user remapped `Enter` OS-wide — fall back to plain `Enter` when Ctrl+Enter doesn't work.
- Default empty-state for new tabs (blank vs. last-used).
- List of "common headers" pre-populated (Content-Type/Accept/User-Agent?).
- Response timing format (ms vs auto-format `3.2s`).
- Exact color tokens (OKLCH vs HSL) — pick what Monaco agrees on.

### Deferred Ideas (OUT OF SCOPE)

- Cookie jar, per-request proxy, OAuth 2.0/mTLS/OAuth1, image/PDF preview, response assertions, pre-request scripts, detach tab to new window, global search across collections, code generation (TS/Java/Python), HTTPie/Fetch code-gen, tabs persistence per-collection, OpenAPI import — all deferred to v1.5 or v2 (per CONTEXT.md §Deferred).
- Already in v1 but other phases: SPRING-01..05 (Phase 2), BODY-01..03 (Phase 3), DB-01..07 (Phase 3), CHAIN-01..05 + MAP-01..04 (Phase 4).

### Greenfield-specific notes

- No code in repo. All "reusable assets" are the research docs in `.planning/research/` (canonical refs in CONTEXT.md §canonical_refs).
- `commit_docs: true` in `.planning/config.json` → research files commit to git.
- `nyquist_validation: false` → **skip the Validation Architecture section** (no test framework requirement).
- `mode: yolo` + `granularity: coarse` → 3 plans per phase, Walking Skeleton shape.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **CORE-01** | Build + send HTTP requests (all 7 methods) | undici 7 in main process (STACK §3); per-request isolated dispatcher (PITFALLS M-8 mitigation); method color-coding (D-07). |
| **CORE-02** | View cURL for any request + import cURL | Stable cURL template (D-16); import parser handles `-X`/`-H`/`-d`/`-u`/`-F`/`-G`/`--url` (D-17). Pure TS module, no external dep. |
| **CORE-03** | 4-scope variables with `{{name}}` substitution | Precedence `Local > Data > Env > Collection > Global` (D-08); lazy at send-time (D-09); Zod-validated storage; resolver in main, never renderer. |
| **CORE-04** | Save requests into named collections (nested folders) | Postman v2.1 storage (STACK §6); atomic-rename JSON writes (PITFALLS m-5 mitigation); `collections/<id>/collection.json` layout. |
| **CORE-05** | Set headers, query params, path params, body | undici fetch (CORE-01 path); per-tab sub-tabs (D-04). |
| **CORE-06** | Formatted response (status, headers, body, timing) | undici timing API → DNS/Connect/TLS/Request/Wait/Response (D-24); Monaco for body pretty-print. |
| **CORE-07** | Auth: None/Bearer/Basic/API key | 4 types (D-25); credentials in env vars, masked in UI (D-26); Bearer via `Authorization: Bearer <token>`; Basic via `Authorization: Basic base64(user:pass)`; API key as header or `?key=`. |
| **CORE-08** | 5 body modes (none/form-data/url-encoded/raw/binary) | Monaco for raw (D-12); form-table for form-data + url-encoded (D-13); single file upload for binary. |
| **CORE-09** | Per-collection history (cap 100) | JSON files at `collections/<id>/history/<entryId>.json` (D-18); 1MB body cap (PITFALLS m-1); secret-aware logging (PITFALLS M-3) — mask `Authorization`/`Cookie`/`X-API-Key` in history view. |
| **CORE-10** | Postman v2.1 import/export | Zod schema validation; preview before commit (D-36); 20+ fixture round-trip test (D-38); `chains` as top-level extension. |

**Coverage:** 10/10 requirements mapped to research findings. No gaps.

</phase_requirements>

---

## 1. Executive Summary

Phase 1 is a **greenfield scaffold + 3-process skeleton + Postman parity layer**. Everything needed to plan it is already locked in `.planning/research/` (STACK.md, ARCHITECTURE.md, PITFALLS.md) and in the 39 user decisions (CONTEXT.md). The planner does **not** need to evaluate alternative stacks or architectures — those decisions are final. What the planner needs is **prescriptive implementation guidance** that turns the research + decisions into 3 concrete plans (scaffold → HTTP+editor → collections/vars/auth/history/import-export) plus a Walking Skeleton that proves the end-to-end IPC path before any feature work.

The 3 plans follow the **vertical-slice-with-deps-not-features** principle: Plan 1 builds the platform (Electron + Vite + React + TS + preload IPC + JVM supervisor + storage service + logging); Plan 2 builds the first user-facing vertical (HTTP send through main → response display); Plan 3 layers collection/variable/auth/history/import-export on the proven platform. Each plan ends with a visible, testable artifact.

**Walking Skeleton definition (delivered by end of Plan 1):** `npm run dev` → Electron window opens with 3-pane shell → status bar shows "Helper: starting" then "Helper: healthy" → user can send one real HTTP request through the JVM helper handshake round-trip (a no-op `initialize` → `helper.ping` → response). This proves the 3-process IPC contract before a single CORE-* feature is built.

**Key risks Phase 1 must mitigate by design (not retrofit):** C-7 (renderer `fetch` blocked → all HTTP via main/undici), M-3 (mask auth headers in history from day one), m-1 (1MB body cap in history), m-5 (first-run data-dir picker with cloud-sync warning), m-9 (Electron `contextIsolation: true` + no `nodeIntegration` baked in from first commit), m-10 (Windows long-path support). Every one of these is addressable for <1 day of work in Plan 1, but a retrofit would cost 1+ week.

---

## 2. Stack-Specific Implementation Notes

The full stack is locked (STACK.md HIGH confidence). What follows are **prescriptive notes for each component** that the planner should use as ground-truth when writing tasks.

### 2.1 `electron-vite` scaffold (Plan 01-01)

**Single source of truth:** `STACK.md §1` + `STACK.md §9` (installation reference).

The scaffold has **three** TypeScript build targets that `electron-vite` orchestrates in one pipeline:

| Target | Source | Output | Module system |
|---|---|---|---|
| `src/main/` | `index.ts` (app lifecycle, IPC router, storage, HTTP, JVM supervisor) | `dist/main/index.js` | CommonJS (Node 24) |
| `src/preload/` | `preload.ts` (contextBridge with typed `window.api.*`) | `dist/preload/preload.js` | CommonJS (sandboxed) |
| `src/renderer/` | `src/renderer/index.html` + `main.tsx` + `App.tsx` | `dist/renderer/{index.html,assets/*}` | ESM (Vite 8 + Rolldown) |

`electron-vite` v5.0.0 produces the right Vite config automatically; the planner just needs to specify the React plugin and TypeScript path aliases. Pin `electron@42.3.2` exact (STACK §1 version-pin strategy).

**electron-builder config (lands in Plan 1, not exercised until packaging):** scaffold the `build` field in `package.json` so v1 packaging works once we're ready. Targets: NSIS (Windows), DMG (macOS), AppImage + deb (Linux).

**First-commit file layout (everything the scaffold creates):**

```
package.json
tsconfig.json              (project references: main, preload, renderer)
tsconfig.node.json         (main + preload)
tsconfig.web.json          (renderer)
electron.vite.config.ts    (electron-vite config; references the three tsconfigs)
src/
├── main/
│   ├── index.ts                    (app.whenReady, createWindow, register IPC)
│   ├── window.ts                   (BrowserWindow factory; contextIsolation on, nodeIntegration off)
│   ├── ipc/
│   │   ├── router.ts               (single ipcMain.handle dispatcher; Zod-validates every payload)
│   │   └── channels.ts             (typed channel names: 'app:showOpenDialog', 'request:send', ...)
│   ├── storage/
│   │   ├── atomicWrite.ts          (tmp → fsync → rename helper)
│   │   ├── settings.ts             (electron-store wrapper; Zod schema for settings.json)
│   │   └── paths.ts                (app.getPath('userData') + subdirs)
│   ├── http/
│   │   └── undiciClient.ts         (per-request isolated dispatcher; exports `sendRequest(req)`)
│   ├── jvm/
│   │   ├── supervisor.ts           (spawn / restart / health check; exp backoff 1s→30s, max 3/60s)
│   │   ├── client.ts               (hand-rolled 80-line JSON-RPC 2.0 over stdio client)
│   │   └── jdkDetect.ts            (JAVA_HOME / PATH / common install paths)
│   ├── logging/
│   │   └── log.ts                  (electron-log setup; file + console; correlationId)
│   └── cloudSync.ts                (Dropbox/OneDrive/iCloud/Google Drive path detection)
├── preload/
│   └── index.ts                    (contextBridge.exposeInMainWorld('api', { ... }))
├── renderer/
│   ├── index.html                  (CSP meta tag; no inline scripts)
│   ├── main.tsx                    (React 19 root)
│   ├── App.tsx                     (3-pane shell: Sidebar / RequestEditor / ResponseViewer / StatusBar)
│   ├── state/
│   │   ├── useTabs.ts              (Zustand 5; open tabs, active tab, dirty flag)
│   │   └── useSettings.ts          (theme, data-dir, helper status)
│   ├── components/
│   │   ├── Sidebar.tsx             (collapsible; groups: Collections/Environments/History)
│   │   ├── RequestEditor.tsx       (method picker + URL + tabs Params/Headers/Body/Auth/Settings)
│   │   ├── ResponseViewer.tsx      (status, headers, tabs Body/Headers/Cookies/Timing)
│   │   ├── StatusBar.tsx           (helper state + active env + save indicator)
│   │   └── Splitter.tsx            (resizable; persist widths in settings.json)
│   ├── lib/
│   │   ├── ipc.ts                  (typed wrappers around window.api.* using Zod-validated types)
│   │   └── theme.ts                (CSS variables; system-following with manual override)
│   └── styles/
│       ├── tokens.css              (CSS variables: --color-method-get, --color-method-post, ...)
│       ├── theme-dark.css
│       └── theme-light.css
└── helper/                         (separate Gradle module; Plan 1 only includes a no-op scaffold)
    ├── build.gradle.kts
    ├── settings.gradle.kts
    ├── src/main/java/com/postmanclone/helper/
    │   ├── Main.java               (picocli entry; --stdio mode (default) | --version | --health)
    │   ├── JsonRpcServer.java      (jsonrpc4j 1.6 wrapper; newline-framed stdio)
    │   └── InitializeHandler.java  (responds to {"method":"initialize"} with version + caps)
    └── gradle/wrapper/
```

### 2.2 IPC contract (Plans 01-01 and 01-02)

**Renderer → Main (Pattern 2: `ipcRenderer.invoke` + `ipcMain.handle`):** every channel is a `<domain>:<verb>` string; the payload schema is a Zod schema co-located with the channel in `src/main/ipc/channels.ts`. The handler looks up the Zod schema, calls `schema.parse(args)`, then dispatches. **Validation failure = 400-style error to the renderer (never crashes main).** Source: `ARCHITECTURE.md §4.1`.

**Initial channel set for Plan 1 (small; grows per plan):**

| Channel | Direction | Payload (Zod) | Returns |
|---|---|---|---|
| `app:bootstrap` | renderer→main | `void` | `{ settings, userDataPath, theme, helper: HelperStatus, env, jdkFound: boolean }` |
| `app:setDataDir` | renderer→main | `{ path: string }` | `{ ok: true }` |
| `app:showOpenDialog` | renderer→main | `{ kind: 'folder'\|'file', filters?: MimeFilter[] }` | `{ path: string\|null }` |
| `helper:getStatus` | renderer→main | `void` | `HelperStatus` |
| `helper:restart` | renderer→main | `void` | `HelperStatus` |
| `request:send` (Plan 2) | renderer→main | `RequestSpec` | `ResponseResult` |
| `request:cancel` (Plan 2) | renderer→main | `{ requestId: string }` | `{ ok: true }` |
| `settings:set` (Plan 3) | renderer→main | `Partial<Settings>` | `Settings` |
| `collections:*` (Plan 3) | renderer→main | per-channel | per-channel |

`HelperStatus` is the discriminated union: `{ state: 'starting' } \| { state: 'healthy', pid: number, version: string } \| { state: 'restarting', attempt: number, nextInMs: number } \| { state: 'offline', reason: string, since: number } \| { state: 'crashed', restartCount: number, reason: string }`. The status bar in the UI always shows the current state; the supervisor emits `webContents.send('helper:status', HelperStatus)` on every transition (D-31).

**Main → JVM helper (JSON-RPC 2.0 over stdio):** see `ARCHITECTURE.md §4.2`. Newline-framed, stdout = messages, stderr = logs. Hand-rolled 80-line client in main (Node side), `jsonrpc4j` 1.6 server in Java (Plan 1 only needs the `initialize` handshake + a `helper.ping` notification). The supervisor owns the lifetime; renderer never sees the helper directly.

### 2.3 undici 7 (Plans 01-01 and 01-02)

**Pin in `package.json`:** `"undici": "^7.27.0"` (or latest 7.x — verified 7.27.0 is current). Source: `STACK.md §3`.

**Per-request isolated dispatcher** (PITFALLS M-8 mitigation): every `request:send` call creates a fresh `undici.Agent` (or `undici.Pool` keyed by origin if the user wants connection reuse for a known host — but for v1, **no reuse**; fresh Agent each time is safer). The Agent has `keepAliveTimeout: 5_000`, `keepAliveMaxTimeout: 15_000` defaults; no shared state across requests.

**`Origin` header:** the request builder deliberately sets `Origin: <parsed-host>` (e.g., `Origin: http://localhost:8080`) on every outbound request. This sidesteps target-server CORS configs that key off the `Origin` header (PITFALLS C-7 mitigation, even though C-7 is already avoided by going through main).

**Timing capture:** `undici.fetch` returns a `Response` whose body stream has a `headers` iterator. To get DNS/Connect/TLS/Request/Wait/Response timings, use the `dispatch` API directly with a `Connector` or read the `response.headers` '`x-request-cost`'-style custom fields. Simpler v1 path: measure from the `undici` Response timing fields exposed via the `onHeaders` callback in the dispatcher. Source: `STACK.md §3` + undici docs.

**`sendRequest` signature (Plan 1 scaffold, Plan 2 implementation):**

```ts
// src/main/http/undiciClient.ts — REFERENCE, not for the planner to copy verbatim
import { Agent, fetch, ProxyAgent } from 'undici';

export type RequestSpec = {
  requestId: string;
  method: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE'|'HEAD'|'OPTIONS';
  url: string;                              // post-variable-resolution
  headers: Record<string, string>;
  body: BodyPayload | null;                 // discriminated union: none | form | urlencoded | raw | binary
  timeoutMs: number;                        // D-23 default 30_000
  followRedirects: boolean;                 // D-23 default true
  maxRedirects: number;                     // D-23 default 10
  sslVerify: boolean;                       // D-23 default true
  proxy?: string;                           // D-33 per-env
};

export type ResponseResult = {
  requestId: string;
  status: number;
  statusText: string;
  httpVersion: string;
  headers: Record<string, string>;
  bodyBase64: string;                       // binary-safe; cap 1MB; if larger, truncate + flag (PITFALLS m-1)
  bodyTruncated: boolean;
  bodySizeBytes: number;
  timingMs: { dns: number; connect: number; tls: number; request: number; wait: number; response: number; total: number };
  cookies: { name: string; value: string; domain?: string; path?: string; expires?: string; httpOnly?: boolean; secure?: boolean }[];
  startedAt: number;                        // epoch ms
  completedAt: number;                      // epoch ms
};

export async function sendRequest(spec: RequestSpec, signal: AbortSignal): Promise<ResponseResult> { /* ... */ }
```

### 2.4 jsonrpc4j 1.6 + hand-rolled Node client (Plan 01-01)

**Java side (helper scaffold in Plan 1):**

```java
// REFERENCE for the planner — actual code in Plan 1 task
// src/main/java/com/postmanclone/helper/JsonRpcServer.java
public class JsonRpcServer {
    public static void main(String[] args) throws IOException {
        var main = new Main();
        // jsonrpc4j binds @JsonRpcService-annotated services to a single dispatcher
        var dispatcher = new JsonRpcDispatcher(/* ... */);
        // line-buffered scanner: read one line of stdin, dispatch, write JSON-RPC response + '\n' to stdout
        try (var in = new BufferedReader(new InputStreamReader(System.in));
             var out = new PrintWriter(new OutputStreamWriter(System.out), true)) {
            // ... see jsonrpc4j 1.6 JsonRpcServer.handle(InputStream, OutputStream) ...
        }
    }
}
```

**Pin in `build.gradle.kts`:** `com.github.briandilley.jsonrpc4j:jsonrpc4j:1.6` (NOT 1.7 — it's an unreleased master branch, see `STACK.md §4` warning). Verified on Maven Central: HTTP 200.

**Node side (hand-rolled client — ~80 lines):** the client maintains a `Map<requestId, {resolve, reject}>`; on each line of stdout, parse JSON-RPC response, match `id`, resolve or reject. Notifications (no `id`) are forwarded to a `Map<method, handler[]>`. Write a request: `{"jsonrpc":"2.0","id":<n>,"method":"<m>","params":<p>}\n`. Use a write lock to prevent interleaving on stdout.

### 2.5 Zod 4 IPC payload validation (cross-cutting; baked into Plan 1)

**Pin:** `zod@4.0.1` (verified on npm). Source: `STACK.md §2`. Zod 4 has significant perf and TS inference improvements over v3; single dep covers both runtime validation and static type inference.

**Pattern:** every `ipcMain.handle(channel, async (_, args) => ...)` immediately calls `channelSchema.parse(args)`. If parse fails, the handler returns `{ ok: false, error: { code: 'INVALID_PAYLOAD', issues: zodError.issues } }` and logs at `warn` level. The renderer-side `window.api.*` wrappers unwrap the result and throw a typed error. **Source of truth for the IPC contract is the Zod schema, not a hand-written interface.** The TS types are inferred via `z.infer<typeof schema>`.

**Example (from `src/main/ipc/channels.ts`):**

```ts
import { z } from 'zod';

export const RequestSpecSchema = z.object({
  requestId: z.string().uuid(),
  method: z.enum(['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS']),
  url: z.string().url(),
  headers: z.record(z.string(), z.string()),
  body: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('none') }),
    z.object({ mode: z.literal('raw'), contentType: z.string(), text: z.string() }),
    z.object({ mode: z.literal('urlencoded'), fields: z.array(z.object({ key: z.string(), value: z.string() })) }),
    z.object({ mode: z.literal('form-data'), fields: z.array(z.object({ key: z.string(), value: z.string(), type: z.enum(['text','file']) })) }),
    z.object({ mode: z.literal('binary'), filePath: z.string(), contentType: z.string() }),
  ]),
  timeoutMs: z.number().int().min(1).max(600_000),
  followRedirects: z.boolean(),
  maxRedirects: z.number().int().min(0).max(50),
  sslVerify: z.boolean(),
  proxy: z.string().url().optional(),
});
export type RequestSpec = z.infer<typeof RequestSpecSchema>;
```

### 2.6 Electron `safeStorage` (Plan 01-03 — DB-07 in spirit; used for auth token masking in v1)

**Pin:** built-in to Electron 42. Always use the **async** API (`encryptStringAsync` / `decryptStringAsync` per `STACK.md §3` and Electron docs). The sync API may be deprecated.

**For Phase 1 the only use is structural readiness** — v1 doesn't store DB credentials (DB-01..07 are Phase 3). But the auth-token field in env vars (D-26) and the history entries (CORE-09) **must** be masked at write time. The masking is a UI concern (`••••••` display) + a serialization concern (replace value with `{ mask: '***', last4: 'a2f3' }` before writing to `collection.json` and `history/<id>.json`). This is **PITFALLS M-3** (secret-aware logging) applied from day one.

**The actual `safeStorage` API only gets exercised in Plan 3 of this phase** (if Plan 3 adds an "encrypted collection" preview) or in Phase 3 (DB-07). The pattern in Plan 1 is: create `src/main/security/secretMask.ts` that exports a `maskForStorage(value: string): { mask: '***', last4: string }` helper. Tests verify a known token round-trips through the masker. **No keychain round-trip in v1**.

### 2.7 `electron-store` (Plan 01-01)

**Pin:** `electron-store@^11.0.2` (verified). Source: `STACK.md §3`.

**Used for:** `settings.json` and `state.json` in `app.getPath('userData')`. `settings.json` schema (Zod-validated on load):

```ts
{
  version: 1,
  theme: 'system' | 'dark' | 'light',
  dataDir: string,                    // user-chosen or app.getPath('userData')
  activeEnvId: string | null,
  window: { width: number, height: number, x?: number, y?: number, maximized: boolean },
  sidebar: { collapsed: boolean, widths: { sidebar: number, response: number } },
  helper: { lastRestartReason: string | null },
  // NOT collections/envs/history — those are JSON files in subdirs
}
```

`state.json` schema: open tabs (list of `{ id, kind: 'request'|'collection', ref, dirty }`), active tab id, last-opened collection id.

**Atomicity:** `electron-store` v11 uses atomic writes internally. For our hand-rolled storage (collections, history, envs) in Plan 3, use the `atomicWrite.ts` helper (`<file>.tmp` → fsync → rename, see `STACK.md §5` and `PITFALLS m-5`).

### 2.8 `electron-log` 5 (Plan 01-01)

**Pin:** `electron-log@^5.4.4` (verified). Source: `STACK.md §3`.

**Configuration:**

```ts
// src/main/logging/log.ts
import log from 'electron-log/main';
log.transports.file.level = 'info';
log.transports.console.level = 'debug'; // dev only
log.transports.file.maxSize = 10 * 1024 * 1024;  // 10MB rotation
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {scope} {text}';
log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs', 'app.log');
log.initialize();
```

**Correlation ID:** every IPC request that triggers work in main should log with `log.scope('ipc').info(...)` and a `requestId` field. Helper logs forwarded from stderr go to `logs/helper.log` (separate file, same rotation policy). Per `ARCHITECTURE.md §10.1`.

**Secret-aware logging:** when a log line contains `Authorization: Bearer <token>` or `Cookie: <value>`, the formatter strips the value before write. Implementation: a `redact(knownSecretHeaders, line)` function in `src/main/logging/redact.ts` that runs before the file transport writes. **Built in Plan 1, not Plan 3 (PITFALLS M-3 from day one).**

### 2.9 `chokidar` 4 (NOT used in Phase 1; deferred to Phase 2)

Per `STACK.md §3` and `PITFALLS M-4`, chokidar is a Phase 2 concern (Spring project file watching). **Do not install in Plan 1 of Phase 1.** The planner should skip the dep. Pinning it in Plan 1 is a YAGNI violation.

### 2.10 `jsonata` 1.8 (NOT used in Phase 1; deferred to Phase 4)

Per `STACK.md §2`, JSONata is for chain field-path expressions (Phase 4 / CHAIN-02 / MAP-01..04). **Do not install in Phase 1.** The user decisions confirm chain variable syntax is `{{stepN.response.body.path}}` — JSONata is only the resolution engine; the syntax is simpler. The variable resolver in Plan 3 of Phase 1 is a hand-rolled `{{name}}` parser (~30 lines) that does scope-ordered lookup.

### 2.11 Renderer state (Plan 01-01)

**Zustand 5** (`zustand@5.0.12` verified) for cross-tab UI state (open tabs, active tab, sidebar widths, theme). **TanStack Query 5** (`@tanstack/react-query@5.90.3` verified) for server-state cache (collections, environments, history reads from disk). Per `STACK.md §2` and `ARCHITECTURE.md §2`. **No Redux, no Apollo** (rejected in `STACK.md §2`).

**Tab persistence (D-21):** open tabs are stored in `state.json` via `electron-store`; on app launch, main reads `state.json` and returns the open-tab list in `app:bootstrap`; renderer restores the tabs. The dirty indicator and unsaved-changes prompt are Plan 3 work.

### 2.12 `Monaco` + `@monaco-editor/react` (Plan 01-02)

**Pin:** `@monaco-editor/react@^4.7.0` (latest verified). Source: `STACK.md §2`. Body editor + response body viewer (D-12, D-05). Plan 1's renderer shell includes Monaco only as a placeholder div; Plan 2 wires it to the body editor and response viewer.

**Critical: Monaco workers.** `@monaco-editor/react` requires a worker setup. With Vite 8 + `@vitejs/plugin-react` v6, the recommended pattern is `loader.config({ paths: { vs: '/monaco/vs' } })` + `import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'` and let `@monaco-editor/react` handle worker bootstrapping via `monaco-editor` peer. **Test on first use to confirm the worker path works in Electron's file:// loading scheme** — if not, fall back to a CDN loader (`loader.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@<ver>/min/vs' } })`) for v1.

### 2.13 `react-virtuoso` 4.6.2 (Plan 01-03)

**Pin:** verified. Source: `STACK.md §2`. Used for the History list (CORE-09) and the response body tree view (CORE-06) when responses have many nodes. **Not used in Plan 1 or 2** — only Plan 3 history view.

### 2.14 JDK 21 + Gradle 8/9 (Plan 01-01)

**Verified on dev machine:** `openjdk 21.0.2 2024-01-16`, `Gradle 9.5.0`. The helper is built with Gradle Kotlin DSL per `STACK.md §4`. Plan 1 ships the **minimum viable helper**: a fat JAR that responds to `initialize` and a `helper.ping` notification, and nothing else. The full JavaParser + HikariCP + jsonrpc4j fat-jar build is Phase 2's deliverable.

**Pin in `build.gradle.kts`:** `com.github.briandilley.jsonrpc4j:jsonrpc4j:1.6`, `com.fasterxml.jackson.core:jackson-databind:2.21.2`, `info.picocli:picocli:4.7.6`. JavaParser and HikariCP are **NOT** added in Plan 1; they land in Phase 2. This is a deliberate scope cut: Plan 1 proves the IPC contract with a no-op Java side, not a full Spring scanner.

**Helper is shipped as a fat JAR (Gradle shadow plugin 8.1.1).** The main process spawns it via `child_process.spawn(java, ['-jar', helperJarPath], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })`. `helperJarPath` is `<userData>/bin/postmanclone-helper.jar` on first run; main copies the bundled JAR from `app.getAppPath()/resources/helper/postmanclone-helper.jar` to `userData` on first launch (so users can replace the JAR without rebuilding the app).

---

## 3. Walking Skeleton Design

The Walking Skeleton is the **thinnest end-to-end working slice** for Phase 1. It must be delivered by the end of **Plan 01-01** (scaffold plan). It is **not** a separate plan; it is the acceptance criterion of Plan 01-01.

### 3.1 Definition of done for the Walking Skeleton

The user can run `npm run dev` (or `pnpm dev` / `yarn dev`) and observe:

1. **Electron window opens** with the 3-pane shell (sidebar / request editor / response viewer placeholder / status bar at bottom).
2. **Status bar shows** the JVM helper transitioning: `Starting…` → `Healthy (pid <N>, v0.1.0)` within 5 seconds.
3. **Sidebar shows** a placeholder "No collections yet" in the Collections group.
4. **Request editor placeholder** has a method picker, URL bar, and a disabled "Send" button. The placeholder body says "Send a request in Plan 2."
5. **Response viewer placeholder** shows the response panel structure (status row + tabs) but is empty.
6. **A working "Diagnose Connection" button** (D-34) in the request editor header, which:
   - Calls `http://localhost:65535/.well-known/postmanclone-probe` (an intentionally-unreachable address) via the main-process undici client.
   - Shows in the response viewer: `Error: connect ECONNREFUSED 127.0.0.1:65535 · DNS 0ms · Connect 0ms · TLS 0ms · Request 1ms · Wait 0ms · Total 1ms`.
   - This proves **C-7 (main-process HTTP path)**, **the IPC contract**, and **the status bar** all work end-to-end.
7. **Logs** at `<userData>/logs/app.log` and `<userData>/logs/helper.log` exist and contain startup entries with correlation IDs.
8. **A forced helper kill** (e.g., `kill -9 <pid>` from a terminal, or a "Kill helper (debug)" button in the status bar) triggers the supervisor's restart-with-exponential-backoff policy: status bar transitions `Healthy → Restarting (attempt 1, next in 1s) → Starting → Healthy` within 3-5 seconds. Three forced kills in 60 seconds transitions to `Offline — manual restart required` and a "Restart helper" button appears (D-31).
9. **First-run data-dir picker** (D-27) appears if `userData` doesn't have a `settings.json` (i.e., first launch). User picks a folder; if it's in a known cloud-synced path, a warning chip appears below the picker (PITFALLS m-5).
10. **No exceptions in console**; the app survives a quit and relaunch with the same helper status + selected data dir.

### 3.2 What the Walking Skeleton does NOT include

- No actual request send via the UI (that's Plan 2).
- No collections save/load (that's Plan 3).
- No history (Plan 3).
- No variable resolution (Plan 3).
- No auth (Plan 3).
- No import/export (Plan 3).
- No body editor wiring to Monaco (Plan 2).
- No JVM-side Spring scanning (Phase 2).

The "Probe" feature in item 6 is the **only** end-to-end HTTP code in Plan 1, and it's a deliberately-failing request designed to exercise the undici path. This is the smallest amount of code that proves the architecture works.

### 3.3 Why a probe, not a real send

The temptation is to make the Walking Skeleton send a real request to `https://example.com` to prove HTTP works. **Don't.** A real send validates too much at once and obscures which part is broken when it fails. The probe to `127.0.0.1:65535` is **designed to fail** — and the failure is itself the validation. It proves:

- The renderer's "Diagnose" click → IPC channel `request:diagnose` → main's `sendRequest()` → undici fetch → error → error marshalling back → renderer response panel. **Every link in the chain exercised.**
- A real send in Plan 2 just changes `url` and the expected response. No new wiring.

### 3.4 Acceptance script (manual; runs in <5 minutes)

```bash
# Pre-reqs: Node 22+, JDK 21, internet access (for first-run npm install)
git clone <repo> postman-clone && cd postman-clone
npm install
npm run dev     # or: pnpm dev
```

Then in the UI:

1. Wait for status bar to show `Healthy`. (≤5s)
2. Click "Diagnose Connection" in the request editor header.
3. Observe response panel shows the expected connection-refused error with all timing fields populated.
4. Open a terminal, find the helper PID: `ps -ef | grep postmanclone-helper | grep -v grep` (macOS/Linux) or Task Manager (Windows). Note the PID.
5. Click "Kill helper (debug)" in the status bar.
6. Watch status bar: `Healthy → Restarting → Starting → Healthy` within 5s.
7. Click "Diagnose" again — should still work, proving the new helper instance is healthy.
8. Force-kill the helper 3 times rapidly. Watch status bar transition to `Offline`. Click "Restart helper" — should go back to `Healthy`.
9. Quit the app. Relaunch. Verify status bar shows `Healthy` immediately on launch (no 5s wait — supervisor re-uses prior state).
10. Open `<userData>/logs/app.log` — should contain entries for: bootstrap, JVM spawn, initialize handshake, IPC, the probe, the forced kills, the restarts. All with correlation IDs.
11. Open `<userData>/logs/helper.log` — should contain the JVM-side `{"method":"initialize"}` handling logs.

This is the **Definition of Done** for Plan 01-01. The planner writes the tasks to make this script pass.

---

## 4. Plan Decomposition Rationale

The ROADMAP.md already names 3 plans: 01-01 (scaffold), 01-02 (HTTP+editor), 01-03 (collections/vars/auth/history/import-export). This is the **right** split. The rationale is below — the planner should follow it.

### 4.1 Why 3 plans, not 1 (one big "Phase 1" plan)

A single plan would mix: building the platform, building the first user-facing feature, and building 5+ data-layer features. Each has different risk profiles and different "what's done" signals:

| Aspect | Platform (01-01) | First feature (01-02) | Data layer (01-03) |
|---|---|---|---|
| Risk | Process architecture + IPC contract (C-7, m-9) | undici timing API + Monaco in Electron (m-1) | Postman v2.1 schema + Zod round-trip (M-10) + variable resolver |
| Visibility | App launches; 3-pane shell + probe works | First real request send + response | First saved collection + first import |
| Independently shippable | Yes (Walking Skeleton) | Yes (without 01-03, you can send requests but can't save them) | No (depends on 01-01 + 01-02) |
| Test surface | Supervisor restart, IPC round-trip, status bar state machine | Real HTTP to local + cloud endpoints, Monaco editor load, response viewer | Zod round-trip, atomic writes, secret masking |

Splitting lets each plan be reviewed + verified **before** the next builds on it. A failure in Plan 1's IPC contract is recoverable; a failure discovered in Plan 3 is a refactor.

### 4.2 Why 3 plans, not 5 or 7

The natural temptation is to split further:

- 01-01: Electron + Vite + React scaffold (no JVM)
- 01-02: JVM scaffold + supervisor
- 01-03: HTTP client
- 01-04: Body editor
- 01-05: Collections / vars / auth / history / import-export

This is over-decomposed for a 2-3 week phase. The 3-process architecture is one concern, not three. The HTTP feature is one vertical (send → display). The data layer is one chunk because all 5 features (collections, vars, auth, history, import/export) share the same Zod schemas, the same storage service, and the same `electron-store` + atomic-rename pattern. **If the planner feels like splitting Plan 3 further, that's a sign Plan 3 is too large and should be revisited at planning time** — not a sign it should be split into 3 plans. The size guidance is 1-3 hours of plan work per task; Plan 3 likely has 6-9 tasks. If 9+ tasks emerge, the plan may need to be split (4 plans instead of 3) — but only at plan-time, not in research.

### 4.3 The 3 plans — what's in each

**Plan 01-01: Scaffold 3-process architecture + Walking Skeleton**

- Init `package.json`, `tsconfig.*`, `electron.vite.config.ts`, `electron-builder` config (not packaged yet).
- Install all renderer + main + preload deps (no helper deps yet).
- Init Gradle helper module: `build.gradle.kts`, `settings.gradle.kts`, gradle wrapper, `Main.java` + `JsonRpcServer.java` + `InitializeHandler.java`. Build a fat JAR. (No JavaParser, no HikariCP — that's Phase 2.)
- Main process: window factory, IPC router (Zod-validated), storage service (atomic write + electron-store for settings), logging (electron-log + redact + correlationId), jvmSupervisor (spawn / health / restart / status), jdkDetect, cloudSync detection.
- Preload: contextBridge with `window.api.{app, helper, request, settings, collections}` typed surface.
- Renderer: 3-pane shell, Sidebar (Collections/Environments/History placeholders), RequestEditor (method + URL + disabled Send), ResponseViewer (status + tabs), StatusBar, Splitter. Theme + CSS variables + system-following. Zustand store (tabs, theme) + TanStack Query client.
- Wire the "Diagnose Connection" button to `request:diagnose` channel that calls `sendRequest` against `127.0.0.1:65535`.
- First-run data-dir picker dialog.
- Walking Skeleton acceptance script passes.

**Estimated tasks:** 12-15. **Estimated effort:** 4-6 days.

**Plan 01-02: HTTP client + request/response editor (CORE-01, CORE-05, CORE-06, CORE-08, CORE-02)**

- Wire Monaco body editor (raw mode with JSON language service; XML/text/GraphQL plain text). Mode switcher radio row (none/form-data/url-encoded/raw/binary). Pretty-print button.
- Wire Monaco response body viewer (Body sub-tab: pretty/raw/preview). Pretty-JSON by default. Search-in-body (Ctrl+F). Headers sub-tab (key/value table). Cookies sub-tab. Timing sub-tab (DNS/Connect/TLS/Request/Wait/Response from undici).
- Implement `sendRequest` fully: per-request isolated undici Agent, body mode → payload conversion (raw = string body, urlencoded = `application/x-www-form-urlencoded`, form-data = multipart, binary = file stream), timeout via `AbortController`, redirect policy, SSL verify, proxy via `ProxyAgent` if set.
- Method picker with 7 verbs. Method badge color-coding (D-07).
- Request Settings sub-tab: timeout, follow redirects, max redirects, SSL verify.
- "Copy as cURL" button (D-16): stable template, `--data-raw` for raw body, `-u user:pass` for basic (placeholder if password in env var), `-H` for every header.
- Cancellation: "Cancel" button during in-flight request sends `request:cancel` with the `requestId`; main process aborts the `AbortController`.
- Body cap: 1MB in response viewer (PITFALLS m-1) — show "Body truncated at 1MB; full size: X MB" with a "Save to file" action that opens an OS save dialog.

**Estimated tasks:** 8-10. **Estimated effort:** 3-5 days.

**Plan 01-03: Collections, variables, auth, history, import/export (CORE-03, CORE-04, CORE-07, CORE-09, CORE-10)**

- Storage service: `collections/<id>/collection.json` (Postman v2.1 shape), `environments/<id>.json`, `collections/<id>/history/<entryId>.json`. All writes go through `atomicWrite.ts`. All reads validated by Zod.
- Sidebar: Collections tree with drag-to-reorder + nested folders. "New collection" / "New request" / "New folder" / "Delete" / "Rename" / "Duplicate" via right-click context menu.
- Save request (Ctrl+S): if request is not in a collection, show "Save As" dialog. If it is, write back to the collection JSON.
- Variables: 4-scope resolver in main. `{{name}}` lazy substitution at send-time. Variables tab in sidebar (4-row table, one per scope). Quick-add per scope.
- Auth: 4 types (None/Bearer/Basic/API key) in Auth sub-tab. Credentials stored in env vars, masked in UI (`••••••` + reveal button). Applied to outbound request at send time.
- History: per-collection list (Sidebar → History group). Each entry: timestamp, method, URL, status, duration. Click → loads request into new tab (response is view-only, not re-sent). Right-click → "Re-send in new tab" / "Delete". Substring search on URL/method/status. Cap 100/collection; oldest auto-pruned. **Secret masking baked in (PITFALLS M-3).**
- Postman v2.1 import: file picker + drag-drop. Zod-validated. Preview before commit. Internal model + v2.1 serialization.
- Postman v2.1 export: writes v2.1-compliant collection JSON. Includes `auth` blocks, vars at right scope, scripts (as raw text, not executed), tests (as raw text, not run). `chains` as top-level extension (empty array in v1).
- 20+ real Postman collection fixture: `tests/fixtures/postman/*.json`. A unit test that imports each, exports, re-imports, and asserts structural equality (D-38).

**Estimated tasks:** 10-12. **Estimated effort:** 4-6 days.

**Phase 1 total: ~30-37 tasks, ~11-17 days.** This matches the ROADMAP estimate of "2-3 weeks."

### 4.4 Plan ordering dependencies

```
01-01 (scaffold + Walking Skeleton)
  ↓
01-02 (HTTP + editor)
  ↓
01-03 (collections + vars + auth + history + import/export)
```

Sequential. 01-02 depends on 01-01's IPC contract + Window + StatusBar + storage. 01-03 depends on 01-02's `sendRequest` and on 01-01's storage service.

---

## 5. Validation Strategy

`config.json` has `workflow.nyquist_validation: false` — per the role's instructions, **no formal test framework requirement** for Phase 1. But "no test framework required" ≠ "no testing." The validation strategy is **manual acceptance + a minimal automated harness for the round-trip fixture only**.

### 5.1 Per-plan validation

| Plan | Manual acceptance (Definition of Done) | Automated check |
|---|---|---|
| **01-01** | Walking Skeleton script (section 3.4 above) passes in <5 minutes | None required |
| **01-02** | (a) Send a GET to `https://httpbin.org/get` and see 200 + JSON response. (b) Send a POST with raw JSON body to `https://httpbin.org/post` and see the body echoed. (c) Send a request that returns >1MB; verify truncation + "Save to file" works. (d) "Copy as cURL" produces a valid cURL command that, when pasted in a terminal, makes the same request successfully. (e) Cancel a long-running request mid-flight. (f) Force a timeout (set 1s timeout on a request that takes 10s). | None required |
| **01-03** | (a) Create a new collection, add 3 requests, save. Quit + relaunch → collection restored. (b) Define a Global var `baseUrl=https://httpbin.org`, an Env var `token=foo`, use `{{baseUrl}}/get?token={{token}}` in a request. Send → variables resolved at send time. (c) Auth: Bearer token, send to a request that echoes headers. (d) History: send 5 requests, see all 5 in history, click one, see the request loaded in a new tab. (e) Import a real Postman v2.1 collection fixture → see all requests, headers, body, auth preserved. (f) Export the imported collection, re-import the export → no data loss. (g) `Authorization: Bearer foo` in any request → history entry shows `Authorization: Bearer ••••••3a2f` (or similar masking). | Round-trip test: `tests/fixtures/postman/roundtrip.test.ts` runs in <30s and asserts `parse(export(parse(fixture))) deep-equals parse(fixture)` for 20+ fixtures |

### 5.2 Why no formal test framework

`nyquist_validation: false` per config. A test framework adds:
- 2-4 hours of setup (vitest or jest + Electron testing concerns)
- Ongoing maintenance burden
- A temptation to test trivial things ("does the Sidebar component render?" — who cares, the user can see it)

Instead, Phase 1 validation is:
- **Walking Skeleton script (5 min)** for Plan 1.
- **Per-feature manual checklist** for Plans 2 and 3.
- **One automated test** for the Postman v2.1 round-trip (Plan 3) — this is the single highest-risk area where a regression would silently break user data, so the test is worth the setup.

### 5.3 CI (deferred to v1.5)

CI setup (GitHub Actions, .github/workflows/test.yml) is not in Phase 1 scope. The repo should have a `test` script in `package.json` that runs the round-trip test, and the project owner can wire CI later.

### 5.4 What counts as a "verification step" in PLAN.md tasks

Because `nyquist_validation: false`, verification steps in PLAN.md should be **manual + reproducible**, not "run a test command." For example:

- ✅ "Verify: open the app, click Diagnose Connection, observe the response panel shows ECONNREFUSED with timing fields populated."
- ❌ "Verify: `npm test` passes." (no test framework)

For the one automated test (round-trip), the verification step can be: "Verify: `pnpm test:roundtrip` exits 0 and prints `✓ 20/20 fixtures round-trip clean`."

---

## 6. Risk Register

The risks below are **the ones Phase 1 must address by design**, plus risks newly surfaced during this research. The full pitfall list lives in `PITFALLS.md`; the table here is the Phase 1 subset + new risks.

| ID | Source | Risk | Likelihood | Impact | Mitigation in Phase 1 | Verification |
|---|---|---|---|---|---|---|
| **C-7** | PITFALLS | Renderer `fetch` blocked by browser CORS; backend CORS config doesn't whitelist desktop origin | High if missed | Total failure of CORE-01 | All HTTP in main via undici; preload never exposes `fetch`; renderer has no `fetch` wrapper in `window.api` | Walking Skeleton probe (section 3.3) proves main-path HTTP works; review: grep renderer code for `fetch(` — must be 0 matches outside of any test |
| **M-3** | PITFALLS | History entries leak `Authorization: Bearer <token>`, `Cookie`, `X-API-Key`; user shares screen → credential leak | High if missed | Security incident (P0) | `src/main/logging/redact.ts` (Plan 1); `src/main/security/secretMask.ts` (Plan 1); `historySerializer` masks known secret headers + body fields matching `access_token` / `token` / `password` (Plan 3) | Manual test: send request with `Authorization: Bearer secret-token-abc123`, open history entry, see `Authorization: Bearer ••••••c123` (last 4 preserved for identification, rest masked) |
| **M-5** | PITFALLS | User picks data dir inside Dropbox / iCloud Drive / OneDrive / Google Drive → multi-machine corruption | Medium | Data loss (silent, on next conflict) | `src/main/cloudSync.ts` (Plan 1) detects known cloud-synced path prefixes (Dropbox, OneDrive, iCloud Drive, Google Drive — both absolute paths and Windows known-folder IDs) and shows a non-blocking warning chip on first run | Manual test: pick `<userData>` inside `~/Dropbox/PostmanClone` → warning chip appears below the picker |
| **m-1** | PITFALLS | Big response body (>1MB) crashes renderer; massive JSON tree hangs Monaco | High if missed | UI freeze / OOM | `sendRequest` in main caps body at 1MB; over-cap → `bodyTruncated: true` + `bodySizeBytes: actual`; renderer shows truncation banner with "Save to file" action | Manual test: GET `https://httpbin.org/bytes/5242880` (5MB) → response panel shows truncation banner; click "Save to file" → OS save dialog → file written |
| **m-5** | PITFALLS | First-run: data-dir picker + cloud-sync warning | High if missed | Data corruption later (see M-5) | First-run flow in Plan 1: if `userData` has no `settings.json` AND no `state.json`, show data-dir picker. If chosen path matches a cloud-synced prefix, show warning chip. | Manual test: wipe `<userData>` (use a temp dir), launch app → picker appears |
| **m-9** | PITFALLS | Tauri-style capability scoping: renderer imports `fs` or `electron` directly | High if missed | Security hole; renderer escape via XSS-like flaw | `contextIsolation: true` (Electron default), `nodeIntegration: false`, `sandbox: true` where possible, `webSecurity: true`; preload only exposes `window.api.*` typed functions; **no `ipcRenderer.send` exposed** (the worst common footgun) | Review: `grep -r "require('electron')" src/renderer` must be 0; `grep -r "ipcRenderer" src/preload` must show only `contextBridge.exposeInMainWorld('api', { ... })` patterns; the preload file must be <100 lines |
| **m-10** | PITFALLS | Windows long paths (≥260 chars) fail in `Files.walk()` (Java side) and `dialog.showOpenDialog` (Electron side) | Low for Phase 1 (no project walks yet) | `ERROR_FILE_NOT_FOUND` for users with deep paths | Electron 42 manifest has `longPathAware` on by default; in Plan 1's `atomicWrite.ts`, when Windows + path > 240 chars, prepend `\\?\` to the path. Apply same to the helper's path passed to `child_process.spawn`. | Manual test (Windows): create a 270-char path, save a collection into it → file writes succeed; helper spawn works |
| **NEW R-1** | This research | First Windows run: `child_process.spawn('java', ...)` opens a console window for ~200ms (visible flash) | High | Annoying UX, looks broken | Pass `windowsHide: true` in the spawn options (per `ARCHITECTURE.md §3.3`) | Manual test on Windows: launch app → no console window flash |
| **NEW R-2** | This research | Helper JAR bundled in the app resources is not auto-updated if user replaces the JAR; or first-launch copy fails because `userData/bin/` doesn't exist | Medium | Helper fails to start; user sees "Helper offline" without explanation | Plan 1: on bootstrap, `mkdirSync(userData/bin, { recursive: true })` + check if `postmanclone-helper.jar` exists in `userData/bin/`; if not, copy from `app.getAppPath()/resources/helper/`; if that also fails (packaging bug), surface a clear error toast "Helper JAR missing — please reinstall" | Manual test: wipe `<userData>/bin/`, launch app → JAR copies; kill the helper, watch it restart from the userData copy |
| **NEW R-3** | This research | Electron 42's preload + `sandbox: true` combination restricts the preload to a small Node API surface; some libraries (e.g., chokidar, undici) cannot be `require`'d from a sandboxed preload | High | Loading undici from preload fails at runtime | All Node-only modules (undici, chokidar, electron-store) live in main, not preload. Preload is thin: only `contextBridge.exposeInMainWorld('api', { ... })` calling `ipcRenderer.invoke`. | Review: preload file size <100 lines; `grep -r "require" src/preload/` shows only `electron` (for `contextBridge` and `ipcRenderer`) |
| **NEW R-4** | This research | `@monaco-editor/react` workers may fail in Electron's `file://` loading context (monaco loads `worker.js` via dynamic import) | Medium | Body editor shows blank; or app crashes on first Monaco load | In Plan 2, when wiring Monaco, use the CDN loader pattern (`loader.config({ paths: { vs: 'https://cdn.jsdelivr.net/...' } })`) as a fallback if the local worker path fails. The downside (CDN dependency at first Monaco load) is acceptable for v1. Alternative: bundle `monaco-editor` directly in renderer and configure Vite worker plugin. | Manual test: launch app, open a tab with a raw body, type `{"x":`, see autocomplete. (Test must be done in dev mode + packaged mode — both should work.) |
| **NEW R-5** | This research | Postman v2.1 collection field order: importing a collection with non-default field order produces a different export (round-trip identity fails) | Medium | CORE-10 "lossless" claim is false; users see "I imported then exported and my file looks different" | Plan 3 task: build the 20+ fixture round-trip test **early** (as part of Plan 3 wave 0), and the test must assert structural equality, not byte equality. If a fixture fails round-trip, it's a known limitation listed in the UI ("X fields are reordered on import"). | Automated: `pnpm test:roundtrip` exits 0; for each fixture, log `✓ <name>` and the count of unchanged fields |
| **NEW R-6** | This research | Variable resolution in renderer is tempting (avoids IPC round-trip), but is a security boundary violation if done wrong (e.g., an env var with a password gets sent in a request from the renderer, leaking to the renderer's dev tools) | Medium | Security risk: dev tools can read environment variables | Variable resolution happens **only in main** at send time. Renderer sends the unresolved request (`{{name}}` literal); main resolves and sends. Renderer never sees resolved secrets. | Review: `grep -r "process.env" src/renderer` must be 0; `grep -r "resolveVariable" src/renderer` must be 0; all resolution in `src/main/variables/resolver.ts` |
| **NEW R-7** | This research | The Walking Skeleton "Diagnose Connection" probe is intentionally failing; but if the user's network is fully offline (no DNS), the probe will hang for the OS DNS timeout (~5-15s) instead of failing fast | Low for dev | Confusing first-launch UX | Plan 1: probe has its own 3s `AbortController.timeout(3000)` regardless of OS behavior; UI shows "Probe timed out after 3s — checking network…" | Manual test: disconnect wifi, click Diagnose → 3s later: "Probe timed out" |

### 6.1 Risk-driven verification

Every risk in the table has a **verification step** that's a check (manual or automated) the planner must include in the relevant PLAN.md task. The Walking Skeleton acceptance script (section 3.4) covers R-1..R-3, R-7. Plan 2 covers R-4. Plan 3 covers R-5, R-6. Plan 1's review checklists cover R-1, R-3, R-6, R-7 (and prevent them from being skipped in Plan 2/3).

---

## 7. Open Questions

**None for Phase 1 planning.** All user decisions are in `01-CONTEXT.md` (D-01..D-39). All gray areas are marked as "the agent's Discretion" with clear fallback options. The stack is locked. The architecture is locked. The pitfalls are catalogued.

The discretionary items the planner may refine at plan time (per CONTEXT.md §Discretion):

1. Exact keybinding for "Send" fallback when Ctrl+Enter is remapped OS-wide — recommendation: ship Ctrl+Enter only for v1, add plain-Enter fallback in v1.5 if user complaints.
2. Default empty-state for new tabs — recommendation: blank request (method=GET, url="", empty body) for v1, revisit if user feedback.
3. Common headers pre-populated — recommendation: ship with `[Content-Type, Accept]` only (most common), User-Agent is risky (target servers may treat unknown UAs differently).
4. Response timing format — recommendation: milliseconds only (consistent, easy to parse, copy-pasteable), auto-format (`3.2s`) is v1.5 polish.
5. Color tokens (OKLCH vs HSL) — recommendation: OKLCH (modern, perceptually uniform, Monaco agrees via CSS variables).

These are not blockers. The planner can pick defaults without asking the user.

---

## Package Legitimacy Audit

> Per the package legitimacy gate protocol. **slopcheck is NOT available in this environment** (pip install failed silently). Per protocol, every recommended package is marked `[ASSUMED]`. The planner must gate each install behind a `checkpoint:human-verify` task per the rules in the role's package_legitimacy_protocol §Graceful degradation. **No packages were flagged SLOP because slopcheck could not run.**

| Package | Registry | Version Verified | Postinstall? | Slopcheck | Disposition |
|---------|----------|------------------|--------------|-----------|-------------|
| `electron` | npm | 42.3.2 | none | unavailable → `[ASSUMED]` | Approved, gated |
| `electron-vite` | npm | 5.0.0 | none | unavailable → `[ASSUMED]` | Approved, gated |
| `electron-builder` | npm | 26.8.1 | none | unavailable → `[ASSUMED]` | Approved, gated |
| `vite` | npm | 8.0.0 | none | unavailable → `[ASSUMED]` | Approved, gated |
| `@vitejs/plugin-react` | npm | 6.0.x (latest) | none | unavailable → `[ASSUMED]` | Approved, gated |
| `react` | npm | 19.2.0 | none | unavailable → `[ASSUMED]` | Approved, gated |
| `react-dom` | npm | 19.2.0 | none | unavailable → `[ASSUMED]` | Approved, gated |
| `typescript` | npm | 5.6.x (latest) | none | unavailable → `[ASSUMED]` | Approved, gated |
| `zustand` | npm | 5.0.12 | none | unavailable → `[ASSUMED]` | Approved, gated |
| `@tanstack/react-query` | npm | 5.90.3 | none | unavailable → `[ASSUMED]` | Approved, gated |
| `zod` | npm | 4.0.1 | none | unavailable → `[ASSUMED]` | Approved, gated |
| `@monaco-editor/react` | npm | 4.7.0 (latest) | none | unavailable → `[ASSUMED]` | Approved, gated |
| `undici` | npm | 7.27.0 (latest 7.x) | none | unavailable → `[ASSUMED]` | Approved, gated |
| `electron-log` | npm | 5.4.4 (latest 5.x) | none | unavailable → `[ASSUMED]` | Approved, gated |
| `electron-store` | npm | 11.0.2 (latest) | none | unavailable → `[ASSUMED]` | Approved, gated |
| `com.github.javaparser:javaparser-symbol-solver-core` | Maven Central | 3.28.1 | n/a | unavailable → `[ASSUMED]` | **DEFERRED to Phase 2** (not installed in Phase 1) |
| `org.ow2.asm:asm` | Maven Central | 9.7 | n/a | unavailable → `[ASSUMED]` | **DEFERRED to Phase 2** |
| `com.fasterxml.jackson.core:jackson-databind` | Maven Central | 2.21.2 | n/a | unavailable → `[ASSUMED]` | Approved, gated (used by helper scaffold) |
| `com.github.briandilley.jsonrpc4j:jsonrpc4j` | Maven Central | 1.6 | n/a | unavailable → `[ASSUMED]` | Approved, gated (used by helper scaffold) |
| `info.picocli:picocli` | Maven Central | 4.7.6 | n/a | unavailable → `[ASSUMED]` | Approved, gated (used by helper scaffold) |

**Packages removed due to slopcheck [SLOP] verdict:** None (slopcheck unavailable).
**Packages flagged as suspicious [SUS]:** None.
**Versions verified against registry:** All `[VERIFIED: npm/Maven Central]` for package existence and current major/minor. The `[ASSUMED]` tag applies because slopcheck could not run for legitimacy scoring; the registry-existence check alone is not sufficient to remove the assumption flag (per the role's Package name provenance rule).

**Note on the dev environment:** Node 22.13.0 is installed (Electron 42 ships with Node 24 internally, which is what runs at app startup — Node 22 is only used for `npm install` + dev CLI). npm 10.9.2, JDK 21.0.2, Gradle 9.5.0 are all available. `python3 pip` is broken (`slopcheck` install fails) — flag this as a known env gap; the planner should note that no automated package-legitimacy scoring is available and rely on the human-verify checkpoint per the protocol's graceful-degradation rule.

---

## Security Domain

> Required by role (security_enforcement absent = enabled). This is the Phase 1 subset.

### Applicable ASVS Categories

| ASVS Category | Applies to Phase 1 | Standard Control |
|---------------|---------------------|------------------|
| V1 Architecture | yes | 3-process architecture (ARCHITECTURE.md §1, §2); renderer is untrusted |
| V2 Authentication | partial | Auth types in CORE-07 (None/Bearer/Basic/API key); no user accounts in v1 (single-user local tool per PROJECT.md) |
| V3 Session Management | no (Phase 1) | Cookie jar deferred to v1.5 (D-32) |
| V4 Access Control | yes | Helper read-only on Spring project (Phase 2+; not exercised in Phase 1) |
| V5 Input Validation | yes (critical) | Zod 4 schemas at every `ipcMain.handle` (PITFALLS C-7, m-9 mitigations) |
| V6 Cryptography | partial | Electron `safeStorage` pattern ready (not exercised in Phase 1; exercised in Phase 3 for DB credentials) |
| V7 Error Handling | yes | All IPC errors return `{ ok: false, error: { code, message } }` — never throw raw |
| V9 Communication | yes | All HTTP from main via undici; no renderer `fetch` to user targets |
| V14 Configuration | yes | `electron-store` settings.json validated by Zod on load |

### Known Threat Patterns for Phase 1 stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Renderer XSS injects `fetch` to malicious target | Tampering / Spoofing | `contextIsolation: true` + `nodeIntegration: false` + no `fetch` in `window.api.*`; renderer has no HTTP capability |
| Stolen `Authorization: Bearer` from history export | Information Disclosure | Secret masking in history serializer (PITFALLS M-3); "Redact before share" toggle on export (D-26 follow-on) |
| Malicious collection JSON imported → arbitrary code exec | Tampering / Elevation | Zod-validated import; ALL fields are typed; `script.exec` and similar dynamic fields are stored as **raw text** and **never executed** (per D-37) |
| Malicious Spring project (when Phase 2 lands) — read access expands | Information Disclosure | Helper has no `Files.write` to project paths; helper validates every path with `path.startsWith(projectRoot)` |
| `child_process.spawn` argument injection (e.g., `java -jar <user-controlled-path>`) | Tampering / Elevation | The helper JAR path comes from `app.getAppPath()` (app-controlled), not user input. The JDK path comes from `jdkDetect` which validates against a known list. If a user injects a JDK path via env var, it's their machine — not our threat. |
| Long-path file enumeration on Windows (m-10) | Denial of Service | Cap path length in atomic write; use `\\?\` prefix on Windows for paths > 240 chars |

### Security checklist for Phase 1 (every plan verifies)

- [x] `contextIsolation: true` (Electron 42 default)
- [x] `nodeIntegration: false`
- [x] `sandbox: true` where possible (preload exposes only typed functions)
- [x] `webSecurity: true`
- [x] CSP set in renderer `index.html` (no inline scripts, no remote script loads except the Monaco CDN fallback in Plan 2)
- [x] All `ipcMain.handle` validates input with Zod
- [x] No `ipcRenderer.send` exposed in preload (only `invoke`)
- [x] `window.api.*` surface is a closed enum; no `Function` or `Object` types in the surface
- [x] All persistence uses atomic-rename JSON writes
- [x] Logs redact `Authorization` / `Cookie` / `X-API-Key` / `Proxy-Authorization` (PITFALLS M-3)
- [x] No network calls except user-configured targets (no telemetry, no auto-update, no analytics — D-29)
- [x] First-run data-dir picker with cloud-sync warning (D-27, m-5)
- [x] Helper has no write access to user project paths (Phase 2+; not exercised in Phase 1)
- [x] `electron-builder` config in Plan 1 sets `asar: true` (default) so the source tree is not extractable in the packaged app

---

## Sources

### Primary (HIGH confidence — already in `.planning/research/`)

- `.planning/research/STACK.md` — version-pinned stack (Electron 42.3.2, React 19.2.0, Vite 8.0.0, etc.); all choices verified against Context7 or official docs in the original research.
- `.planning/research/ARCHITECTURE.md` — 3-process architecture, IPC contract, JSON-RPC stdio, storage layout, build order.
- `.planning/research/PITFALLS.md` — 28 pitfalls with phase mapping; the Phase 1 subset is called out in section 6 above.
- `.planning/research/SUMMARY.md` — executive summary + confidence assessment.
- `.planning/research/FEATURES.md` — table-stakes vs differentiators; v1/v2 split rationale.
- `.planning/phases/01-foundation-postman-parity/01-CONTEXT.md` — 39 user decisions (D-01..D-39), canonical references, greenfield notes.
- `.planning/REQUIREMENTS.md` — CORE-01..10 definitions and traceability.

### Tooling verification (this session)

- npm registry: confirmed all `package.json` deps exist at stated versions (`electron@42.3.2`, `react@19.2.0`, `vite@8.0.0`, `zod@4.0.1`, `undici@7.27.0`, `electron-store@11.0.2`, `electron-log@5.4.4`, etc.).
- Maven Central: confirmed `com.github.javaparser:javaparser-symbol-solver-core:3.28.1`, `org.ow2.asm:asm:9.7`, `com.fasterxml.jackson.core:jackson-databind:2.21.2`, `com.github.briandilley.jsonrpc4j:jsonrpc4j:1.6`, `info.picocli:picocli:4.7.6` (all HTTP 200).
- No postinstall scripts on any npm dep (verified by `npm view <pkg> scripts.postinstall`).
- Dev environment: Node 22.13.0, npm 10.9.2, OpenJDK 21.0.2, Gradle 9.5.0 all installed and on PATH.
- **slopcheck is unavailable** (`pip install` fails on this Windows machine); all packages tagged `[ASSUMED]` per protocol.

### New risks identified during this research

Documented in section 6 (Risk Register):
- R-1: Windows console window flash on `child_process.spawn('java')`
- R-2: First-launch helper JAR copy from app resources to `userData/bin/`
- R-3: `sandbox: true` restricts preload to a small Node surface; no Node-only modules in preload
- R-4: Monaco workers in Electron `file://` context
- R-5: Postman v2.1 round-trip identity is structural, not byte-exact
- R-6: Variable resolution must happen in main, never renderer
- R-7: Walking Skeleton probe needs its own `AbortController.timeout(3000)` for fast failure

### Tertiary (LOW confidence — flagged for validation during implementation)

- Real-world Postman v2.1 round-trip edge cases (no formal spec; build 20+ fixture in Plan 3 — D-38)
- Monaco worker path in Electron packaging (test in Plan 2; fallback to CDN loader)
- HikariCP behavior in long-lived desktop process (NOT a Phase 1 concern; Phase 3)

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Standard stack | **HIGH** | All packages verified on npm/Maven Central; STACK.md marked HIGH; this research did not re-evaluate alternatives |
| Architecture | **HIGH** | 3-process model + IPC contract locked in ARCHITECTURE.md; this research confirmed via CONTEXT.md |
| Walking Skeleton design | **HIGH** | The "Diagnose Connection" probe is a well-known Electron main-process-HTTP pattern; the supervisor restart policy is from D-31 verbatim |
| Plan decomposition (3 plans) | **MEDIUM-HIGH** | Follows ROADMAP.md; rationale given in section 4 is sound but planner may need to split Plan 3 into 4 plans if 12+ tasks emerge |
| Per-plan validation | **HIGH** | `nyquist_validation: false` removes the formal test-framework requirement; manual acceptance scripts are sufficient for the table-stakes baseline |
| Package legitimacy | **LOW** (forced) | slopcheck unavailable in this env; per protocol, all packages `[ASSUMED]` and gated behind `checkpoint:human-verify` per planner's discretion |
| Security Domain | **MEDIUM-HIGH** | ASVS categories are well-known; specific mitigations map to PITFALLS.md items that are HIGH confidence; CSP and `contextIsolation` are Electron defaults |

**Research date:** 2026-06-03
**Valid until:** 2026-07-15 (stack components are stable; npm/Gradle lock at minor versions; main risk is Electron major version drift, but 42.x is supported through ~Q1 2027 per Electron's support policy)

**Ready for planning:** Yes. Planner can create `01-01-PLAN.md` directly from this research + the Plan 01-01 task list in section 4.3. No further research is needed for Phase 1.
