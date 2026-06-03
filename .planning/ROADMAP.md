# Roadmap: PostmanClone

## Overview

PostmanClone is a desktop API client built for Java Spring developers. The journey starts with a 3-process architecture (Electron renderer + Node main + Java 21 helper) and a full Postman alternative (CORE parity), then layers on three Spring-aware differentiators: project scanning with prefilled requests, schema- and database-driven body generation, and multi-step request chains with response-to-body field mapping. Each phase ships a vertically-complete MVP slice — at the end of any phase, the app is useful on its own.

## Phases

- [ ] **Phase 1: Foundation & Postman Parity** - Establish 3-process architecture + ship a full Postman alternative (CORE-01..10)
- [ ] **Phase 2: Spring Project Detection** - Point at a Spring project, detect all `@RestController` endpoints, click to get a prefilled request (SPRING-01..05)
- [ ] **Phase 3: Body Generation (DTO + DB)** - Generate request bodies from DTO schemas or real database rows (BODY-01..03 + DB-01..07)
- [ ] **Phase 4: Workflow Chains & Response Mapping** - Build multi-step chains where later steps pull fields from earlier responses (CHAIN-01..05 + MAP-01..04)

## Phase Details

### Phase 1: Foundation & Postman Parity

**Goal**: Establish the 3-process desktop architecture (Electron renderer + Node main + Java 21 helper) and ship a fully usable Postman alternative covering all CORE requirements.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: CORE-01, CORE-02, CORE-03, CORE-04, CORE-05, CORE-06, CORE-07, CORE-08, CORE-09, CORE-10
**Success Criteria** (what must be TRUE):

  1. User can launch the desktop app and see the 3-pane UI (sidebar / request editor / response viewer) with the JVM helper subprocess running and healthy in the background.
  2. User can build and send any HTTP request (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS) and view the formatted response (status, headers, body, timing) — all HTTP goes through the main process (no browser CORS).
  3. User can set headers, query params, path params, a body (none / form-data / url-encoded / raw JSON·XML·text / binary), and per-request auth (None / Bearer / Basic / API key), and see the equivalent cURL command for any request.
  4. User can save requests into named collections (with nested folders), define variables in 4 scopes (global / environment / collection / request) with proper precedence, and view a per-collection request history.
  5. User can import a Postman v2.1 collection and export it back round-trip without data loss, and the helper-supervisor proves itself by surviving a forced kill (auto-restart with exponential backoff).

**Plans**: TBD (1-3 plans for coarse granularity)
**UI hint**: yes

Plans:
**Wave 1**

- [ ] 01-01: Scaffold 3-process architecture (Electron 42 + Vite 8 + React 19 + TS, preload `contextBridge`, JSON-RPC 2.0 stdio wire, JVM helper supervisor with restart policy)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 01-02: HTTP client + request/response editor (CORE-01, CORE-05, CORE-06, CORE-08, CORE-02) — main-process undici 7 client, Monaco body editor, response viewer

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 01-03: Collections, variables, auth, history, import/export (CORE-03, CORE-04, CORE-07, CORE-09, CORE-10) — Postman v2.1 storage layout, 4-scope resolver, electron-store + safeStorage

### Phase 2: Spring Project Detection

**Goal**: User can point the app at a local Spring project and see every `@RestController` endpoint in a sidebar — clicking one builds a prefilled request with the DTO body shape already filled in.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: SPRING-01, SPRING-02, SPRING-03, SPRING-04, SPRING-05
**Success Criteria** (what must be TRUE):

  1. User can point the app at a local Spring project root; the JVM helper scans it and the sidebar shows all detected `@RestController` / `@Controller` endpoints grouped by controller.
  2. Each detected endpoint exposes method, full merged path, path variables, query params, `consumes`, and `produces` — and works on Spring Boot 2.7+ and 3.x (Jakarta vs javax annotation drift does not break detection).
  3. User can click a detected endpoint and the app opens a prefilled request: URL, method, headers, and the request body DTO class resolved and ready to use.
  4. The scanner hits 100% endpoint coverage on a 10+ real Spring project test corpus (petclinic, realworld, mall, etc.), surviving Lombok, records, sealed types, multi-module Maven, and inner-class scope.
  5. Scan completes in under 10 seconds for a typical Spring project (~100 controllers / ~500 endpoints), with a denylist for `.git/` / `target/` / `node_modules/` / `build/` and a 1MB per-file size cap.

**Plans**: TBD (1-3 plans for coarse granularity)
**UI hint**: yes

Plans:

- [ ] 02-01: JVM helper scanner module + 10+ project test corpus as day-one deliverable (JavaParser 3.28.1 + `CombinedTypeSolver`, Annotation FQN matching, denylist, mtime-based cache)
- [ ] 02-02: Sidebar with controller-grouped endpoints, endpoint metadata extraction, DTO class resolution for body-bearing methods
- [ ] 02-03: Click-to-prefill request (URL, method, headers, body schema placeholder) + open-time rescan and explicit rescan button

### Phase 3: Body Generation (DTO + DB)

**Goal**: User can generate valid-shape request bodies either from a DTO schema (placeholder values) or from real database rows (mapped to the DTO) — both modes build on Phase 2's endpoint and DTO detection.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: BODY-01, BODY-02, BODY-03, DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, DB-07
**Success Criteria** (what must be TRUE):

  1. User can click "Generate from DTO" on a detected endpoint and the body editor shows a JSON body whose shape matches the DTO schema (field names, types, nesting, enums, collections, Optional, records) with sensible editable placeholders (`"string"`, `0`, `true`, etc.).
  2. Recursive DTOs (bidirectional `@OneToMany` / `@ManyToOne`) do not crash the app — the body emits `$ref`-style cycle markers or a `_cycle` placeholder with a visible warning, and recursion depth is capped at 6.
  3. User can create a database connection (PostgreSQL, MySQL, Oracle, H2) with credentials encrypted via Electron `safeStorage` (DPAPI/Keychain/libsecret); plaintext is never written to disk, never logged, never sent off-device.
  4. User can pick a table and a row (by id, by custom WHERE query, or "first N rows") and the app produces a JSON body from that row, shaped to match the endpoint's DTO schema.
  5. User can override column→field mappings when column names don't match DTO field names, with color-coded type-compatibility indicators (green / yellow / red) and a required-field coverage badge.

**Plans**: TBD (1-3 plans for coarse granularity)
**UI hint**: yes

Plans:

- [ ] 03-01: DTO schema body generation + cycle detection (BODY-01..03) — schema walker, hybrid field+getter walk for Lombok, `$ref` markers, depth cap 6
- [ ] 03-02: DB connection management (DB-01, DB-02, DB-07) — HikariCP pool (size 2 for desktop), JDBC drivers bundled in helper fat-jar, `safeStorage` encryption, per-driver type normalizer for `jsonb` / `JSON` / `CLOB`
- [ ] 03-03: Table→row selection + column→field mapping UI (DB-03..06) — row picker, LIMIT cap 100, color-coded mapping editor, required-field coverage

### Phase 4: Workflow Chains & Response Mapping

**Goal**: User can build ordered multi-step chains where later steps reference earlier responses — completing the "Spring project → live API playground" story end to end.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: CHAIN-01, CHAIN-02, CHAIN-03, CHAIN-04, CHAIN-05, MAP-01, MAP-02, MAP-03, MAP-04
**Success Criteria** (what must be TRUE):

  1. User can define an ordered chain of N requests inside a collection, save it with the collection (Postman v2.1 + `chains` extension), and re-open it later.
  2. User can run the whole chain end-to-end and see per-step results in sequence (status, response body, applied mappings, timing).
  3. User can re-run a single step in the chain without rerunning earlier steps, and per-step timeout / retry policy is honored without freezing the UI.
  4. User can drag a field from any earlier step's response tree onto a field in a later step's body / header / URL — the mapping is explicit, editable, and shows in a clear source→target view.
  5. Mappings resolve at chain-run time (not edit time) and the user can preview the resolved body for any step before running the chain, so a changed earlier response automatically flows downstream.

**Plans**: TBD (1-3 plans for coarse granularity)
**UI hint**: yes

Plans:

- [ ] 04-01: Chain model + run-all + single-step re-run (CHAIN-01, CHAIN-03, CHAIN-04, CHAIN-05) — chain orchestrator in main process, per-step timeout/retry, persistence in collection JSON
- [ ] 04-02: Variable reference syntax `{{stepN.response.body.path}}` (CHAIN-02) — JSONata 1.8 path expressions, resolution logging, circular-reference detection
- [ ] 04-03: Response→body mapping editor + preview resolved body (MAP-01..04) — drag from response tree, explicit mapping table, run-time resolution, preview button

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Postman Parity | 0/TBD | Not started | - |
| 2. Spring Project Detection | 0/TBD | Not started | - |
| 3. Body Generation (DTO + DB) | 0/TBD | Not started | - |
| 4. Workflow Chains & Response Mapping | 0/TBD | Not started | - |

**Coverage:**

- v1 requirements: 34 total
- Mapped to phases: 34/34 ✓
- Unmapped: 0

**Phase distribution:**

- Phase 1: 10 requirements (CORE-01..10)
- Phase 2: 5 requirements (SPRING-01..05)
- Phase 3: 10 requirements (BODY-01..03 + DB-01..07)
- Phase 4: 9 requirements (CHAIN-01..05 + MAP-01..04)
