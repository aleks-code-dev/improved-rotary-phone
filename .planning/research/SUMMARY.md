# Project Research Summary

**Project:** PostmanClone (Postman-like desktop API client for Java Spring developers)
**Domain:** Desktop developer tool — local-first API client with codebase awareness
**Researched:** 2026-06-03
**Confidence:** HIGH

## Executive Summary

PostmanClone is a **local-first desktop API client** that competes on **codebase awareness**: it reads a Spring project on disk, detects `@RestController` endpoints, resolves DTOs against the project's classpath, and turns the codebase into a live, executable API surface. This is the moat — no general-purpose client (Postman, Insomnia, Bruno, JetBrains HTTP Client) ships this end-to-end.

Experts in this space build this as a **three-process desktop app** to keep Java semantics and HTTP/filesystem orchestration in separate runtimes:
1. **Renderer** (Electron + Chromium + React 19) — UI only, no Node access
2. **Main process** (Electron main, Node 24 / TS) — owns IPC, filesystem, HTTP, chain runner, supervises the JVM helper
3. **JVM helper** (long-lived Java 21 subprocess) — owns JavaParser, JDBC, DTO schema extraction; talks to main via JSON-RPC 2.0 over stdio

The recommended stack is **Electron 42 (not Tauri)** because JDBC for Oracle/H2 has no good Rust equivalent, and the main-process HTTP client (undici) sidesteps browser CORS by design. State lives in **JSON files in `userData`**, secrets in **Electron `safeStorage`** (DPAPI/Keychain/libsecret), with all collection/env data persisted as **Postman v2.1 schema** for free import/export.

The key risks are concentrated in the Spring-aware engine: **JavaParser symbol resolution** has known gaps (C-2), **Lombok** hides fields from source parsers (C-3), **bidirectional DTOs** cause infinite recursion in body generation (C-1), and **Jakarta vs javax** annotation drift can silently break detection (C-9). All four are addressable but require building a 10+ project test corpus on day one. A clean foundation phase (Phase 0: skeleton + IPC + storage) precedes the hard Spring work, so the high-risk phases are isolated and verifiable independently.

## Key Findings

### Recommended Stack

The full stack lives in STACK.md. The decisive one-liner: **Electron 42 + React 19 + Vite 8 + TypeScript** for the UI, **Node 24** (undici 7) for main-process HTTP, and a **Java 21 LTS** subprocess running **JavaParser 3.28.1 + HikariCP 6 + jsonrpc4j 1.6** over JSON-RPC on stdio. Secrets in `safeStorage`, persistence as JSON files in `userData`.

**Core technologies (with one-line rationale):**

- **Electron 42.3.2** — only desktop shell with first-class JVM spawn + mature HTTP APIs; Tauri rejected for JDBC parity (Oracle/H2 gaps) and fs:scope friction.
- **React 19.2.0 + Vite 8.0.0 + TypeScript 5.6+** — Vite 8 ships Rolldown (10-30x faster builds); React 19 is stable and has the largest API-client component ecosystem.
- **Zustand 5 + TanStack Query 5** — Zustand for cross-tab UI state, TanStack Query for cache/invalidation of endpoints/envs/db-metadata reads.
- **Zod 4** — IPC payload validation at every `ipcMain.handle` boundary (renderer is untrusted).
- **undici 7** — Node 24 built-in; runs in main process to avoid browser CORS entirely.
- **Monaco editor (`@monaco-editor/react`)** — VS Code's engine, built-in JSON language service for response viewer + body editor.
- **react-virtuoso 4** — variable-sized virtualized lists (chain step results, response trees).
- **JSONata 1.8** — purpose-built for chain field-path expressions (`{{step1.response.body.user.id}}`).
- **Java 21 LTS** — current LTS; virtual threads fit the helper's JDBC + JSON-RPC concurrency model.
- **JavaParser 3.28.1 + ASM 9.7** — source-level metadata + bytecode fallback for Lombok-generated DTOs.
- **HikariCP 6** with `maximumPoolSize=2` (desktop override) — single-user pool.
- **jsonrpc4j 1.6** (Java) + hand-rolled 80-line client (Node) — JSON-RPC 2.0 over stdio; saves a week vs. custom protocol.
- **Jackson 2.21.2** (NOT 3.x) — Spring ecosystem still on 2.x; mixing = friction.
- **Electron `safeStorage` (async API)** — DPAPI/Keychain/libsecret. **`keytar` rejected (archived 2022).**
- **electron-log 5 + electron-store + chokidar 4** — purpose-built for Electron userData + file watching.

### Expected Features

~31 active requirements across CORE / SPRING / BODY / DB / CHAIN / MAP, all defined in PROJECT.md. Strategy: ship the **table-stakes baseline tightly** (Postman parity) then **dominate on the Spring-differentiation surface**.

**Must have (v1 table stakes — CORE-01..10):**
- HTTP methods (all 7), URL/params/headers/body editor
- cURL import + generate
- 4-scope variables (global / env / collection / request) with standard precedence `Local > Data > Env > Collection > Global`
- Collections + nested folders
- Auth: None / Bearer / Basic / API key
- Body modes: none / form-data / urlencoded / raw / binary
- Response viewer (status, headers, time, pretty JSON, copy, search)
- Request history per collection (capped 100)
- Postman v2.1 import/export
- Per-request settings: timeout, redirects, SSL verify
- Cookie jar, proxy, tabs, dark/light theme, keyboard shortcuts

**Must have (v1 differentiators — the moat):**
- **SPRING-01..05:** Point at project → detect `@RestController` → resolve endpoints + DTOs → sidebar grouped by controller → click = prefilled request
- **BODY-01..03:** DTO-schema body generation with placeholders + cycle detection
- **DB-01..07:** JDBC connect (PostgreSQL/MySQL/Oracle/H2) → list tables → fetch rows → shape to DTO with column↔field mapping → safeStorage credential storage
- **CHAIN-01..05:** Ordered multi-step workflows; reference prior step response; persist with collection
- **MAP-01..04:** Drag field from response tree → drop on body field; explicit editable mappings; run-time resolution; preview

**Defer to v2+ (clearly out of v1 scope):**
- OpenAPI import/export, mock servers from endpoints, Spring Security/CSRF auto-detect, recompile watcher, validation-annotation-aware placeholders
- OAuth 1.0/2.0, mTLS, code generation (Python/JS/Java snippets), image/PDF preview, response assertions, response diff
- GraphQL, gRPC, WebSocket/SSE, SOAP/WSDL
- Cloud sync, team workspaces, API monitoring, CI/CD, plugin system, AI features

**Anti-features (do not build — locked out by PROJECT.md or industry reality):**
- Non-Spring backends, server-side code generation, auto endpoint↔table inference (user picks explicitly), cloud sync, full scripting engine (replaced by Chain+MAP)

### Architecture Approach

Multi-process desktop app with a single chokepoint (the main process) for validation, audit logging, and rate limiting. Renderer never imports `electron`/`fs`; JVM helper never initiates network calls and is read-only on the project tree. All cross-process traffic is JSON, all IPC payloads are Zod-validated.

**Major components:**

1. **Renderer (Chromium + React 19)** — Sidebar (collections/controllers/endpoints), request editor, response viewer, body-gen panel, chain runner UI. Talks only via `window.api.*` exposed by the preload through `contextBridge`. No Node access.

2. **Main process (Node 24 / TS)** — Owns: window/menu/clipboard/lifecycle, storage service (atomic JSON writes), HTTP client (undici), chain runner + variable context, env resolver, IPC router, **JVM helper supervisor** (spawn, health check, restart with exponential backoff, stderr forwarding to `logs/helper.log`).

3. **JVM helper (Java 21 subprocess)** — Owns: Spring scanner (JavaParser + symbol-solver), DTO schema resolver, DB connector (HikariCP pool keyed by `connId`), JSON-RPC 2.0 server. Communicates with main over **newline-framed JSON-RPC on stdio** (stdout = messages, stderr = logs).

**Process model:** Long-lived helper, not per-request. One 2-5s cold start, then ~50ms per call. Helper restart only on crash (backoff 1s→30s, max 3 in 60s before user must manually restart), explicit user reload, or schema break.

**IPC contract (renderer ↔ main):** Pattern 2 (`ipcRenderer.invoke` + `ipcMain.handle`). Channel naming `<domain>:<verb>` (e.g., `project:open`, `db:tables`, `chain:run`). All payloads Zod-validated at the main process boundary.

**IPC contract (main ↔ helper):** JSON-RPC 2.0. Method surface: `initialize`, `project.open/rescan/endpoints/dtoSchema`, `db.connect/disconnect/test/tables/rows/generateBody`, `helper.shutdown`. Notifications: `helper.log`, `project.scanProgress`. Credentials stay in helper; main sees only `connId`.

**Storage layout:** `app.getPath('userData')` → `collections/<id>/{collection.json,chains/,history/}`, `environments/`, `db-connections/<id>.json` (password encrypted via `safeStorage`), `project-cache/<hash>/{meta.json,endpoints.json,dtos/,lock}`, `logs/{app,helper}.log`. Collection format = **Postman v2.1** with `chains` as a top-level extension. Atomic writes (tmp → fsync → rename).

### Critical Pitfalls

**The five that will bite hardest, in build order:**

1. **C-2: JavaParser symbol resolution falls over on real Spring projects** — Without `CombinedTypeSolver` (Reflection + JavaParser + JarTypeSolver per dep), `type.resolve()` returns null silently. Inner-class scope confusion, generic resolution gaps, multi-module classpath gaps are known. **Mitigation:** Build a 10+ real Spring project test corpus on day one of Phase 2. Always use `ParseResult` (never `parse(file)`). Set `ParserConfiguration.LanguageLevel.JAVA_21` explicitly. Cache resolved types in H2. Treat unresolved generics as `Object` shape — body is placeholder anyway.

2. **C-1: Recursive DTOs without cycle detection → stack overflow / 50MB body / UI hang** — Bidirectional `@OneToMany`/`@ManyToOne` pairs are the norm, not the exception. **Mitigation:** Track `Set<FQN>` during schema walk; emit `{"$ref": "TypeName"}` on cycle; cap recursion depth at 6 with visible warning; respect `@JsonManagedReference`/`@JsonBackReference`. Build cycle detection first, not last.

3. **C-3: Lombok hides fields from source parsers** — `@Data`/`@Getter`/`@Value` generate bytecode only; the source has no getters. Field-first strategy misses Lombok nuances (`@ToString.Exclude`, `@Builder.Default`); method-first strategy misses `@Accessors(fluent=true)`. **Mitigation:** Hybrid field+getter walk; respect `@JsonProperty` for JSON field name; read field initializer for `@Builder.Default`; support `delombok` as a v2 escape hatch.

4. **C-6: DB credentials in plaintext config** — Default temptation is `~/.postmanclone/credentials.json` with raw password. Threat model explicitly forbids this. **Mitigation:** **Electron `safeStorage` (async API)** for every DB password. Never log ciphertext, never log plaintext. Mask in UI (`••••••`) with reveal button. Encrypted connection file is in `db-connections/<id>.json`.

5. **C-7: CORS / preflight fails when calling Spring from the renderer** — Renderer `fetch` is browser CORS; Spring's CORS config won't whitelist the desktop app's origin. **Mitigation:** All HTTP goes through **main process via undici**, never `fetch` from the renderer. Set `Origin` header deliberately to match target host. Ship a "Diagnose Connection" button that does an in-process `curl` to isolate.

**Other notable pitfalls (will be addressed in their phase):**
- **C-4:** PostgreSQL `jsonb` comes back as `PGobject`; need per-driver type normalizer (Phase 4).
- **C-5:** Huge result sets freeze the app — enforce `LIMIT` + per-column size cap (Phase 4).
- **C-8:** Scanning `.git/`/`target/`/`node_modules/` multiplies scan time 10-50x — denylist before walking (Phase 2).
- **C-9:** Jakarta vs javax namespace — match annotations by FQN string, never by class reference (Phase 2).
- **M-4:** Full re-scan on every save = battery killer — debounce file watcher, re-parse only changed file (Phase 2).
- **M-9:** Multi-module Maven/Gradle — detect `pom.xml` `<modules>` / `settings.gradle` `include` and walk each (Phase 2).

## Implications for Roadmap

Based on research, suggested phase structure (5 phases + Phase 0 skeleton). **The hard part is JavaParser symbol resolution in Phase 2 — build the test corpus on day one.** The risk curve is: Phase 0 trivial → Phase 1 large but well-trodden → Phase 2 high-risk new ground → Phase 3 medium risk (DB drivers) → Phase 4 polish (chains).

### Phase 0: Skeleton (~3-5 days)
**Rationale:** Establish the IPC contract and process model first. Every later phase reuses it. Get the JVM spawn design right now, not in Phase 2 when the cost of a wrong abstraction is high.

**Delivers:**
- `electron-vite` scaffold (Electron 42 + Vite 8 + React 19 + TS)
- `electron-builder` config (squirrel + dmg + AppImage + deb)
- Preload + `contextBridge` with one stub method + Zod validation
- Main process: window/menu/lifecycle, storage service (atomic JSON writes), electron-log + electron-store
- JVM helper scaffold: Java 21 + Gradle 8 + `initialize` handshake + JSON-RPC 2.0 server
- Supervisor: spawn, health check, restart with exponential backoff, stderr→`logs/helper.log`
- 3-pane UI shell (sidebar / editor / response) with placeholders

**Addresses (foundation for):** All later phases.
**Avoids:** PITFALLS m-9 (capability scoping baked in), m-10 (long paths), C-7 (main-process HTTP path proven before any real request).
**Stack uses:** Electron 42, React 19, Vite 8, TS, Zod 4, undici 7, safeStorage, electron-log, electron-store, Java 21, jsonrpc4j 1.6.
**Architecture implements:** Full 3-process model, IPC contract v1, JSON-RPC wire format.

### Phase 1: Postman Parity — HTTP + Collections (~2-3 weeks)
**Rationale:** Validates the IPC + storage + HTTP pipeline end-to-end with a known-good feature set. The app is already useful here (full Postman alternative minus Spring magic). Also proves the "helper offline → plain requests still work" degraded mode (PITFALLS 9.10).

**Delivers:** CORE-01..CORE-10 — request model, response model, undici client, auth (Bearer/Basic/API key), 4 body modes, cURL gen, collection CRUD + folders, save request, 4-scope variables with standard precedence, history (cap 100/collection), Postman v2.1 import/export, response viewer (formatted JSON, headers, timing). Plus per-request settings (timeout/redirects/SSL), cookie jar, proxy, tabs, dark/light theme, keyboard shortcuts.

**Addresses:** CORE-01..CORE-10 + all "v1 table stakes" in FEATURES.md.
**Avoids:** PITFALLS C-7 (main-process HTTP), M-8 (per-request isolated contexts by default), M-3 (secret-aware logging from first history save), m-1 (cap body display at 1MB), m-5 (data-dir location warning on first run).
**Stack uses:** undici 7, Monaco, react-virtuoso, Zod, electron-log.
**Architecture implements:** IPC router, HTTP client service, storage service, variable resolver.

### Phase 2: Spring Project Scanning — The First Differentiator (~2-3 weeks)
**Rationale:** This is where the JVM helper earns its keep. Highest-risk phase (PITFALLS C-2 is the single biggest project risk). Isolate it early so failures are recoverable, not catastrophic.

**Delivers:** SPRING-01..SPRING-05 — point at project root, scan, detect `@RestController`/`@Controller`, extract endpoints (class+method path merge, path vars, query params, consumes/produces), sidebar grouped by controller, click endpoint = prefilled request. Plus project cache (path+mtime hash), JDK detection.

**Addresses:** SPRING-01..SPRING-05, the headline differentiator.
**Avoids (must build on day one):**
- **C-2:** Build 10+ real Spring project test corpus (petclinic, realworld-example-app, etc.); assert 100% endpoint coverage before shipping.
- **C-8:** Denylist `.git/`, `target/`, `node_modules/`, `build/`, `.idea/`, `.gradle/`, `.mvn/`; honor `.gitignore`; cap file size at 1MB.
- **C-9:** Match annotations by FQN string (`annotation.getNameAsString().equals(...)`).
- **M-4:** chokidar 4 with 300ms debounce; re-parse only changed file; throttled full rescan (max 1 per 5s); run in worker.
- **M-9:** Detect `pom.xml` `<modules>` and `settings.gradle` `include`; walk each module root.
- **m-3:** Path collisions suffix with controller class name; show source file:line.
- **m-6:** Detect `RecordDeclaration`; use component name directly, not `getX()` pattern.
- **m-7:** Detect `sealed` types; show permitted subtypes picker; respect `@JsonTypeInfo`/`@JsonSubTypes`.
- **C-3 (detection only):** Detect Lombok usage (annotate scan results so Phase 3 knows).

**Stack uses:** JavaParser 3.28.1, ASM 9.7, chokidar 4, Zod (for endpoint DTOs).
**Architecture implements:** Spring Scanner module in helper, supervisor restart policy validated under load.

**Research flag:** This phase needs `/gsd-plan-phase --research-phase 2` during planning. The JavaParser symbol-solver + Lombok + Jakarta + records + sealed + multi-module combo is the highest-risk integration in the project. Build the test corpus as the first task.

### Phase 3: DTO Body Generation (~1-2 weeks)
**Rationale:** Standalone value — valid-shape placeholder data is useful for manual tests. Builds on Phase 2's scanning infrastructure. Cycle detection must be first task, not last.

**Delivers:** BODY-01..BODY-03 — `project.dtoSchema` RPC, schema walker (primitives, enums, collections, nested, generics, Optional, inheritance, records, sealed), cycle detection (`$ref` markers or `_cycle` placeholder), placeholder JSON generator with type-aware defaults, Monaco body editor in DTO-mode.

**Addresses:** BODY-01..BODY-03, the "magic moment" after click-endpoint.
**Avoids (must build on day one):**
- **C-1:** Cycle detection in `Set<FQN>`; depth cap 6 with visible warning; respect `@JsonManagedReference`/`@JsonBackReference`.
- **C-3 (full):** Hybrid field+getter walk; respect `@JsonProperty`, `@ToString.Exclude`, `@Builder.Default` initializers; detect `@Accessors(fluent=true)`.
- **m-4:** Read `VariableDeclarator.getInitializer()` for `@Builder.Default` values.
- **m-7 (Body Gen half):** Sealed types → subtype picker; respect Jackson `@JsonTypeInfo` discriminators.

**Stack uses:** Jackson 2.21.2, JavaParser 3.28.1, ASM 9.7 (Lombok fallback), Monaco.
**Architecture implements:** DTO Schema Resolver module in helper.

### Phase 4: DB Body Generation (~2-3 weeks)
**Rationale:** Highest-risk phase after scanning (DB drivers, credentials, schema mismatches). Builds on Phase 3's schema infrastructure. The mapping UI is the feature — don't ship a stub.

**Delivers:** DB-01..DB-07 — `db.connect`/`db.test`/`db.tables`/`db.rows`/`db.generateBody` RPCs, HikariCP pool (pool size 2 for desktop, NOT default 10), connection management UI, table/column picker, row selection (by id / LIMIT N / custom WHERE), column→field mapping UI (color-coded by type compatibility + required-field coverage), safeStorage-encrypted credentials, JDBC driver bundling (PostgreSQL 42.7.11, MySQL 9.x, Oracle ojdbc11 23.x, H2 2.3.x).

**Addresses:** DB-01..DB-07, the "real data" differentiator.
**Avoids:**
- **C-4:** Per-driver type normalizer for `PGobject` (json/jsonb), H2 String JSON, Oracle SQLXML, MySQL String JSON. Fallback to `{"_raw": "..."}` envelope.
- **C-5:** `LIMIT`/`OFFSET` cap default 100 rows; per-column size cap 100KB; `Statement.setFetchSize(50)` for streaming; row count preview query.
- **C-6:** safeStorage for every password; never log credentials or query results; mask in UI.
- **M-1:** Detect Jackson `@JsonNaming`/`Jackson2ObjectMapperBuilderCustomizer`; show "field will be transformed" warning; case-insensitive name match + snake↔camel toggle.
- **M-6:** Color-coded mapping (green=compatible, yellow=type-diff, red=required-unmapped, gray=Optional); coverage badge; test-row preview.
- **M-7:** JDBC-only boundary — never invoke user's `EntityManager`; warn if DTO is a JPA entity.
- **m-8:** HikariCP `maximumPoolSize=2`, `connectionTimeout=10s`, `idleTimeout=5min`, `maxLifetime=15min`, `keepaliveTime=2min`; shutdown pool on panel close + JVM shutdown hook.
- **MySQL license:** GPLv2 with FOSS exception — review implications before distribution or switch to `mariadb-java-client` (LGPL).

**Stack uses:** HikariCP 6, PostgreSQL 42.7.11, MySQL 9.x, Oracle ojdbc11 23.x, H2 2.3.x, safeStorage, electron-log (no query result logging).
**Architecture implements:** DB Connector module in helper, connection pool lifecycle.

**Research flag:** This phase needs `/gsd-plan-phase --research-phase 4` during planning. Per-driver JSON column quirks (Oracle `JSON` vs `CLOB`, MySQL `JSON` as String, PostgreSQL `jsonb` as `PGobject`, H2 String), Jackson naming strategy detection, and JDBC driver Maven distribution (Oracle requires their repo) all warrant a research spike.

### Phase 5: Chains + Response→Body Mapping (~2 weeks)
**Rationale:** Last in v1 because all other features inform chain UX. Polish phase — can defer "preview resolved body" to v1.5 if tight on time.

**Delivers:** CHAIN-01..CHAIN-05 + MAP-01..MAP-04 — chain model (ordered steps, manual DAG-free ordering), `{{step1.response.body.id}}` variable syntax, chain runner in main with step context (memory, not disk), per-step result view (status/response/applied mappings), single-step re-run, chain persistence in collection JSON, mapping editor (drag from response tree → drop on body field or header or URL param), explicit editable mappings, run-time resolution, preview-resolved-body.

**Addresses:** CHAIN-01..05 + MAP-01..04, the end-to-end "Spring project → live API playground" story.
**Avoids:**
- **M-2:** Strict, visible resolution — log every substitution; "WARN: {{authToken}} is null"; "Dry run" preview button; mark variables as required; persist response shape with run history.
- **M-5:** Per-step timeout (default 30s, max 10min); per-step retry policy (none/on-timeout/on-5xx/on-any-error); chain-level policy (abort-on-first-failure default, continue-and-mark, continue-only-on-certain-errors); mark "skipped" steps; idle timeout for streaming; never pretend truncated body is complete.
- **m-2:** Resolver tracks `Set<String> currentlyResolving`; throw `CircularVariableReference` on cycle.

**Stack uses:** JSONata 1.8, Monaco, react-virtuoso, Zod, electron-log.
**Architecture implements:** Chain orchestrator in main (variable context, step iteration, error policy), chain persistence in collection JSON.

### Phase Ordering Rationale

- **No phase requires a later phase** — each delivers a working app. The user can stop after any phase and have something useful.
- **Phase 1 is the largest** (~3 weeks) because it covers CORE-01..10. It's also the most well-trodden path (standard Postman alternative).
- **Phase 2 is the highest risk** — JVM helper spawn + JavaParser + Spring annotation coverage + Lombok + Jakarta. Validate it early with a 10+ project test corpus on day one. A failure here is recoverable; a failure in Phase 5 would be wasted polish.
- **Phase 4 is security-sensitive** — DB credentials, query results. Get encryption + audit logging right.
- **Phase 5 is polish** — chains shine when everything else works. Defer "preview resolved body" (MAP-04) to v1.5 if needed.
- **Helper-offline degraded mode** is provable by Phase 1 (Phase 1 doesn't need the helper at all). Subsequent phases must fail gracefully.

### Research Flags

**Phases likely needing `/gsd-plan-phase --research-phase <N>` during planning:**

- **Phase 2 (Spring Scanning):** HIGH RISK. The JavaParser symbol-solver + Lombok + Jakarta + records + sealed + multi-module + inner-class scope combo is the single hardest integration in the project. Build a 10+ real Spring project test corpus as the first task of the phase. Resolved pitfalls: C-2, C-3 (detection), C-8, C-9, M-4, M-9, m-3, m-6, m-7.
- **Phase 4 (DB Body Gen):** MEDIUM-HIGH RISK. Per-driver JSON column quirks (Oracle 21c+ `JSON` vs `CLOB`; MySQL `JSON` as String; PostgreSQL `jsonb` as `PGobject`; H2 String), Jackson `@JsonNaming` detection, JDBC driver Maven distribution (Oracle requires their own repo), MySQL GPLv2 license implications. Resolved pitfalls: C-4, C-5, C-6, M-1, M-6, M-7, m-8.

**Phases with well-documented patterns (skip research-phase):**

- **Phase 0 (Skeleton):** Standard electron-vite + electron-builder scaffold; mature Electron 42 + Node 24 patterns. No new ground.
- **Phase 1 (Postman Parity):** The entire API-client market has converged on this. Postman/Insomnia/Bruno/JetBrains docs cover every feature; no novel integration.
- **Phase 3 (DTO Body Gen):** The hard parts (cycle detection, hybrid field+getter walk) are addressed in PITFALLS C-1, C-3 — implementation patterns are well-defined. Phase 2's test corpus already covers the parser integration.
- **Phase 5 (Chains):** Standard orchestrator + variable context patterns. The hard parts (resolution logging, retry policy, timeouts) are addressed in PITFALLS M-2, M-5, m-2. No novel algorithms.

### Open Questions That Block v1 Decisions (and which phase they belong in)

These are **not blockers for the stack** but need resolution when the relevant phase is planned:

| Open question | Resolved in | Why it can wait |
|---|---|---|
| Lombok `@Data`/`@Builder.Default`/`@Accessors(fluent=true)` — exact supported subset in v1 | Phase 2 (detection) / Phase 3 (full) | Need real Spring project corpus to measure; defer ASM-fallback coverage until v1.1 |
| Eclipse JDT as fallback if JavaParser symbol-solver gaps persist | Phase 2 | Defer to v2; only relevant if 10+ project corpus shows <100% coverage |
| Multi-module Gradle (Kotlin DSL) parsing — `settings.gradle.kts` `include` resolution | Phase 2 | Maven `<modules>` is well-trodden; Gradle Kotlin DSL is more complex but rare in pure Spring apps |
| Spring WebFlux (`Mono<T>`/`Flux<T>`) — unwrap reactive wrappers? | Phase 2 (scan) / Phase 3 (body gen) | PROJECT.md Spring scope needs explicit confirmation (MVC only vs MVC+WebFlux); WebFlux detection is straightforward once decided |
| Kotlin Spring controllers (`.kt` files) | Phase 2 | PROJECT.md says "Java Spring" — recommend deferring Kotlin to v2 unless user demand emerges |
| Spring Security/CSRF auto-detect | v2 | Out of v1 scope per PROJECT.md |
| JDBC driver bundling: include in helper fat jar vs require user to provide | Phase 4 (architecture decision) | STACK.md recommends bundle (all 4 drivers in shadowJar) for best UX; verify Oracle Maven repo requirement |
| MySQL Connector/J GPLv2 license implications for closed-source distribution | Phase 4 (before release) | Accept terms, dual-license, or swap to `mariadb-java-client` (LGPL) — business decision, not technical |
| SQL Server as v1 addition | Phase 4 scope | PROJECT.md lists PostgreSQL/MySQL/Oracle/H2 only; SQL Server is a strong v1.1 candidate |
| `ajv` (client-side JSON Schema validation) | Phase 3+ (if needed) | Defer unless chain-step schema validation ships in v1 |
| `react-json-view` for read-only response tree (drag-source for chain mapping) | Phase 5 | Decide based on DX during chain step implementation |
| Recompile watcher (`chokidar` + incremental rescan) | Phase 2 (basic) / v1.5 (incremental) | Phase 2 ships explicit rescan button + open-time rescan; v1.5 adds watcher |
| Cloud-synced data dir detection (Dropbox/OneDrive/iCloud) | Phase 1 | First-run warning; ARCHITECTURE.md §6 already addresses; PITFALLS m-5 |
| Long-path support on Windows (`\\?\` prefix) | Phase 0 | Manifest setting + Java NIO handling; PITFALLS m-10 |
| Tauri vs Electron final decision | **RESOLVED** (Phase 0) | STACK.md confirms Electron — no longer open |

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | Every primary version verified against Context7 or official sources (Electron 42.3.2, Vite 8.0.0, React 19.2.0, JavaParser 3.28.1, HikariCP 6.x, PostgreSQL 42.7.11, jsonrpc4j 1.6, safeStorage docs, electron-log 5.x). MySQL/Oracle exact patch versions not deep-verified (major line is clear; pin at build time). Jackson 3.x deferred in favor of 2.21.2 because Spring ecosystem is 2.x. |
| Features | **HIGH** | Table-stakes baseline confirmed against Postman, Insomnia, Bruno, JetBrains docs. Differentiation surface (SPRING/BODY/DB/CHAIN/MAP) maps directly to PROJECT.md Active requirements; no competitor overlaps. Spring annotation coverage verified against Spring Framework 7.0.7 reference. v2 split is best-judgment (MEDIUM) — could be reshuffled based on user feedback. |
| Architecture | **HIGH** | Electron + Node child_process spawn patterns are mature and well-documented. JSON-RPC 2.0 over stdio is a textbook integration. Supervisor restart policy is standard practice. 3-process model is well-justified by the requirement set (Java semantics must be in a JVM; HTTP orchestration must be in Node; UI must be in renderer). |
| Pitfalls | **HIGH** for stack/parser/security; **MEDIUM** for UX workflows (deeper validation needed during early phases). C-1..C-9 all sourced from official docs (JavaParser wiki, Hibernate SO, Spring Boot 3 system requirements, HikariCP source). M-1..M-10 sourced from industry experience + framework docs. UX pitfalls (m-1..m-10) are best-judgment based on competitor behavior. |

**Overall confidence: HIGH.**

### Gaps to Address

- **Real-world Spring project corpus:** No public corpus exists for JavaParser + Lombok + records + MapStruct + multi-module interactions. Must be built as Phase 2's first deliverable. Target: 10+ real projects from GitHub (spring-petclinic, spring-boot-realworld-example-app, mall, etc.).
- **HikariCP in long-lived desktop process:** Most HikariCP guidance is server-side (web app, frequent traffic). Desktop is single-user, idle for hours. Validate `idleTimeout=5min`, `maxLifetime=15min`, `keepaliveTime=2min` actually work in practice.
- **Postman v2.1 import/export round-trip:** No formal spec; Postman docs are informal. Build a fixture of 20+ real Postman collections (publicly shared on GitHub) and assert round-trip equality in CI. Build during Phase 1.
- **MySQL Connector/J GPLv2 license review:** Required before any closed-source distribution. Decide Phase 4 (or before release).
- **Spring WebFlux scope confirmation:** PROJECT.md says "Java Spring" — confirm with stakeholders whether v1 must support WebFlux (`Mono<T>`/`Flux<T>`) or only MVC. Affects Phase 2 (detection) and Phase 3 (body gen unwrap).
- **Kotlin Spring controllers:** PROJECT.md says "Java Spring" — confirm whether to defer Kotlin entirely to v2. Affects Phase 2 (file extension walk) and Phase 3 (parser).
- **Hibernate proxy vs raw JDBC in user's running app:** The desktop app uses raw JDBC; the user's Spring app may be running with Hibernate. Does the user's Hibernate session interfere with the desktop app's connection to the same DB? Likely not, but worth a research spike before Phase 4.
- **SQL Server as v1 addition:** PROJECT.md lists 4 drivers; SQL Server is a top-3 enterprise Spring DB. Evaluate as Phase 4 v1.1 candidate.

## Sources

### Primary (HIGH confidence)
- **STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md** (this `.planning/research/` folder) — internally consistent, mutually-reinforcing conclusions
- **Electron 42.3.2 + Node 24 release metadata** — https://releases.electronjs.org/release?channel=stable
- **Electron `safeStorage` (async API)** — https://www.electronjs.org/docs/latest/api/safe-storage
- **JavaParser 3.28.1 + symbol-solver-core** — https://context7.com/javaparser/javaparser
- **JavaParser wiki — Symbol-Solver limitations** — https://github.com/javaparser/javaparser/wiki/About-the-Symbol-Solver (C-2 source)
- **undici 7.x** — https://github.com/nodejs/undici/blob/main/docs/docs/best-practices/undici-vs-builtin-fetch.md
- **Vite 8.0.0 + @vitejs/plugin-react v6** — https://github.com/vitejs/vite/blob/main/vite/docs/blog/announcing-vite8.md
- **React 19 stable** — https://github.com/reactjs/react.dev/blob/main/src/content/blog/2024/12/05/react-19.md
- **HikariCP defaults** — https://github.com/brettwooldridge/hikaricp/blob/dev/src/main/java/com/zaxxer/hikari/HikariConfig.java (C-5, m-8 source)
- **PostgreSQL JDBC 42.7.11** — https://context7.com/pgjdbc/pgjdbc
- **Jackson 2.21.2** — https://github.com/FasterXML/jackson-core/blob/3.x/README.md
- **jsonrpc4j 1.6.0** — https://github.com/briandilley/jsonrpc4j/releases
- **keytar ARCHIVED 2022-12-15** — https://github.com/atom/node-keytar (C-6 source — confirms safeStorage path)
- **Spring Boot 3.0 System Requirements** — https://docs.spring.io/spring-boot/docs/3.0.0/reference/htmlsingle/ (C-9 source — Jakarta namespace)
- **Spring Framework 7.0.7 — `@RequestMapping` reference** — https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-requestmapping.html
- **Postman v2.1 Collection Format** — https://learning.postman.com/collection-format/working-with-collections/
- **JSON-RPC 2.0 spec** — https://www.jsonrpc.org/specification
- **Electron IPC patterns (Pattern 2 invoke/handle)** — https://www.electronjs.org/docs/latest/tutorial/ipc
- **Tauri v2 capabilities (rejected path)** — https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/security/capabilities.mdx (m-9 source)

### Secondary (MEDIUM-HIGH confidence — to re-verify at build time)
- MySQL Connector/J 9.x — verified major line at Maven Central
- Oracle ojdbc11 23.x — verified major line; requires Oracle's Maven repo (distribution concern)
- H2 2.3.x — verified 2.x is current major
- victools/jsonschema-generator 4.x — right tool but minor in our stack (most body-gen is application code)

### Tertiary (LOW confidence — needs validation during implementation)
- Real-world failure modes in Postman v2.1 import/export (no formal spec; collect 20+ real collections as fixtures in Phase 1)
- Spring Boot 3.x + Java records + Lombok + MapStruct interactions in production codebases (no public corpus; build one in Phase 2)
- HikariCP behavior in a long-lived desktop process (most guidance is server-side; validate in Phase 4)
- Hibernate proxy vs raw JDBC in user's running Spring app (likely no conflict, but worth a research spike)

---
*Research completed: 2026-06-03*
*Ready for roadmap: yes*
