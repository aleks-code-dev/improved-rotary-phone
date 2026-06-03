# Architecture — PostmanClone

**Project:** PostmanClone (Postman-like desktop API client for Java Spring developers)
**Researched:** 2026-06-03
**Mode:** Ecosystem / prescriptive architecture for greenfield
**Confidence:** HIGH (Electron + Node.js child process patterns are mature and well-documented)

---

## 1. Executive Summary

PostmanClone is a **multi-process desktop application** with three runtime tiers:

1. **Renderer (Chromium / React UI)** — pure presentation, no Node access, talks only via the contextBridge.
2. **Main process (Electron main, Node.js)** — owns filesystem, storage, HTTP client, chain runner, app lifecycle, and the **supervises the JVM helper**.
3. **JVM helper (long-lived Java subprocess)** — owns all Java-specific work: JavaParser-based Spring scanning, DTO schema extraction, JDBC connections, DB-driven body generation. Communicates with the main process via **JSON-RPC 2.0 over stdin/stdout**.

All cross-process traffic is JSON. The renderer never touches the JVM directly — every request funnels through the main process, which validates inputs, manages caches, and dispatches.

**Host framework choice: Electron** (not Tauri). The project needs (a) spawning a long-lived Java subprocess, (b) full HTTP client control, (c) mature filesystem APIs, (d) JDBC drivers are Java-only and Tauri/Rust has poor Oracle/H2 coverage. The user constraint already permits Electron, and Electron's `child_process.spawn` is the cleanest path to a JVM helper.

**Why three processes (not two):**

| Concern | Why not in renderer | Why not in main | Why JVM helper |
|---|---|---|---|
| Java source parsing | No Node access | JavaParser is Java-only; reinventing AST parsing in JS is fragile | First-class |
| DTO schema resolution | — | No classpath | Loads project's classes |
| JDBC for Postgres/MySQL/Oracle/H2 | — | Node drivers are spotty (Oracle, H2 especially) | JDBC is universal |
| Crash isolation | Renderer crash loses UI only | Main crash kills app | Helper crash recoverable, restartable |
| Cold-start of heavy JVM | — | — | Pre-warm once, reuse |

---

## 2. Component Map

```
┌──────────────────────────────────────────────────────────────────────┐
│                      RENDERER (Chromium + React)                      │
│  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌────────┐ ┌────────────────┐  │
│  │ Sidebar │ │ Request  │ │Response │ │ Body   │ │ Chain Runner   │  │
│  │ (colls/ │ │ Editor   │ │ Viewer  │ │ Gen    │ │ UI             │  │
│  │  ctrls) │ │          │ │         │ │ Panel  │ │                │  │
│  └────┬────┘ └─────┬────┘ └────┬────┘ └───┬────┘ └──────┬─────────┘  │
│       └────────────┴───────────┴───────────┴─────────────┘            │
│                              │ window.api.*                            │
│                              ▼                                         │
│                      preload.js (contextBridge)                        │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ ipcRenderer.invoke / ipcRenderer.on
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│              MAIN PROCESS (Electron main, Node.js / TS)               │
│  ┌────────────┐ ┌─────────────┐ ┌────────────┐ ┌──────────────────┐  │
│  │  Window &  │ │   Storage   │ │ HTTP Client│ │  Chain Runner    │  │
│  │  Lifecycle │ │   Service   │ │ (Node http │ │  (orchestrator)  │  │
│  │            │ │  (files)    │ │  /undici)  │ │  + var context   │  │
│  └────────────┘ └──────┬──────┘ └────────────┘ └──────────────────┘  │
│                        │                                              │
│  ┌─────────────────────┴──────────────────────────────────────────┐  │
│  │   IPC Router  (validates, dispatches, applies rate/auth gates) │  │
│  └────┬──────────────┬─────────────┬──────────────┬───────────────┘  │
│       │              │             │              │                   │
│  ┌────▼─────┐  ┌─────▼─────┐  ┌────▼──────┐  ┌────▼────────────┐    │
│  │ Project  │  │ Collection│  │ Env /     │  │  JVM Helper     │    │
│  │ Scanner  │  │ Service   │  │ Variable  │  │  Supervisor     │    │
│  │ (fs walk)│  │           │  │ Resolver  │  │  (lifecycle,    │    │
│  │          │  │           │  │           │  │   health, retry)│    │
│  └──────────┘  └───────────┘  └───────────┘  └────┬─────────────┘    │
└───────────────────────────────────────────────────┼──────────────────┘
                                                    │ child_process.spawn
                                                    │ stdio: ['pipe','pipe','pipe']
                                                    │ JSON-RPC 2.0
                                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                JVM HELPER (long-lived Java 17 subprocess)              │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────────┐    │
│  │  Spring        │  │  DTO Schema    │  │  DB Connector        │    │
│  │  Scanner       │  │  Resolver      │  │  (JDBC pool)         │    │
│  │  (JavaParser + │  │  (JavaParser + │  │  Postgres/MySQL/     │    │
│  │  walk .java)   │  │   class load)  │  │  Oracle/H2           │    │
│  └────────┬───────┘  └────────┬───────┘  └──────────┬───────────┘    │
│           └──────────────────┬┴──────────────────────┘                │
│                              │                                         │
│                    ┌─────────▼──────────┐                              │
│                    │  JSON-RPC server   │  ← stdin/stdout              │
│                    │  (PicoCLI /        │                              │
│                    │   custom)          │                              │
│                    └────────────────────┘                              │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.1 Component Boundaries (who talks to whom)

| Boundary | Direction | Mechanism | Payload |
|---|---|---|---|
| Renderer ↔ Main | Both ways | `ipcRenderer.invoke` + `ipcMain.handle` (Pattern 2 from Electron docs) + `webContents.send` for unsolicited events | JSON over Electron IPC |
| Renderer ↔ Preload | Both ways | `contextBridge.exposeInMainWorld('api', { ... })` | Typed function refs |
| Main ↔ JVM helper | Both ways | `child_process.spawn` with piped stdio, JSON-RPC 2.0 framed by newline | JSON-RPC request/response objects |
| Main ↔ Filesystem | Read + write (own data dir + read-only on Spring project) | `fs/promises`, watch for file changes | Files |
| JVM helper ↔ Spring project | **Read-only** (per security constraint) | `java.nio.file`, recursive walk | Files |
| JVM helper ↔ User DB | JDBC (read + DML) | `java.sql.Connection` from a pooled `HikariCP` | Queries |
| Main ↔ Target API server | Outbound HTTP/S | `undici` (Node 18+ has fetch) | HTTP request/response |

**Hard rule:** The renderer **never** imports `electron`, `fs`, or anything Node-specific. The only API surface it sees is `window.api.*` exposed by the preload.

**Hard rule:** The JVM helper **never** initiates network calls to the Spring project source control or anywhere else. It is a pure read-only consumer of files + a JDBC client. It cannot phone home.

---

## 3. Process Model — Detailed

### 3.1 Why a long-lived JVM helper, not per-request Java

| Aspect | Per-request `java -jar` | Long-lived helper (recommended) |
|---|---|---|
| Cold start | 2-5s per call (JVM + classpath load) | One 2-5s hit, then ~50ms per call |
| Classpath resolution | Re-resolved each call | Cached for project lifetime |
| JDBC connections | Opened/closed each call | Pooled (HikariCP) |
| IPC complexity | Stateless request/response | Stateful: open project, query classes, run query |
| Failure mode | Whole call fails | Helper crash → supervisor restarts, UI shows degraded state |
| Memory | Bounded per call | Bounded by project size; can pre-warm |

The helper **does not** restart on every project change. The supervisor process kills and respawns the helper only on:
- Explicit user action (e.g., "reload project")
- Helper crash (exit code != 0)
- JVM heap threshold breach (if metrics are wired)
- Schema-breaking protocol change (version mismatch)

### 3.2 Main process — what lives here vs. the helper

| Capability | Main process (Node) | JVM helper (Java) |
|---|---|---|
| Window/menu/clipboard | ✅ | ❌ |
| Filesystem walk (project root) | ✅ (returns file list to JVM) | Receives file list |
| HTTP client (send to target APIs) | ✅ (undici) | ❌ |
| cURL command generation | ✅ | ❌ |
| Collection/environment/history CRUD | ✅ (JSON files) | ❌ |
| Chain orchestration (run N requests) | ✅ | ❌ |
| Variable resolution (`{{var}}`) | ✅ | ❌ |
| Response→body mapping (apply at runtime) | ✅ | ❌ |
| Java/AST parsing | ❌ | ✅ (JavaParser) |
| Classpath resolution for DTOs | ❌ | ✅ (uses project's own classpath if possible) |
| JDBC connections | ❌ (no good universal Node driver) | ✅ |
| DB row → JSON shaped to DTO schema | ❌ | ✅ |
| Recursive type / cycle detection in DTOs | ❌ | ✅ (Java-aware) |

**Design principle:** Anything that requires **Java semantics** goes in the helper. Anything that requires **HTTP/filesystem/state** goes in main. Chain orchestration is pure state — stays in main.

### 3.3 JVM discovery and JDK requirement

- The app **detects** a JDK 17+ install at startup (looks at `JAVA_HOME`, `PATH`, common locations).
- If none found: friendly dialog with link to download. **No silent fallback to embedded JRE** in v1 (keeps binary small; can revisit if user feedback demands it).
- The supervisor spawns: `<java> -jar <helper.jar>` with `JAVA_OPTS` tunable (e.g., `-Xmx512m` for large projects).
- On Windows, use `child_process.spawn(java, [...], { windowsHide: true })` to suppress the cmd popup.

### 3.4 Supervisor behavior

```
App starts
   │
   ▼
JVM Helper Supervisor.init()
   │
   ├─ checkForJava() → if missing, show dialog, abort
   ├─ spawnHelper() → child_process.spawn(...)
   │     │
   │     └─ write '{"jsonrpc":"2.0","method":"initialize",...}\n' to stdin
   │
   ├─ listen on child.stdout (newline-framed JSON-RPC)
   ├─ listen on child.stderr (forward to app log)
   ├─ listen on 'exit' (auto-restart with exponential backoff, cap 3 retries)
   └─ listen on 'error' (mark helper unavailable, surface banner in UI)
```

**Restart policy:** Crashes within 30s of startup get backoff (1s, 2s, 4s, 8s, max 30s). After 3 consecutive failures in 60s, the UI shows a "Helper offline — restart app" banner and the user must manually restart.

---

## 4. IPC Strategy

### 4.1 Renderer ↔ Main (Electron IPC)

Use **Pattern 2** from the Electron IPC docs: `ipcRenderer.invoke` + `ipcMain.handle`. One request → one response, no correlation needed.

The preload script exposes a typed API:

```ts
// preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // Collections
  collections: {
    list:   ()           => ipcRenderer.invoke('collections:list'),
    create: (name)       => ipcRenderer.invoke('collections:create', name),
    get:    (id)         => ipcRenderer.invoke('collections:get', id),
    save:   (id, data)   => ipcRenderer.invoke('collections:save', id, data),
    delete: (id)         => ipcRenderer.invoke('collections:delete', id),
    import: (path)       => ipcRenderer.invoke('collections:import', path),
    export: (id, path)   => ipcRenderer.invoke('collections:export', id, path),
  },

  // Requests
  request: {
    send:   (req)        => ipcRenderer.invoke('request:send', req),
    cancel: (reqId)      => ipcRenderer.invoke('request:cancel', reqId),
    history: (collId)    => ipcRenderer.invoke('request:history', collId),
  },

  // Spring project
  project: {
    open:     (path)     => ipcRenderer.invoke('project:open', path),
    rescan:   ()         => ipcRenderer.invoke('project:rescan'),
    endpoints:()         => ipcRenderer.invoke('project:endpoints'),
    bodySchema:(epId)    => ipcRenderer.invoke('project:bodySchema', epId),
  },

  // DB
  db: {
    listConnections: ()  => ipcRenderer.invoke('db:listConnections'),
    createConnection: c  => ipcRenderer.invoke('db:createConnection', c),
    testConnection:  id  => ipcRenderer.invoke('db:testConnection', id),
    tables:           id => ipcRenderer.invoke('db:tables', id),
    rows:             q  => ipcRenderer.invoke('db:rows', q), // {connId, table, limit, where}
  },

  // Chains
  chain: {
    list:   (collId)     => ipcRenderer.invoke('chain:list', collId),
    save:   (chain)      => ipcRenderer.invoke('chain:save', chain),
    run:    (chainId)    => ipcRenderer.invoke('chain:run', chainId),
    runStep:(chainId, n) => ipcRenderer.invoke('chain:runStep', chainId, n),
    onStep:  (cb)        => ipcRenderer.on('chain:step', (_e, s) => cb(s)),
  },

  // App
  app: {
    showOpenDialog: (opts) => ipcRenderer.invoke('app:showOpenDialog', opts),
    showSaveDialog: (opts) => ipcRenderer.invoke('app:showSaveDialog', opts),
  }
});
```

**Channel naming convention:** `<domain>:<verb>` (e.g., `project:open`). Matches Electron's docs precedent of `dialog:openFile`.

**Validation:** The main process validates every argument using a schema (Zod or TypeScript + runtime guards). Renderer is untrusted — never trust the IPC payload.

**Events that don't have a request (helper status, chain step progress):** Use `webContents.send` from main → `ipcRenderer.on` in preload → typed event in renderer.

### 4.2 Main ↔ JVM Helper (JSON-RPC 2.0 over stdio)

The helper speaks **JSON-RPC 2.0** on stdin/stdout. Stderr is for logs. Frames are **newline-delimited** (LSP-style) — one JSON-RPC message per line. Newline within a JSON value is impossible (JSON strings escape `\n`).

**Why JSON-RPC 2.0 (vs. custom protocol or HTTP):**
- Standardized error codes, request IDs, batching
- Trivially debuggable with `nc` or by redirecting stdio
- Mature clients in both Node and Java
- Stateless framing; no need to manage HTTP server lifecycle inside the helper

**Wire format example:**

```
→ {"jsonrpc":"2.0","id":1,"method":"project.open","params":{"path":"/path/to/spring"}}
← {"jsonrpc":"2.0","id":1,"result":{"projectId":"abc123","controllers":42,"endpoints":187}}

→ {"jsonrpc":"2.0","id":2,"method":"project.endpoints","params":{"projectId":"abc123"}}
← {"jsonrpc":"2.0","id":2,"result":[{...},{...}]}

→ {"jsonrpc":"2.0","method":"helper.log","params":{"level":"info","msg":"scan complete in 3.2s"}}
← (no response — notification)
```

**Method surface (initial):**

| Method | Direction | Purpose |
|---|---|---|
| `initialize` | main → helper | Handshake; helper reports version, capabilities |
| `project.open` | main → helper | Open a Spring project root; returns scan summary |
| `project.rescan` | main → helper | Re-scan (file watch detected changes) |
| `project.endpoints` | main → helper | List detected endpoints, grouped by controller |
| `project.dtoSchema` | main → helper | Given a `MethodCall`, return JSON schema of the request body DTO |
| `db.connect` | main → helper | Open a JDBC connection (returns connId) |
| `db.disconnect` | main → helper | Close connId |
| `db.test` | main → helper | Test connection (used in settings UI) |
| `db.tables` | main → helper | List tables + columns |
| `db.rows` | main → helper | Fetch rows (with limit, optional where) |
| `db.generateBody` | main → helper | Given a row, schema, and column→field mapping, return JSON body |
| `helper.shutdown` | main → helper | Graceful exit |

**Notifications (no response expected):**

| Method | Direction | Purpose |
|---|---|---|
| `helper.log` | helper → main | Forward logs to main's logger |
| `project.scanProgress` | helper → main | Stream progress (file X of N) for UI progress bar |

**Connection pool lifecycle:** The helper holds connections in a `HikariCP` pool keyed by `connId`. The main process never sees a JDBC URL after creation — only `connId`s. This is the security boundary: credentials stay in the helper, never serialized back.

**Backpressure:** If the helper is slow, the main process's request queue should apply per-`connId` concurrency caps (e.g., 4 in-flight queries per connection). Use a simple async semaphore in the main process.

### 4.3 Why not a full HTTP server in the helper?

We considered it (helper exposes HTTP on localhost:PORT). Rejected for v1:
- Port allocation/collision handling is annoying
- Same-machine HTTP for IPC is overkill; adds 1-2ms latency per call
- Stdio JSON-RPC is simpler, fully under our control
- Can add HTTP later as an option for remote-helper scenarios (v2+)

---

## 5. Data Flow — End-to-End Walkthrough

The user journey: **open Spring project → see endpoints → generate body → send → view response → chain to next step.**

### Step 1: User clicks "Open Project" → pick a folder

```
Renderer:    user picks /home/dev/orders-svc
             ↓ api.project.open(path)
Preload:     ipcRenderer.invoke('project:open', path)
Main:        validate path exists, is directory
             write lock to ~/.postman-clone/project-cache/<hash>.lock
             call supervisor.openProject(path)
   Supervisor: send {"method":"project.open","params":{...}}
   Helper:     walk dir → 412 .java files
               JavaParser parses 387 successfully (25 have errors)
               build endpoint list
               cache to disk
               reply {projectId, controllers, endpoints, scanMs}
Main:        cache endpoints in memory + disk
             return {projectId, summary} to renderer
Renderer:    populate sidebar grouped by controller
```

### Step 2: User clicks an endpoint (e.g., `POST /api/orders`)

```
Renderer:    dispatches based on click
             ↓ api.request.createFromEndpoint(endpointId)
             (or just navigates UI; the endpoint metadata is already loaded)
```

If the user clicks "Send" immediately, the request gets built from cached metadata: method, path, URL prefix (from `@RequestMapping` on class + method), content-type, empty body.

### Step 3: User picks body mode = "Generate from DTO"

```
Renderer:    "Generate" button → "From DTO schema"
             ↓ api.project.bodySchema(endpointId)
Main:        call helper.project.dtoSchema({fqcn: 'com.acme.orders.OrderRequest'})
   Helper:   resolve class (parsed source OR via project classpath)
             walk fields recursively
             detect cycles → emit $ref markers
             emit JSON Schema-ish type tree
Main:        return schema to renderer
Renderer:    schema walker generates placeholder JSON
             show user-editable body editor
             field types: string→"string", int→0, bool→true, nested→{...}, list→[1 item]
```

### Step 4: User clicks "Send"

```
Renderer:    builds final Request object (method, url, headers, body, auth)
             ↓ api.request.send(request)
Main:        apply auth (Bearer, Basic, API key) at this layer
             apply environment + collection + global variable resolution
             apply proxy if configured
             undici fetch → record timing, status, headers, body
             build Response object
             write to history/<request-id>.json (per collection)
             return to renderer
Renderer:    render formatted response (JSON pretty, headers table, timing)
```

### Step 5: User defines a chain

```
Renderer:    "New Chain" → 3 steps
             Step 1: existing request
             Step 2: drag field from step 1 response tree → drop on body field
                     creates mapping step1.response.body.id → body.userId
             Step 3: another request with similar mapping
             ↓ api.chain.save(chainDefinition)
Main:        write to collections/<collId>/chains/<chainId>.json
             return chainId
```

### Step 6: User clicks "Run Chain"

```
Renderer:    ↓ api.chain.run(chainId)
Main:        load chain
             for each step:
               build request:
                 - resolve variables ({{baseUrl}}, etc.)
                 - apply mappings from prior step responses
                 - substitute {{step1.response.body.id}} etc.
               send request
               capture response
               store in step context (memory; not persisted until chain finishes)
             stream step events back to renderer via webContents.send
             on completion: persist chain run to history
Renderer:    receives step events, updates UI as each step finishes
             shows pass/fail per step, response per step
```

### Step 7: Re-run a single chain step

```
Renderer:    "Re-run step 2" → ↓ api.chain.runStep(chainId, 2)
Main:        load step 2's request
             resolve variables (re-resolve from latest prior step responses)
             apply mappings using current cached prior-step responses
             send; return result
             do NOT update the persisted chain run; just return result
             (user can "Apply" to update stored step output if desired)
```

---

## 6. Storage Layout

**Root:** `app.getPath('userData')` (Electron's per-user data dir).
- Windows: `%APPDATA%\PostmanClone\`
- macOS: `~/Library/Application Support/PostmanClone/`
- Linux: `~/.config/PostmanClone/`

```
PostmanClone/
├── settings.json                       # app preferences, window state, last opened project
├── collections/
│   └── <collection-id>/
│       ├── collection.json              # Postman v2.1 compatible (enables import/export)
│       ├── chains/
│       │   └── <chain-id>.json          # chain definition (saved with collection)
│       └── history/
│           └── <request-id>.json        # per-request history entries
├── environments/
│   └── <env-id>.json                    # key/value variables (Postman env format)
├── db-connections/
│   └── <connection-id>.json             # {name, jdbcUrl, user, encryptedPassword, driver}
├── project-cache/
│   └── <projectHash>/                   # hash of project path + mtime
│       ├── meta.json                    # {projectPath, lastScannedAt, javaVersion}
│       ├── endpoints.json               # list of detected endpoints
│       ├── dtos/                        # serialized DTO schemas
│       │   └── <fqcn>.json
│       └── lock                         # present while a scan is in flight
├── export/                              # default folder for "Export collection" dialog
└── logs/
    ├── app.log                          # main process logs
    └── helper.log                       # helper stderr (forwarded)
```

**Collection file format:** Postman v2.1 JSON. Reasons:
- User can share with Postman users (CORE-10 requirement)
- Mature schema with tooling
- Lets us import existing Postman collections

**DB connection security:** Passwords encrypted with `safeStorage` (Electron's built-in, uses OS keychain on macOS, libsecret on Linux, DPAPI on Windows). Plaintext only in memory; never logged; never sent off-device.

**Project cache invalidation:** Hash = SHA-256 of `absolutePath + lastModified`. On project open, if the cached entry's hash doesn't match the project's current mtime, rescan. File watcher (chokidar) can trigger incremental rescan — v1.5+ enhancement, not required for v1.

**Atomicity:** Every write goes to `<file>.tmp` → fsync → rename. No partial writes; no corrupted JSON on crash.

---

## 7. Build Order — What Must Come First

This ordering **minimizes risk** and ensures every phase ships a working app.

### Phase 0 — Skeleton (foundation, ~3-5 days)
**Goal:** Window opens, can save/load a JSON file.
1. Electron + TypeScript + React + Vite scaffold
2. Preload + contextBridge with one stub method
3. Main process: window management, menu, app lifecycle
4. Storage service: read/write JSON to userData with atomic rename
5. Basic UI shell: 3-pane layout (sidebar / editor / response) with placeholders

**Why first:** Establishes the IPC contract and process model. Every later phase uses this.

### Phase 1 — Postman Parity: HTTP + Collections (table stakes, ~2-3 weeks)
**Goal:** Send a real HTTP request, save it in a collection, run it again.
1. Request model (method, URL, headers, body, auth)
2. Response model (status, headers, body, timing)
3. HTTP client (undici) — handles all CORE-01 verbs, redirect policy, timeout
4. Auth helpers (Bearer, Basic, API key) — CORE-07
5. Body modes (none, form-data, urlencoded, raw JSON/XML/text, binary) — CORE-08
6. cURL command generation — CORE-02
7. Collection CRUD + sidebar UI — CORE-04
8. Save request into collection
9. Variable scopes (global / env / collection) + resolution — CORE-03
10. Request history per collection — CORE-09
11. Import/export Postman v2.1 — CORE-10
12. Response viewer (formatted JSON, headers table, timing) — CORE-06

**Why second:** Validates that the IPC + storage + HTTP pipeline works end-to-end before introducing the JVM helper. The app is already useful here (full Postman alternative minus Spring magic).

### Phase 2 — Spring Project Scanning (the first differentiator, ~2-3 weeks)
**Goal:** Point at a Spring project, see endpoints in sidebar.
1. JVM helper scaffold: Java 17 project, JSON-RPC 2.0 server (PicoCLI/stdlib), `initialize` handshake
2. Helper supervisor in main process: spawn, health check, restart policy, stderr→log
3. Spring scanner (in helper): walk `.java` files, JavaParser + symbol-solver
4. Extract `@RestController`/`@Controller` classes, `@RequestMapping`/`@GetMapping`/etc. on methods
5. Resolve path = class-level + method-level, with `{var}` placeholders
6. Resolve path variables, query parameters, consumes/produces
7. Sidebar displays detected endpoints grouped by controller — SPRING-04
8. Open endpoint → prefilled request (method, URL, content-type) — SPRING-05
9. Project cache to disk (per Project Cache layout)
10. JDK detection (CORE-01 of project setup, not a requirement)

**Why third:** This is where the JVM helper earns its keep. Once scanning works, the rest of the differentiators are easier.

### Phase 3 — DTO Body Generation (~1-2 weeks)
**Goal:** "Generate from DTO" produces valid-shape JSON for any DTO.
1. `project.dtoSchema` RPC: take a method, return schema for its `@RequestBody` parameter
2. Schema walker: fields, types, generics, Optional, enums, collections, nested
3. Cycle detection: track visited FQCNs, emit `{"$ref": "..."}` or break with `_cycle` marker
4. Placeholder JSON generator: sensible defaults per type
5. Editor UX: read-only schema tree + editable JSON body synced bidirectionally

**Why fourth:** Standalone value (valid shape data is enough for many manual tests).

### Phase 4 — DB Body Generation (~2-3 weeks)
**Goal:** Connect to user's DB, pick a table, generate a body from a real row.
1. `db.connect` RPC: receives connection config, opens pooled JDBC connection
2. Driver loading: bundle PostgreSQL, MySQL, Oracle, H2 drivers in the helper jar
3. `db.test` (validates URL + creds before saving)
4. `db.tables` (list tables + columns with types)
5. Connection management UI (CRUD connections; show connId in dropdowns)
6. `db.rows` (fetch with limit/where)
7. Body generation: shape a row's data to the DTO schema with user-overridable column→field mapping
8. Mapping UI: side-by-side row columns ↔ body fields, drag/select to map
9. Encryption of stored credentials via Electron's `safeStorage`

**Why fifth:** Highest-risk phase (DB drivers, security, schema mismatches). Builds on Phase 3's schema infrastructure.

### Phase 5 — Chains (~2 weeks)
**Goal:** Multi-step workflows with response→body mapping.
1. Chain model (steps, mapping rules)
2. Mapping editor: pick source = `step<n>.response.body.<path>`, target = `<bodyField>` or `<header>` or `<url param>`
3. Chain runner in main: variable context, step iteration, error policy
4. Per-step result view (status, response, applied mappings)
5. Single-step re-run (uses cached prior-step responses)
6. Chain persistence (saved with collection)
7. Preview resolved body for any step before running

**Why last in v1:** All other features inform chain UX. Can defer "preview resolved body" to v1.5 if tight on time.

### Phase ordering rationale

- **No phase requires a later phase** — each delivers a working app.
- **Phase 1 is the largest** (~3 weeks) because it covers all CORE-01..10 table stakes.
- **Phase 2 is the highest risk** — JVM helper spawn + JavaParser + Spring annotation coverage. Validate it early.
- **Phase 4 is security-sensitive** — DB credentials. Get encryption + audit logging right.
- **Phase 5 is the polish** — chains shine when everything else works.

---

## 8. Patterns to Follow

### 8.1 Renderer never holds secrets
All credentials (DB, auth) live in main process. Renderer only ever references them by ID.

### 8.2 Untrusted IPC validation
Every `ipcMain.handle` validates input (Zod schema). The renderer is treated as user input — it could be compromised by an XSS in a future feature. Never pass raw strings into shell, SQL, or file paths.

### 8.3 Idempotent file writes
All persistence uses `<file>.tmp` + rename. No partial JSON, no half-written collections on crash.

### 8.4 Pull, don't push, for project changes (v1)
Phase 2 ships with explicit "rescan" button + open-time rescan. File watching is a v1.5 enhancement. Pull avoids the complexity of pushing incremental changes through three processes.

### 8.5 Helper is stateless from the user's perspective
If the helper crashes, the supervisor restarts it. The user shouldn't lose work; the worst case is "rescan needed" on the next user action. Don't try to make the helper durable — keep it simple.

### 8.6 Chain context is memory, not disk
Chain step responses are kept in memory during a run, persisted to history only on success. A crash mid-chain doesn't corrupt history.

### 8.7 Single source of truth for collection format
Adopt the Postman v2.1 schema as-is for collection.json. Use the same shape for environments. Postman-compatible tooling becomes available for free.

---

## 9. Anti-Patterns to Avoid

### 9.1 Don't do Java parsing in Node.js
Regex or hand-rolled AST parsing of Java in the renderer/main is fragile. JavaParser is the standard. Keep JVM in its lane.

### 9.2 Don't embed the JVM in the main process
There's no good Node ↔ embedded-JVM story. Spawning a child is well-understood, debuggable, and crash-isolated.

### 9.3 Don't auto-detect endpoint↔table mapping
The user **explicitly** said no. Force the user to map; reviewable mappings trump magical inference (PROJECT.md decision).

### 9.4 Don't bypass the main process
Tempting to let the renderer talk to the JVM directly via a custom protocol. Don't. The main process is the validation, audit-log, and rate-limit point. One chokepoint = one audit trail.

### 9.5 Don't store plaintext DB passwords
`safeStorage` is free. Use it. Every build review should grep for `password` in storage code.

### 9.6 Don't use HTTP between main and helper
Stdio JSON-RPC is simpler, faster (no TCP/loopback), and easier to debug. Reserve HTTP for v2 remote-helper scenarios.

### 9.7 Don't try to ship a full Spring Boot Runtime inside the helper
Tempting to launch the user's Spring app and use reflection. Don't. v1 is read-only on the source. Runtime integration is a v2+ feature.

### 9.8 Don't make the helper do HTTP
Chain runner and HTTP client live in main. The helper is for "what does this Java project look like" and "what does this DB row look like" — read-only analysis tasks. Sending user-configured HTTP to target APIs is the main process's job.

### 9.9 Don't auto-write the Spring project
Hard read-only at the JVM helper level (no `Files.write` to paths inside the project root, even by accident). The only writes the helper does are to its own working dir for caches.

### 9.10 Don't ship without a "helper offline" degraded mode
The JVM helper can fail. The UI must keep working for plain Postman-style requests when the helper is unavailable. Phase 1 (no helper needed) proves this is achievable; design subsequent phases to fail gracefully.

---

## 10. Cross-Cutting Concerns

### 10.1 Logging
- Main process: `electron-log` (structured, level, file rotation in `logs/`)
- Helper: `java.util.logging` → stderr → main forwards to `logs/helper.log`
- Both share a request ID for correlation when debugging

### 10.2 Error reporting
- Renderer errors: Sentry-style breadcrumbs in main log; no auto-upload in v1 (user can copy logs)
- Helper crashes: surfaced as a non-blocking banner in the UI with the last 5 log lines

### 10.3 Telemetry
- **None in v1** (per "single-user local tool" constraint). No phone-home, no analytics. Verify by grep.

### 10.4 Updates
- Out of scope v1. Manual download + replace.
- v2: integrate `electron-updater` with GitHub releases.

### 10.5 Configuration
- All config in `settings.json` in userData
- No environment variables required
- Proxy settings honored: main process HTTP client uses `https_proxy` env if set, plus UI-configured proxy

### 10.6 Security checklist
- [x] `contextIsolation: true` (default in modern Electron)
- [x] `nodeIntegration: false`
- [x] `sandbox: true` where possible (preload can still use limited Node)
- [x] CSP set in HTML (no inline scripts)
- [x] DB creds via `safeStorage` (DPAPI/libsecret/Keychain)
- [x] No network calls to anywhere except user-configured targets
- [x] Read-only on Spring project at the filesystem level (helper has no write access to project paths)
- [x] Input validation at every IPC boundary

---

## 11. Open Architectural Questions for Later Phases

| Question | Resolved in | Notes |
|---|---|---|
| Spring Boot 2.7 (javax) vs 3.x (jakarta) symbol resolution | Phase 2 | JavaParser symbol-solver needs both classpath variants; bundle both |
| How to read compiled `.class` vs source | Phase 2 | Source-only in v1 (javac of project may be slow/unavailable); revisit if user feedback shows preference |
| Watch Spring project for changes | Phase 2.5 | chokidar in main; helper has no fs watch |
| Multi-window support | Phase 6+ | Single window in v1; multiple windows are doable via additional BrowserWindows + shared main-process state |
| gRPC / GraphQL | Out of scope v1 | REST/HTTP only |
| Mock server | Out of scope v1 | Detected endpoints in v2 |

---

## 12. Summary One-Pager

**Stack:**
- **Host:** Electron + TypeScript + React + Vite (renderer) + Node 18+ (main)
- **Helper:** Java 17 + JavaParser (symbol-solver) + HikariCP + Jackson + jsonrpc4j
- **HTTP:** undici (Node built-in fetch wrapper)
- **Storage:** JSON files in OS userData dir; atomic writes
- **IPC:** Electron IPC (renderer↔main) + JSON-RPC 2.0 over stdio (main↔helper)

**Components (3 processes):**
1. Renderer (UI only) ↔ Main (orchestrator) ↔ JVM helper (Java+JDBC)

**Data flow:** User → Renderer → Main → Helper (parse/DB) → Main (HTTP) → Target API → Main → Renderer

**Build order:** Skeleton → HTTP+Collections → Spring Scanner → DTO Body → DB Body → Chains

**Storage:** `~/.postman-clone/{collections,environments,db-connections,project-cache,logs}/`

**Critical pitfall:** Spawning the JVM helper correctly (Java detection, stdio framing, restart policy) — get this right in Phase 0's IPC design, not Phase 2.

---

## Sources

| Topic | Source | Confidence |
|---|---|---|
| Electron IPC patterns (Pattern 2 invoke/handle) | https://www.electronjs.org/docs/latest/tutorial/ipc | HIGH |
| Node child_process.spawn | https://nodejs.org/api/child_process.html | HIGH |
| Tauri architecture (considered, rejected) | https://github.com/tauri-apps/tauri/blob/dev/ARCHITECTURE.md | HIGH |
| JSON-RPC 2.0 spec | https://www.jsonrpc.org/specification | HIGH |
| JavaParser for Spring annotation extraction | https://javaparser.org/ | HIGH |
| Spring `@RestController`/`@RequestMapping` semantics | https://spring.io/guides/tutorials/rest | HIGH |
| Bruno's local-first file-based pattern (reference) | https://www.usebruno.com/ | MEDIUM |
| Insomnia's `insomniaFetch` pattern for data fetching | https://github.com/Kong/insomnia (develop branch) | MEDIUM |
| HikariCP for JDBC connection pooling | standard library; well-known | HIGH |
| Electron `safeStorage` for credential encryption | Electron docs (stable since v15) | HIGH |
