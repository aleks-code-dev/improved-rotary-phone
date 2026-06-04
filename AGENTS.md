<!-- GSD:project-start source:PROJECT.md -->
## Project

**PostmanClone**

A Postman-like API client built specifically for Java Spring developers. Point it at a local Spring project and it auto-detects every controller endpoint, generates request bodies from DTOs or live database rows, lets you chain requests with response-to-body field mapping, and turns the whole Spring codebase into a testable API surface in seconds.

The target user is a Spring backend developer who already has a project and wants to exercise its APIs without hand-writing cURL, OpenAPI clients, or fake data.

**Core Value:** A Spring project becomes a live, executable API playground the moment you point this app at its root folder — endpoints detected, bodies generated, chains runnable, no manual spec authoring required.

### Constraints

- **Tech stack — desktop**: Must run as a desktop application (not just a web app) so it can read the local Spring project's source/classpath and connect to local databases without server-side proxies. Electron or Tauri are the realistic choices.
- **Tech stack — Java parsing**: App must parse Java source and/or compiled bytecode for Spring annotations. Options: javaparser (source), ASM (bytecode), or running the project's own classpath (heaviest).
- **Compatibility — Java**: Must support Spring Boot 2.7+ and Spring Boot 3.x projects (Jakarta vs javax namespace).
- **Compatibility — DB**: Must support PostgreSQL, MySQL, Oracle, and H2 in v1 (covers the vast majority of Spring projects).
- **Security — DB credentials**: DB credentials stored locally only. No network egress of credentials or query results.
- **Security — local project access**: App reads project files read-only. Never modifies the Spring project on disk.
- **Performance — scanning**: Initial project scan should complete in under 10 seconds for a typical Spring project (~100 controllers, ~500 endpoints).
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## 0. Summary One-Pager
| Layer | Pick | Version | Confidence |
|---|---|---|---|
| Desktop shell | **Electron** (over Tauri) | **42.3.2** (June 2026) | HIGH |
| Renderer build | **Vite** + `@vitejs/plugin-react` | **Vite 8.0.0** / plugin-react **v6** | HIGH |
| UI framework | **React 19** | **19.2.0** | HIGH |
| Language (main + renderer + preload) | **TypeScript** | **5.6+** | HIGH |
| Renderer local state | **Zustand** | 5.0.12 | HIGH |
| Renderer server state | **TanStack Query** | 5.90.3 | HIGH |
| IPC payload validation | **Zod 4** | 4.0.1 | HIGH |
| Main HTTP client | **undici** (Node 24 built-in) | v7.x | HIGH |
| Packaging / dev server | **electron-vite** + **electron-builder** | latest | HIGH |
| File watching | **chokidar 4** | 4.x | HIGH |
| Logging | **electron-log** | 5.x | HIGH |
| Secret storage | **Electron `safeStorage` (async API)** | built-in | HIGH |
| Settings persistence | **electron-store** | latest | HIGH |
| JVM helper language | **Java 21 LTS** (min 17) | JDK 21 | HIGH |
| Java parser | **JavaParser + symbol-solver-core** | **3.28.1** | HIGH |
| Bytecode fallback (Lombok) | **ASM** | 9.x | HIGH |
| JSON-RPC over stdio | **jsonrpc4j** (server) + hand-rolled client | **1.6** | HIGH |
| Java JSON | **Jackson 2.21.2** (broad Spring compat) | 2.21.2 | MEDIUM-HIGH |
| Java CLI scaffolding | **picocli 4.7+** (defensive) | 4.7.x | HIGH |
| JDBC pool | **HikariCP** | 6.x | HIGH |
| PostgreSQL | **org.postgresql:postgresql** | **42.7.11** | HIGH |
| MySQL | **com.mysql:mysql-connector-j** | 9.x | MEDIUM-HIGH |
| Oracle | **com.oracle.database.jdbc:ojdbc11** | 23.x | MEDIUM |
| H2 | **com.h2database:h2** | 2.3.x | MEDIUM-HIGH |
| JSON editor | **Monaco** via `@monaco-editor/react` | latest | HIGH |
| Virtualized list | **react-virtuoso** | 4.6.2 | HIGH |
| Chain field-path language | **JSONata** (client-side) | 1.8.x | HIGH |
| Postman import | **Postman v2.1 schema** (validated by Zod) | schema | HIGH |
## 1. Desktop Shell — Electron (NOT Tauri)
### Recommendation: **Electron 42.3.2** (latest stable as of 2026-06-02)
| Detail | Value | Source |
|---|---|---|
| Latest stable | **v42.3.2** | https://releases.electronjs.org/release?channel=stable |
| Bundled Chromium | 148.0.7778.218 | release metadata |
| Bundled Node.js | 24.15.0 | release metadata |
| Bundled V8 | 14.8.178.28 | release metadata |
| Supported majors (per Electron policy) | latest 3 stable majors (40.x, 41.x, 42.x) | https://www.electronjs.org/docs/latest/tutorial/electron-timelines |
| Release cadence | ~8 weeks; new major every other Chromium release | electron-timelines docs |
### Why Electron (confirms ARCHITECTURE.md)
### Why NOT Tauri
- **JDBC parity gap.** Tauri's Rust SQL story is weakest where the Spring ecosystem is strongest: **Oracle** is not natively supported by `sqlx`; you must use `oracle-rs` which is community-maintained. **H2** has no first-class Rust client. This is a Phase 4 showstopper.
- **Permission/scoped filesystem friction.** Tauri v2's `fs:scope` is intentionally strict (PITFALLS m-9). Each Spring project root the user picks must be added to the scope. Electron's `dialog.showOpenDialog` returns a path you then read freely from the main process — simpler model.
- **Smaller pool of `Postman`-class API client references in the wild.** Postman, Insomnia desktop, Bruno, Stoplight — all Electron. Less precedent for Tauri in this niche.
- **Native module risk for menu/tray/icon APIs.** Electron's `Menu`/`Tray`/`nativeImage` are stable across all three OSes; Tauri's equivalents (especially on Linux) still have edge cases.
### Why NOT web-only / neutral
### Version pin strategy (per Electron support policy)
- **Pin to a specific minor for stability** (e.g., `electron@42.3.2`), not a major range.
- **Track the latest 3 stable majors.** Per Electron's own policy, "the latest 3 stable major versions are supported." 40.x, 41.x, 42.x are all currently supported (June 2026).
- **Never run an unsupported major** — security is the primary reason. Per Electron docs: "You should strive for always using the latest available version of Electron."
### `electron-vite` vs `electron-forge` for build tooling
| Concern | `electron-vite` (alex8088) | `electron-forge` |
|---|---|---|
| HMR for renderer + main | Native dual-process HMR (Vite 8) | Possible but more glue |
| Main process TypeScript | First-class (Vite handles it) | Slower esbuild, manual config |
| Packaging | Delegates to `electron-builder` under the hood | Native via Makers (Squirrel, ZIP, etc.) |
| Code signing | Via `electron-builder` config | Native |
| Auto-update (v2) | Via `electron-builder` (NSIS/Squirrel) | Native via `update-electron-app` |
| Current state (June 2026) | Active (last commit May 2026) | Active, official |
| **Verdict for this project** | **PICK** (cleaner DX for multi-process architecture) | Fine but heavier setup |
### Confidence: **HIGH**
- https://releases.electronjs.org/release?channel=stable (precise latest version 42.3.2)
- https://www.electronjs.org/docs/latest/api/safe-storage (DPAPI/Keychain/libsecret support)
- https://www.electronjs.org/docs/latest/api/utility-process (alternative to `child_process.spawn` for Node-based helpers; we use `child_process.spawn` for the JVM because the JVM is a separate executable, not a Node module)
- ARCHITECTURE.md (independent prior research agreeing with this conclusion)
- PITFALLS m-9 (Tauri's fs:scope is friction we want to avoid)
## 2. Renderer Build & UI Framework
### Recommendation
- **Vite 8.0.0** (latest stable, released 2026-03-12)
- **`@vitejs/plugin-react` v6** (Oxc-based React Refresh, no Babel dependency, smaller install)
- **React 19.2.0** (stable since Dec 2024; `v18.3.1` also still widely deployed)
- **TypeScript 5.6+** (current stable)
- **Zustand 5.0.12** for local UI state
- **TanStack Query 5.90.3** for server state (caches endpoints, envs, db metadata)
- **Zod 4.0.1** for IPC payload validation (renderer-side)
- **Monaco Editor** via `@monaco-editor/react` for the JSON body editor + request/response viewers
- **react-virtuoso 4.6.2** for virtualized lists (large request history, large response trees)
- **JSONata 1.8.x** for chain response→body field-path expressions in the renderer
### Why this combination
| Choice | Rationale | Confidence |
|---|---|---|
| **Vite 8 over Webpack 5 / Parcel** | Vite 8 ships Rolldown (Rust) as its single bundler — 10-30x faster builds per Vite 8 release notes. Instant HMR. Industry default for new Electron projects in 2026. | HIGH |
| **`@vitejs/plugin-react` v6** | Per Vite 8 announcement: uses Oxc (Rust) for the React Refresh transform — no Babel dependency, smaller install. Works with React 18+. v5 of the plugin also still works with Vite 8. | HIGH |
| **React 19 over Vue 3 / Svelte 5** | Largest ecosystem of API-client components (Monaco wrappers, JSON tree viewers, virtualized lists). Team familiarity. React 19 is stable; the new `use` hook and Actions aren't required for this app — the migration is essentially a `react@19` bump. | HIGH |
| **TypeScript 5.6+** | `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, and `satisfies` are mature. Standard. | HIGH |
| **Zustand 5 over Redux Toolkit / Recoil / Jotai** | Tiny (~1 KB), no provider, ergonomic for cross-tab state. Redux Toolkit is overkill; Jotai is fine but Zustand's docs/ecosystem are broader. | HIGH |
| **TanStack Query over SWR / Apollo** | Best-in-class for cache invalidation, background refetch, devtools. We have many read-mostly queries (endpoints, envs, connections, table metadata). | HIGH |
| **Zod 4 over Yup / Joi / io-ts** | v4.0.1 is a major release with significant perf and TS compile-time improvements. Best DX, first-class TS inference, single dep that replaces both runtime and static-type validation. | HIGH |
| **Monaco over CodeMirror 6** | Same engine as VS Code; ships with built-in JSON/HTML/XML language services. CodeMirror 6 is lighter but JSON language support is weaker. For the response viewer and body editor, Monaco wins. | HIGH |
| **react-virtuoso over `react-window` / `react-virtualized`** | Handles variable-sized items out of the box (important for chain step result rows of varying height). | HIGH |
| **JSONata over custom DSL or JSONPath** | Purpose-built for JSON transformation and path expressions. Mature client `jsonata` (JS port) is ~30 KB. Easier to teach users than a custom DSL. Java port `jsonata4java` exists for helper-side use if needed. | HIGH |
### What we explicitly DO NOT use
| Rejected | Why |
|---|---|
| **Webpack 5** | Slower builds, more config, no benefit over Vite for this project |
| **Next.js / Remix / Astro** | Desktop app — no SSR/SSG. Would be overhead. |
| **Vue 3 / Svelte 5 / Solid** | Smaller ecosystem of API-client-ready components |
| **Redux Toolkit** | Boilerplate; Zustand + TanStack Query cover the state shape |
| **Apollo Client** | We don't have a GraphQL backend; we ARE the API client |
| **`react-monaco-editor` (raw wrapper)** | The `@monaco-editor/react` package is the maintained successor; `react-monaco-editor` has been deprecated |
| **CodeMirror 6** | See above; Monaco's JSON language service is a big win for response viewers |
| **`react-json-view` as the body editor** | It's fine for read-only "response tree for drag-source" UI; for the actual body editor use Monaco |
### Confidence: **HIGH**
## 3. Main Process — Node 24 / TypeScript
### Runtime
- **Node 24.15.0** (bundled with Electron 42; used as the dev CLI runtime too)
- **TypeScript 5.6+** for the main process codebase
- **`electron-vite`** for dev/build (handles main + preload + renderer in one pipeline)
### HTTP client — **undici** (built-in to Node 24, but pin a version)
| Detail | Value | Source |
|---|---|---|
| Latest major | v7.x | Context7 |
| Bundled with Node 24 | v7.x | undici docs |
| API surface | `fetch`, `Agent`, `Pool`, `ProxyAgent`, `interceptors` | undici docs |
| Recommendation | `import { fetch, Agent, ProxyAgent } from 'undici'` and pin in `package.json` | — |
| Choice | Why / Why Not |
|---|---|
| **`fetch` from `undici`** (pin a version) | HTTP/1.1 + HTTP/2, per-request dispatcher control, proxy agents, interceptors, no extra dep beyond installing the `undici` package. Used internally by Node's built-in `fetch`. | **PICK** |
| `node-fetch` v3 | Last release March 2022. Effectively deprecated. Built-in fetch is just as good. |
| `axios` | Adds ~14 KB, brings its own `FormData`/`URL` polyfills in older versions, doesn't beat undici on perf, and we want to send raw streams. |
| `got` v12 | Excellent but maintained in a "feature-frozen" mode since 2022; no reason to prefer it over undici in 2026. |
| Node `http`/`https` | Works but verbose; no built-in fetch semantics, no interceptors, no easy proxy agent. |
### Logging — **electron-log** (5.x)
- Main + preload: `electron-log` (file + console transports, level, rotation, structured).
- Helper: `java.util.logging` → stderr → main forwards to `logs/helper.log` (ARCHITECTURE.md §10.1).
- Per-request correlation: pass a `requestId` from renderer → main → helper and include it in every log line.
### File watching — **chokidar 4** (v4 is current line)
- Used in Phase 2+ (PITFALLS M-4) for incremental rescans on Spring project changes.
- Debounced at 300ms idle; full re-scan on `pom.xml` / `build.gradle` change.
- Polling is opt-in (some filesystems need it on macOS); default to native events.
### Settings persistence — **electron-store** (latest)
- Stores `settings.json` in `app.getPath('userData')`.
- Atomic writes built-in; schema validation via Zod on load.
- Used for: window state, last opened project, theme preference, proxy config. **Not** used for collections/environments/history (those go in structured sub-dirs per ARCHITECTURE.md §6).
### Secret storage — **Electron `safeStorage` (async API)**
| OS | Backend | Property |
|---|---|---|
| macOS | **Keychain** | "Encryption keys are stored for your app in Keychain Access in a way that prevents other applications from loading them" |
| Windows | **DPAPI** | "Only a user with the same logon credential as the user who encrypted the data can typically decrypt the data" |
| Linux | `kwallet` / `kwallet5` / `kwallet6` / `gnome-libsecret` / Portal Secret | Varies by DE; may degrade to `basic_text` (warn loudly) |
### What we DO NOT use for secret storage
| Rejected | Why |
|---|---|
| **`keytar`** (the old standard) | **ARCHIVED 2022-12-15 by the original Atom/GitHub team.** Last release v7.9.0 (Feb 2022). No security backports, no Electron 42 prebuilt binaries, no Node 24 prebuilt binaries. Do not start a new project on it. Source: https://github.com/atom/node-keytar |
| **`@napi-rs/keyring`** | Modern fork that *would* work, but **we don't need it**: Electron's `safeStorage` already covers all three OSes with no extra native module. Adding a keyring dep on top of `safeStorage` is double-coverage. |
| Plaintext JSON in `userData` | PITFALLS C-6: this is the failure mode the user is paying us to prevent |
| `electron-settings` | Unmaintained |
| `node-keytar` forks (e.g., `node-keytar-prebuild`) | All stop getting updates; do not depend on prebuild freshness |
### Confidence: **HIGH** for undici, safeStorage, electron-log, electron-store. **MEDIUM-HIGH** for chokidar (could swap to `node:fs.watch` with care, but chokidar 4 is well-maintained and mature).
## 4. JVM Helper — Java 21 + JavaParser + HikariCP
### Language: **Java 21 LTS** (Java 17 minimum supported)
| Detail | Value | Source |
|---|---|---|
| Recommended | **JDK 21 LTS** | Standard LTS, supported through at least Sept 2026 by major vendors (Temurin, Corretto, Liberica, Zulu) |
| Minimum | **JDK 17 LTS** | Spring Boot 3.x requires Java 17+. Spring Boot 2.7 supports Java 8/11/17. We require 17 to leverage records, pattern matching, and modern HttpClient. |
| Recommendation for users | **Eclipse Temurin 21** (Adoptium) or **Amazon Corretto 21** | Both free, TCK-tested, multi-platform. |
| Bundled JRE | None in v1 | Per ARCHITECTURE.md §3.3: detect user's JDK; if absent, friendly download dialog. No silent embedded JRE. |
| Build tool for the helper | **Gradle 8.x with Kotlin DSL** (or Maven 3.9+) | Pick Gradle for consistency with most Spring projects; either works. |
- Java 21 is the current LTS (since Sept 2023). New long-running subprocess code in 2026 should target it.
- Virtual threads (JEP 444, finalized in 21) are a clean fit for the JDBC connection lifecycle and JSON-RPC request handling.
- Pattern matching for `switch` and `record` patterns reduce boilerplate in the parser-driven code.
- Spring Boot 3.2+ supports Java 21. We don't run the user's Spring app, but aligning JDKs reduces "weird classpath" errors when the helper reads the project's compiled bytecode.
### Java parser: **JavaParser 3.28.1** (with symbol-solver-core)
| Library | Version | Purpose |
|---|---|---|
| `com.github.javaparser:javaparser-core` | **3.28.1** | Parsing `.java` source files into AST |
| `com.github.javaparser:javaparser-symbol-solver-core` | **3.28.1** | Type resolution across the project + dependency JARs |
| `org.ow2.asm:asm` / `asm-tree` / `asm-commons` | **9.x** | Bytecode fallback for Lombok-generated code and classes without sources |
### Confirms vs. PITFALLS C-2
| Pitfall symptom | Mitigation baked into the stack |
|---|---|
| "No symbol solver configured = no resolution" | Always compose `CombinedTypeSolver` with `ReflectionTypeSolver` + `JavaParserTypeSolver` + `JarTypeSolver`s for the project's dependencies. Pinned in helper config. |
| Generic resolution incomplete | Default unresolved generics to `Object` shape; never crash. Use `@SuppressWarnings("unchecked")` only at the resolver boundary. |
| Inner-class scope confusion | Build a test corpus (10+ Spring projects, including real ones from GitHub) and assert known endpoint counts. Anything below 100% coverage is a blocker. |
| Cross-module resolution requires every dependency JAR | Walk `~/.m2/repository` (Maven) and `~/.gradle/caches/modules-2/files-2.1` (Gradle) at project-open time. Cache the resulting `JarTypeSolver` set. Add a "Re-scan dependencies" button for the user when classpath changes. |
| Multi-module Maven/Gradle projects | Always parse `pom.xml` / `settings.gradle` first; collect module roots; create a `JavaParserTypeSolver` per module. |
| New Java syntax (records, sealed, pattern matching) | Set `ParserConfiguration.LanguageLevel.JAVA_21` explicitly. Per JavaParser wiki, without an explicit level, parse errors are silent for newer syntax. |
### JavaParser vs. Eclipse JDT vs. ASM — why JavaParser wins for v1
| Option | Strengths | Weaknesses | Verdict |
|---|---|---|---|
| **JavaParser + symbol-solver** | Source-level + type resolution, well-documented, large community, easy to extend | Symbol-solver has known gaps on generics / inner classes (PITFALLS C-2) | **PRIMARY** |
| **Eclipse JDT** (JDT Core) | Best-in-class Java type resolution (Eclipse IDE's compiler) | Heavy (bundle ~5 MB), harder to embed standalone, model is not the same as JavaParser's | Defer to v2; revisit if symbol-solver gaps persist after the test corpus work |
| **ASM** | Pure bytecode, no source needed, works on compiled `.class`, handles Lombok-generated accessors | No source-level generics info, no annotations-on-fields (only class/method annotations at bytecode level) | **FALLBACK for Lombok** (PITFALLS C-3). When source parsing fails on Lombok-heavy DTOs, fall back to ASM. |
| Running the project's classpath (embedded JRE / `java -jar`) | Most accurate (uses the project's own classloaders) | Heavy, slow, hard to version-pin, requires the user to build the project first | **REJECTED** for v1 (ARCHITECTURE.md §1 and §3.2) |
### JSON-RPC over stdio: **jsonrpc4j 1.6** (Java side) + hand-rolled client (Node side)
| Detail | Value | Note |
|---|---|---|
| Latest stable release | **1.6.0** (Jan 2021) | Per GitHub releases; v1.7 is on `master` but **not yet released** |
| Streaming server | Yes — `JsonRpcServer` accepts `InputStream`/`OutputStream` | Perfect for stdin/stdout framing |
| Dynamic client proxies | Yes — `ProxyUtil.createClientProxy` | Useful for typing the service interface |
| Error resolving | Pluggable via `ErrorResolver` | Map Java exceptions to JSON-RPC error codes |
### Java JSON: **Jackson 2.21.2** (recommended over Jackson 3.1.1)
| Choice | Version | Why |
|---|---|---|
| **Jackson 2.21.2** | `com.fasterxml.jackson.core:jackson-{core,databind,annotations}:2.21.2` | **PICK.** Stable, battle-tested, every Spring library in the user's project classpath will be Jackson 2.x. We need to interoperate with `ObjectMapper` if we ever surface the user's Jackson config (PITFALLS M-1). |
| Jackson 3.1.1 | `tools.jackson.core:jackson-{core,databind,annotations}:3.1.1` | New major; package renamed to `tools.jackson.core`. Most Spring libraries still ship against Jackson 2. Mixing Jackson 2 and 3 in the same JVM works but is friction. Defer to v2 once Spring ecosystem catches up. |
### Java CLI scaffolding: **picocli 4.7+** (defensive)
### JDBC pool: **HikariCP 6.x**
- Repo: https://github.com/brettwooldridge/HikariCP (latest stable 6.x)
- Confirmed in HikariCP source: `private static final int DEFAULT_POOL_SIZE = 10` (HikariConfig.java)
- **Desktop overrides** (per PITFALLS m-8): `maximumPoolSize=2`, `minimumIdle=1`, `connectionTimeout=10s`, `idleTimeout=5min`, `maxLifetime=15min`, `keepaliveTime=2min`. Single user = small pool.
- Reason for HikariCP over alternatives: proven, minimal-overhead, well-documented `HikariDataSource` lifecycle, every major JDBC driver tested with it.
### JDBC drivers (PROJECT.md Constraint: PostgreSQL, MySQL, Oracle, H2)
| DB | Maven coordinates | Version (verified) | Notes |
|---|---|---|---|
| **PostgreSQL** | `org.postgresql:postgresql` | **42.7.11** | Confirmed via Context7. License: BSD-2-Clause. Bundles well into a fat jar. |
| **MySQL** | `com.mysql:mysql-connector-j` | **9.x line** (latest is `9.1.0` or similar) | The new coordinates (was `mysql:mysql-connector-java`, now under Oracle's `com.mysql` group). License: GPL-2.0 with FOSS exception. **Watch license implications** for closed-source distribution. |
| **Oracle** | `com.oracle.database.jdbc:ojdbc11` | **23.x line** (ojdbc11 for Java 11+; ojdbc8 for Java 8) | Free Oracle JDBC. Distributed via Maven Central. **Some companies prefer the older `ojdbc6`/`ojdbc7`** from Oracle's site; we ship the Maven one. |
| **H2** | `com.h2database:h2` | **2.3.x line** | Confirmed H2 2.x is current. Used for testing the helper without needing a real DB. License: MPL-2.0 / EPL-1.0 dual. |
### Confidence
- JavaParser 3.28.1: **HIGH** (verified via Context7)
- Jackson 2.21.2: **HIGH** (verified via Context7); Jackson 3.1.1 deferred
- jsonrpc4j 1.6.0: **HIGH** (verified via GitHub releases; pin to 1.6, not 1.7-SNAPSHOT)
- HikariCP 6.x: **HIGH** (verified via Context7)
- PostgreSQL JDBC 42.7.11: **HIGH** (verified via Context7)
- MySQL Connector/J 9.x: **MEDIUM-HIGH** (exact patch version not deep-verified; major line is clear)
- Oracle ojdbc11 23.x: **MEDIUM** (versioning changes; verify at build time)
- H2 2.3.x: **MEDIUM-HIGH** (verified 2.x is the current major)
## 5. Storage — JSON Files in `userData` (NOT SQLite, NOT IndexedDB)
### Recommendation: **JSON files** in `app.getPath('userData')`
| Path | Purpose | Format |
|---|---|---|
| `settings.json` | App preferences, window state, last opened project | JSON, validated by Zod on load |
| `collections/<id>/collection.json` | The collection (Postman v2.1 shape) | JSON v2.1 (CORE-10) |
| `collections/<id>/chains/<id>.json` | Chain definitions (CHAIN-05) | JSON |
| `collections/<id>/history/<id>.json` | Per-request history entries (CORE-09) | JSON, capped at 100/collection |
| `environments/<id>.json` | Environment variables (CORE-03) | Postman env JSON shape |
| `db-connections/<id>.json` | JDBC connections (DB-01) | JSON with **encrypted** password (PITFALLS C-6) |
| `project-cache/<hash>/...` | Scan results, DTO schemas | JSON, invalidated by path+mtime hash |
| `logs/app.log` | Main process logs | electron-log format |
| `logs/helper.log` | Helper stderr (forwarded) | text |
### Why JSON files, not alternatives
| Option | Verdict | Why |
|---|---|---|
| **JSON files** | **PICK** | Simple, human-debuggable, atomic-rename writes (`<file>.tmp` → fsync → rename), no schema migrations for v1, plays nicely with Postman v2.1 import/export (CORE-10) |
| **SQLite** | Reject for v1 | The data shapes are nested (chains have steps have mappings have source/target). JSON is more natural. SQLite only pays off when you have >10K rows of homogeneous data (we don't). Revisit for request history if the cap moves from 100 to 10K. |
| **IndexedDB (renderer-side)** | Reject | Renderer is supposed to be ephemeral UI state only (ARCHITECTURE.md §2 hard rule). Persistence lives in main. |
| **lowdb / LokiJS / NeDB** | Reject | All add a query language we don't need; JSON files + Zod give us 90% of the value. |
| **YAML** | Reject (mostly) | Postman v2.1 is JSON. YAML only wins for human-edit-friendliness. We don't expose the storage format to users — they edit through the UI. ARCHITECTURE.md §11 flags as a v2 evaluation. |
| **Encrypted-at-rest JSON** | Defer to v2 | `safeStorage` covers secrets. For v1, only DB passwords are encrypted; collections/envs are plaintext on disk (low-sensitivity). v2 may add an optional passphrase for the whole data dir. |
### Atomicity (PITFALLS m-5)
### Cloud-synced folder detection (PITFALLS m-5)
### Confidence: **HIGH** (ARCHITECTURE.md §6 already lays this out in detail).
## 6. Postman v2.1 Collection Format (CORE-10)
- Users share with Postman/Insomnia/Bruno users (CORE-10)
- Mature schema with [published spec](https://learning.postman.com/collection-format/working-with-collections/)
- Lets us import existing Postman collections; lets our users export theirs
- Postman v2.1 schema is permissive (allows extension fields) so we can add a `chains` array as a top-level extension without breaking compliance
### Confidence: **HIGH** (mature spec, well-understood, ARCHITECTURE.md §6 §7 §11 already commit to this).
## 7. JSON Schema / DTO Reflection (Java Helper)
### Recommendation: Hybrid approach — hand-rolled schema walker in Java + light use of `victools/jsonschema-generator` (4.x) for validation, not generation
| Library | Version | When |
|---|---|---|
| `victools/jsonschema-generator` (Java) | 4.x | Generate JSON Schema from a Java class for validation/UI hints |
| `com.networknt:json-schema-validator` | 1.5.x | Validate a body against a generated schema |
### What we DO NOT use
| Rejected | Why |
|---|---|
| `org.everit.json-schema` | Older, less active; `json-schema-validator` from `networknt` is the standard in 2026 |
| `json-schema-generator` from `mbknor` | Older API; `victools` is the maintained successor |
| Generating JSON Schema as a primary output | The body is *placeholder* JSON, not a schema. Users don't need a JSON-Schema artifact; they need a body they can edit and send. |
### Confidence: **MEDIUM-HIGH** (victools is the right tool, but the bulk of body-generation logic is application code, not a library choice).
## 8. Alternatives Considered (One-Pager)
| Decision | Recommended | Considered | Why Not |
|---|---|---|---|
| Desktop shell | **Electron 42** | Tauri 2 | JDBC coverage gap (Oracle/H2); fs:scope friction; smaller API-client precedent |
| Desktop shell | **Electron 42** | Neutral web app | PROJECT.md constraint: must read local files + DB without server proxy |
| Renderer build | **Vite 8** | Webpack 5 | Vite 8's Rolldown is 10-30x faster; instant HMR |
| UI framework | **React 19** | Vue 3 | Smaller API-client component ecosystem |
| UI framework | **React 19** | Svelte 5 | Same as above; also less mature story for Monaco wrappers |
| HTTP client | **undici 7** | axios / got / node-fetch | undici is what Node 24 ships with; de-facto standard |
| HTTP client | **undici 7** | `node:http` | Verbose; no fetch semantics |
| Java parser | **JavaParser 3.28.1** | Eclipse JDT | JDT is heavier; embed-as-library story is rougher |
| Java parser | **JavaParser + ASM fallback** | ASM-only | Source-aware annotations + records need JavaParser; ASM for Lombok fallback |
| Java JSON | **Jackson 2.21.2** | Jackson 3.1.1 | Jackson 3.x is great but ecosystem (Spring libraries) still on 2.x; mixing = friction |
| JSON-RPC | **jsonrpc4j 1.6** | Custom impl | Saves a week; stable single-dep |
| JSON-RPC | **jsonrpc4j 1.6** | Spring + HTTP | We want stdio, not HTTP-on-localhost (PITFALLS note) |
| Secret storage | **Electron `safeStorage`** | `keytar` | **keytar is archived 2022-12-15**; no Electron 42 prebuilts |
| Secret storage | **Electron `safeStorage`** | `@napi-rs/keyring` | Double coverage; safeStorage is built-in |
| Secret storage | **Electron `safeStorage`** | Plaintext JSON | PITFALLS C-6 — this is the failure mode |
| Storage | **JSON files** | SQLite | Data shapes are nested; JSON is more natural; atomic rename is enough for v1 |
| Storage | **JSON files** | IndexedDB | Renderer holds UI state only (ARCHITECTURE.md hard rule) |
| Body gen | **Hand-rolled walker** | `victools/jsonschema-generator` | We emit placeholder JSON, not JSON Schema. Light use of victools only for validation. |
| Chain field paths | **JSONata** | Custom DSL / JSONPath | JSONata is purpose-built for transformation; mature client; teachable |
| Body editor | **Monaco** | CodeMirror 6 | Monaco has built-in JSON language service |
| State | **Zustand + TanStack Query** | Redux Toolkit | Boilerplate; Zustand + Query cover the shape |
| Validation | **Zod 4** | Yup / Joi / io-ts | Zod 4 perf + DX + TS inference |
| Logging | **electron-log** | winston / pino | electron-log is purpose-built for `userData`/rotation; no remote transport needed |
| JDK | **Java 21 LTS** | Java 17 LTS | 21 is current LTS; virtual threads fit helper's JDBC + JSON-RPC model |
| Build (helper) | **Gradle 8** | Maven 3.9 | Either works; Gradle aligns with most modern Spring projects |
## 9. Installation Reference
### `package.json` (renderer + main + preload)
### `build.gradle.kts` (JVM helper, key dependencies)
## 10. Cross-Cutting Concerns and Final Decisions
### Security checklist (stacks onto ARCHITECTURE.md §10.6)
- [x] `contextIsolation: true` (Electron default)
- [x] `nodeIntegration: false`
- [x] `sandbox: true` where possible
- [x] CSP set in renderer HTML (no inline scripts)
- [x] DB creds via `safeStorage` (DPAPI / Keychain / libsecret)
- [x] IPC payloads validated by **Zod** at every `ipcMain.handle`
- [x] No network calls except user-configured targets
- [x] Read-only on Spring project at the filesystem level (helper has no write access to project paths)
### Things we will NOT do in v1 (with rationale)
| Not doing | Why |
|---|---|
| Embedding a JRE | Bigger binary, more version-pinning pain; we detect the user's JDK instead |
| Running the user's Spring app | Read-only consumer (ARCHITECTURE.md §9.7) — no need for classpath resolution via execution |
| HTTP server inside the helper | Stdio JSON-RPC is simpler, faster, easier to debug (ARCHITECTURE.md §4.3) |
| Cloud sync / team workspaces | PROJECT.md out-of-scope; single-user local tool |
| Auto-update in v1 | Use `electron-builder`'s `electron-updater` in v2; manual download + replace for v1 |
| Telemetry / phone-home | PROJECT.md decision: "no telemetry in v1" |
| Native modules in the main process | `safeStorage`, undici, electron-log, chokidar are all pure-JS / built-in. No `node-gyp` rebuild pain. |
| `keytar` | Archived 2022 — see §3.1 |
### Build pipeline summary (matches ARCHITECTURE.md §7)
## 11. Confidence Assessment
| Area | Level | Why |
|---|---|---|
| Desktop shell (Electron 42) | **HIGH** | Version verified via releases.electronjs.org (42.3.2, June 2026); `safeStorage` docs current; `utilityProcess` docs current. ARCHITECTURE.md already agrees. |
| Renderer build (Vite 8 + React 19) | **HIGH** | Vite 8.0.0 stable 2026-03-12 verified; React 19.2.0 stable verified; plugin-react v6 verified. |
| HTTP client (undici 7) | **HIGH** | v7.x bundled with Node 24 per official undici docs. |
| Java parser (JavaParser 3.28.1) | **HIGH** | Exact version verified via Context7. PITFALLS C-2 mitigations are the real risk, not the library choice. |
| Jackson 2.21.2 | **HIGH** | Version verified. Spring ecosystem 2.x alignment is the reason to defer Jackson 3. |
| HikariCP 6.x | **HIGH** | Repo and source verified; defaults confirmed; we override pool size per desktop use (PITFALLS m-8). |
| JSON-RPC (jsonrpc4j 1.6) | **HIGH** | GitHub releases confirm 1.6.0 (Jan 2021) is latest stable; 1.7 is unreleased on master. |
| PostgreSQL JDBC 42.7.11 | **HIGH** | Exact version verified. |
| MySQL Connector/J 9.x | **MEDIUM-HIGH** | Major line is clear; exact patch version (e.g., 9.1.0) was not deep-verified — pin to latest at build time. License (GPLv2 w/ FOSS exception) needs review before distribution. |
| Oracle ojdbc11 23.x | **MEDIUM** | Oracle's versioning cadence is irregular; verify at build time. ojdbc11 requires Java 11+. |
| H2 2.3.x | **MEDIUM-HIGH** | 2.x is the current major; exact patch not deep-verified. |
| electron-vite + electron-builder | **HIGH** | Both actively maintained; well-documented integration. |
| chokidar 4 | **HIGH** | Major line 4.x current. |
| electron-log 5.x | **HIGH** | Maintained; de-facto for Electron logging. |
| electron-store latest | **HIGH** | Sindre Sorhus's electron-store is the standard. |
| safeStorage (async) | **HIGH** | Electron built-in; per docs: async is non-blocking, supports key rotation, recommended over sync. |
| Monaco + @monaco-editor/react | **HIGH** | VS Code's engine, well-wrapped for React. |
| react-virtuoso 4.6.2 | **HIGH** | Version verified. |
| Zustand 5.0.12 | **HIGH** | Version verified. |
| TanStack Query 5.90.3 | **HIGH** | Version verified. |
| Zod 4.0.1 | **HIGH** | Version verified; v4 is a significant upgrade over v3. |
| JSONata 1.8.x | **HIGH** | Mature, used in IBM/Watson contexts. Java port `jsonata4java` available if helper-side use is needed. |
| Postman v2.1 schema | **HIGH** | Stable spec; widely understood. |
| victools/jsonschema-generator (validation only) | **MEDIUM-HIGH** | Right tool, but minor in our stack — most body-gen is application code. |
| JDK 21 LTS | **HIGH** | Current LTS, supported through at least Sept 2026 by all major vendors. |
| `keytar` (REJECTED) | **HIGH** | Archived 2022-12-15; explicit decision to NOT use. |
## 12. Open Questions for Phase-Specific Research
| Question | Resolved in | Notes |
|---|---|---|
| JavaParser symbol-solver coverage on real Spring projects (PITFALLS C-2) | Phase 2 | Build a 10+ project test corpus; aim for 100% endpoint detection |
| Eclipse JDT as a fallback if JavaParser gaps persist | Phase 2+ | Defer to v2; revisit only if gaps are showstoppers |
| Java records, sealed types, pattern matching in body gen (PITFALLS m-6, m-7) | Phase 3 | Set `ParserConfiguration.LanguageLevel.JAVA_21` explicitly; test against real Spring Boot 3.x projects |
| Lombok `@Data`, `@Builder.Default`, `@Accessors(fluent=true)` handling (PITFALLS C-3) | Phase 3 | Hybrid AST + ASM walker; document the v1 supported subset |
| Multi-module Maven/Gradle classpath assembly (PITFALLS M-9) | Phase 2 | Maven `<modules>` and Gradle `settings.gradle` parsing; cache `JarTypeSolver` set |
| Spring Boot 2.7 (`javax.*`) vs 3.x (`jakarta.*`) annotation matching (PITFALLS C-9) | Phase 2 | Match by FQN string; never require Spring on parser classpath |
| PostgreSQL `jsonb` column normalization (PITFALLS C-4) | Phase 4 | Per-driver `DbRowToJson` normalizer in helper |
| MySQL Connector/J GPLv2 license implications for closed-source distribution | Phase 4 (before release) | Either accept the terms, or dual-license, or replace with `mariadb-java-client` (LGPL) |
| Oracle JDBC distribution from Maven Central (requires Oracle's repo) | Phase 4 | Add Oracle's repo to the helper's Gradle config; document |
| `react-json-view` for read-only response trees (drag-source for chain mapping) | Phase 5 | Decide based on DX during chain step implementation |
| `ajv` for client-side JSON Schema validation | Phase 3+ (if needed) | Defer; not in v1 unless chain-step schema validation ships in v1 |
## 13. Sources
### Primary (HIGH confidence)
- **Electron 42.3.2 + Node 24 + Chromium 148 release metadata**: https://releases.electronjs.org/release?channel=stable
- **Electron support policy + cadence**: https://www.electronjs.org/docs/latest/tutorial/electron-timelines
- **Electron `safeStorage` (async API recommendation)**: https://www.electronjs.org/docs/latest/api/safe-storage
- **Electron `utilityProcess` (alternative to `child_process.spawn` for Node helpers)**: https://www.electronjs.org/docs/latest/api/utility-process
- **JavaParser 3.28.1 + symbol-solver-core**: https://context7.com/javaparser/javaparser (Maven snippet verified)
- **undici 7.x bundled with Node 24**: https://github.com/nodejs/undici/blob/main/docs/docs/best-practices/undici-vs-builtin-fetch.md
- **Vite 8.0.0 stable (2026-03-12) + @vitejs/plugin-react v6**: https://github.com/vitejs/vite/blob/main/packages/vite/CHANGELOG.md ; https://github.com/vitejs/vite/blob/main/vite/docs/blog/announcing-vite8.md
- **React 19 stable (Dec 2024)**: https://github.com/reactjs/react.dev/blob/main/src/content/blog/2024/12/05/react-19.md
- **HikariCP defaults (`DEFAULT_POOL_SIZE=10` etc.)**: https://github.com/brettwooldridge/hikaricp/blob/dev/src/main/java/com/zaxxer/hikari/HikariConfig.java
- **PostgreSQL JDBC 42.7.11**: https://context7.com/pgjdbc/pgjdbc (Maven snippet verified)
- **H2 2.x migration / current major**: https://github.com/h2database/h2database/blob/master/h2/src/docsrc/html/migration-to-v2.html
- **Jackson 2.21.2 + 3.1.1**: https://github.com/fasterxml/jackson-core/blob/3.x/README.md
- **jsonrpc4j 1.6.0 (Jan 2021) latest stable + 1.7 unreleased**: https://github.com/briandilley/jsonrpc4j/releases
- **keytar ARCHIVED 2022-12-15**: https://github.com/atom/node-keytar (banner: "This repository was archived by the owner on Dec 15, 2022. It is now read-only.")
- **Zod v4.0.1 release**: https://context7.com/colinhacks/zod
- **Zustand 5.0.12**: https://context7.com/pmndrs/zustand
- **TanStack Query 5.90.3**: https://context7.com/tanstack/query
- **react-virtuoso 4.6.2**: https://context7.com/petyosi/react-virtuoso
- **picocli 4.7+**: https://context7.com/remkop/picocli
### Secondary (MEDIUM-HIGH confidence — to re-verify at build time)
- MySQL Connector/J 9.x: see Maven Central `com.mysql:mysql-connector-j` (verified major line)
- Oracle ojdbc11 23.x: see Oracle's Maven repo / `com.oracle.database.jdbc:ojdbc11` (verified major line)
- H2 2.3.x: see Maven Central `com.h2database:h2` (verified major line)
### Cross-references (already in this project)
- **ARCHITECTURE.md** (this `.planning/research/` folder): independently recommends Electron, multi-process architecture, JSON-RPC over stdio, safeStorage, HikariCP. **No conflict** with this STACK.md.
- **FEATURES.md** (this `.planning/research/` folder): confirms all 31 active requirements are covered by this stack; no stack gap.
- **PITFALLS.md** (this `.planning/research/` folder): flags JavaParser symbol-solver (C-2), Lombok (C-3), PostgreSQL jsonb (C-4), DB credentials plaintext (C-6), Spring scan speed (C-8), Jakarta vs javax (C-9). This STACK.md explicitly addresses each in the corresponding section.
## 14. The One-Liner (Repeating from §0)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
- **Sketch findings for postman-clone** (design decisions, CSS patterns, visual direction) → `Skill("sketch-findings-postman-clone")`
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
