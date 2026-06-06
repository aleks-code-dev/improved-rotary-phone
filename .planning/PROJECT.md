# PostmanClone

## What This Is

A Postman-like API client built specifically for Java Spring developers. Point it at a local Spring project and it auto-detects every controller endpoint, generates request bodies from DTOs or live database rows, lets you chain requests with response-to-body field mapping, and turns the whole Spring codebase into a testable API surface in seconds.

The target user is a Spring backend developer who already has a project and wants to exercise its APIs without hand-writing cURL, OpenAPI clients, or fake data.

## Core Value

A Spring project becomes a live, executable API playground the moment you point this app at its root folder — endpoints detected, bodies generated, chains runnable, no manual spec authoring required.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

**Standard Postman parity (table stakes):**

- [x] **CORE-01**: User can build and send HTTP requests (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
- [x] **CORE-02**: User can view the equivalent cURL command for any request
- [x] **CORE-03**: User can define and reuse variables (environment, collection, global scopes)
- [x] **CORE-04**: User can save requests into named collections
- [x] **CORE-05**: User can set headers, query params, path params, and request body
- [x] **CORE-06**: User can view formatted response (status, headers, body, timing)
- [x] **CORE-07**: User can set authentication (Bearer, Basic, API key, none)
- [x] **CORE-08**: User can switch between request body modes (none, form-data, url-encoded, raw JSON/XML/text, binary)
- [x] **CORE-09**: User can persist a request history per collection
- [x] **CORE-10**: User can import/export collections (Postman v2.1 JSON format)

**Spring project integration (differentiator):**

- [x] **SPRING-01**: User can point the app at a local Spring project root and the app scans it
- [x] **SPRING-02**: App detects all `@RestController` / `@Controller` endpoints (method, path, HTTP verb, path/query params, consumes/produces)
- [x] **SPRING-03**: App resolves the request body DTO class for endpoints that accept a body (POST, PUT, PATCH)
- [x] **SPRING-04**: Detected endpoints appear in the sidebar organized by controller
- [x] **SPRING-05**: User can open a detected endpoint and have a prefilled request built automatically (path, method, body schema)

**Body generation — DTO schema mode:**

- [x] **BODY-01**: User can generate a JSON request body whose shape matches the DTO/class schema (field names, types, nesting, enums, collections, optionals)
- [x] **BODY-02**: Generated DTO-schema JSON includes sensible placeholder values (e.g., `"string"`, `0`, `true`) that the user can edit
- [x] **BODY-03**: App handles recursive types without infinite loops (cycle detection / `$ref` style markers)

**Body generation — DB data mode:**

- [x] **DB-01**: User can connect the app to a database (JDBC) used by the Spring project
- [x] **DB-02**: App lists available tables and their columns for the connected database
- [x] **DB-03**: User picks a table for a given endpoint's request body
- [x] **DB-04**: App fetches rows from the picked table and produces JSON shaped to match the endpoint's request body schema
- [x] **DB-05**: App maps table columns to body schema fields (user can override the mapping when names don't match)
- [x] **DB-06**: User can pick which row (by id, by query, or "first N") becomes the body
- [x] **DB-07**: DB credentials are stored locally and never sent off-device

**Request chaining (workflow testing):**

- [x] **CHAIN-01**: User can define an ordered chain of N requests
- [x] **CHAIN-02**: User can reference variables set from a previous chain step's response in a later step's URL/headers/body
- [x] **CHAIN-03**: User can run the whole chain end-to-end and view per-step results in sequence
- [x] **CHAIN-04**: User can re-run a single step in the chain without rerunning earlier steps
- [x] **CHAIN-05**: Chain definitions are saved with the collection

**Response-to-body mapping for chains:**

- [x] **MAP-01**: When building a later step's body, user can pull a field from any earlier step's response (e.g., `step1.response.body.id` → `body.userId`)
- [x] **MAP-02**: Mappings are explicit and editable (drag/select field from response tree to a field in the target body)
- [x] **MAP-03**: Mappings resolve at chain-run time, not edit time, so changing an earlier step's response automatically flows downstream
- [x] **MAP-04**: User can preview the resolved body for any step before running the chain

### Active

<!-- Current scope. Building toward these. All are hypotheses until shipped. -->

(None — all v1 requirements validated. See v2 requirements in REQUIREMENTS.md.)

### Out of Scope

- Non-Spring backends (Node, Go, Python, .NET) — single ecosystem keeps v1 focused; multi-stack is a separate effort
- Generating server-side code, scaffolding, or migrations — this app consumes Spring projects, does not modify them
- Cloud sync, team workspaces, sharing collections across users — single-user local tool
- API monitoring, scheduled runs, webhooks — out of v1 scope
- Mock servers generated from detected endpoints — v2
- GraphQL and gRPC support — REST/HTTP only in v1
- Auto-detecting which DB table maps to which endpoint — the user picks; the app does not infer this mapping
- CI/CD integrations — local developer tool only

## Context

- The Postman desktop app is the de-facto reference; users coming from it expect similar ergonomics (sidebar collections, request tabs, response panel, environment variables).
- The Spring ecosystem uses `@RestController`, `@RequestMapping`, `@GetMapping`/`@PostMapping`/etc., `@RequestBody`, `@PathVariable`, `@RequestParam` as the primary surface area for endpoints. Java DTOs/records are the primary request body shape.
- Java/Gradle/Maven projects have well-defined classpaths; the app can resolve DTOs by reading compiled `.class` files or by using the project's own classpath if it can launch a helper.
- Most Spring projects use JDBC against PostgreSQL/MySQL/Oracle/H2. The DB-data body mode needs to work across at least these.
- The user explicitly stated the app should NOT auto-detect endpoint↔table mapping — that is a deliberate design boundary, not a missing feature. The user owns the mapping decision.

## Constraints

- **Tech stack — desktop**: Must run as a desktop application (not just a web app) so it can read the local Spring project's source/classpath and connect to local databases without server-side proxies. Electron or Tauri are the realistic choices.
- **Tech stack — Java parsing**: App must parse Java source and/or compiled bytecode for Spring annotations. Options: javaparser (source), ASM (bytecode), or running the project's own classpath (heaviest).
- **Compatibility — Java**: Must support Spring Boot 2.7+ and Spring Boot 3.x projects (Jakarta vs javax namespace).
- **Compatibility — DB**: Must support PostgreSQL, MySQL, Oracle, and H2 in v1 (covers the vast majority of Spring projects).
- **Security — DB credentials**: DB credentials stored locally only. No network egress of credentials or query results.
- **Security — local project access**: App reads project files read-only. Never modifies the Spring project on disk.
- **Performance — scanning**: Initial project scan should complete in under 10 seconds for a typical Spring project (~100 controllers, ~500 endpoints).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Desktop app, not web | Needs filesystem + DB access without remote proxy | Electron 42.3.2 chosen; 3-process architecture |
| Spring-only in v1 | Focus enables a great Spring UX; multi-stack later | JavaParser 3.28.1 + symbol-solver for annotation detection |
| User picks endpoint↔table mapping (no inference) | User explicitly stated this; mappings are often non-obvious (DTO fields often don't match column names 1:1) | UI provides explicit mapping interface with type-compatibility indicators |
| Two body generation modes (DTO / DB), not one | DTO mode for "give me a valid shape"; DB mode for "give me real-looking data" | Both implemented: JavaParser AST walker (DTO) + HikariCP/JDBC (DB) |
| Response-to-body mapping is explicit (user-driven) | Implicit magic creates fragile tests; explicit mappings are reviewable | JSONata-based drag-and-drop mapping with preview |
| Read-only access to the Spring project | App is a consumer, not a modifier — keeps blast radius small | Enforced in JVM helper; no write access to project paths |
| cURL command shown as first-class output | Matches developer muscle memory; lets users paste into terminals | Monaco editor shows cURL with copy button |
| Chain definitions saved with the collection | Chains are reusable; treating them as first-class collection artifacts (not ephemeral) | Postman v2.1 + `chains` extension field format |

---

*Last updated: 2026-06-06 after milestone v2.1 completion*

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state
