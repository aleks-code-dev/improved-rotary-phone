# PostmanClone

## What This Is

A Postman-like API client built specifically for Java Spring developers. Point it at a local Spring project and it auto-detects every controller endpoint, generates request bodies from DTOs or live database rows, lets you chain requests with response-to-body field mapping, and turns the whole Spring codebase into a testable API surface in seconds.

The target user is a Spring backend developer who already has a project and wants to exercise its APIs without hand-writing cURL, OpenAPI clients, or fake data.

## Core Value

A Spring project becomes a live, executable API playground the moment you point this app at its root folder — endpoints detected, bodies generated, chains runnable, no manual spec authoring required.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. All are hypotheses until shipped. -->

**Standard Postman parity (table stakes):**

- [ ] **CORE-01**: User can build and send HTTP requests (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
- [ ] **CORE-02**: User can view the equivalent cURL command for any request
- [ ] **CORE-03**: User can define and reuse variables (environment, collection, global scopes)
- [ ] **CORE-04**: User can save requests into named collections
- [ ] **CORE-05**: User can set headers, query params, path params, and request body
- [ ] **CORE-06**: User can view formatted response (status, headers, body, timing)
- [ ] **CORE-07**: User can set authentication (Bearer, Basic, API key, none)
- [ ] **CORE-08**: User can switch between request body modes (none, form-data, url-encoded, raw JSON/XML/text, binary)
- [ ] **CORE-09**: User can persist a request history per collection
- [ ] **CORE-10**: User can import/export collections (Postman v2.1 JSON format)

**Spring project integration (differentiator):**

- [ ] **SPRING-01**: User can point the app at a local Spring project root and the app scans it
- [ ] **SPRING-02**: App detects all `@RestController` / `@Controller` endpoints (method, path, HTTP verb, path/query params, consumes/produces)
- [ ] **SPRING-03**: App resolves the request body DTO class for endpoints that accept a body (POST, PUT, PATCH)
- [ ] **SPRING-04**: Detected endpoints appear in the sidebar organized by controller
- [ ] **SPRING-05**: User can open a detected endpoint and have a prefilled request built automatically (path, method, body schema)

**Body generation — DTO schema mode:**

- [ ] **BODY-01**: User can generate a JSON request body whose shape matches the DTO/class schema (field names, types, nesting, enums, collections, optionals)
- [ ] **BODY-02**: Generated DTO-schema JSON includes sensible placeholder values (e.g., `"string"`, `0`, `true`) that the user can edit
- [ ] **BODY-03**: App handles recursive types without infinite loops (cycle detection / `$ref` style markers)

**Body generation — DB data mode:**

- [ ] **DB-01**: User can connect the app to a database (JDBC) used by the Spring project
- [ ] **DB-02**: App lists available tables and their columns for the connected database
- [ ] **DB-03**: User picks a table for a given endpoint's request body
- [ ] **DB-04**: App fetches rows from the picked table and produces JSON shaped to match the endpoint's request body schema
- [ ] **DB-05**: App maps table columns to body schema fields (user can override the mapping when names don't match)
- [ ] **DB-06**: User can pick which row (by id, by query, or "first N") becomes the body
- [ ] **DB-07**: DB credentials are stored locally and never sent off-device

**Request chaining (workflow testing):**

- [ ] **CHAIN-01**: User can define an ordered chain of N requests
- [ ] **CHAIN-02**: User can reference variables set from a previous chain step's response in a later step's URL/headers/body
- [ ] **CHAIN-03**: User can run the whole chain end-to-end and view per-step results in sequence
- [ ] **CHAIN-04**: User can re-run a single step in the chain without rerunning earlier steps
- [ ] **CHAIN-05**: Chain definitions are saved with the collection

**Response-to-body mapping for chains:**

- [ ] **MAP-01**: When building a later step's body, user can pull a field from any earlier step's response (e.g., `step1.response.body.id` → `body.userId`)
- [ ] **MAP-02**: Mappings are explicit and editable (drag/select field from response tree to a field in the target body)
- [ ] **MAP-03**: Mappings resolve at chain-run time, not edit time, so changing an earlier step's response automatically flows downstream
- [ ] **MAP-04**: User can preview the resolved body for any step before running the chain

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
| Desktop app, not web | Needs filesystem + DB access without remote proxy | — Pending |
| Spring-only in v1 | Focus enables a great Spring UX; multi-stack later | — Pending |
| User picks endpoint↔table mapping (no inference) | User explicitly stated this; mappings are often non-obvious (DTO fields often don't match column names 1:1) | — Pending |
| Two body generation modes (DTO / DB), not one | DTO mode for "give me a valid shape"; DB mode for "give me real-looking data" | — Pending |
| Response-to-body mapping is explicit (user-driven) | Implicit magic creates fragile tests; explicit mappings are reviewable | — Pending |
| Read-only access to the Spring project | App is a consumer, not a modifier — keeps blast radius small | — Pending |
| cURL command shown as first-class output | Matches developer muscle memory; lets users paste into terminals | — Pending |
| Chain definitions saved with the collection | Chains are reusable; treating them as first-class collection artifacts (not ephemeral) | — Pending |

---

*Last updated: 2026-06-03 after initialization*

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
