# Feature Landscape

**Domain:** Desktop API client for Java Spring developers (PostmanClone)
**Researched:** 2026-06-03
**Sources:** Postman docs, Bruno docs, Insomnia (Kong) docs, JetBrains HTTP Client docs, Spring Framework reference, market observation

---

## Executive Summary

The API-client market has converged on a clear **table-stakes baseline** — request building, collections, variables, response viewing, multiple body modes, basic auth, cURL import/export, request history. Every major competitor (Postman, Insomnia, Bruno, JetBrains HTTP Client) ships this. No single one of these features differentiates; missing any one of them and the product feels broken.

What **does** differentiate — and what PostmanClone's value proposition depends on — is **codebase awareness**: a desktop app that reads a Spring project, detects controllers, resolves DTOs, and turns a Java codebase into a live, executable API surface. No general-purpose client does this today. Postman, Insomnia, and Bruno work against OpenAPI specs or hand-built collections; JetBrains' HTTP Client has endpoint gutters for Spring controllers but only produces a single request stub, not a navigable surface with body generation.

The right v1 posture: **ship the table-stakes baseline tightly, then dominate on the Spring-differentiation surface.** Everything else (GraphQL, gRPC, mocks, monitoring, scripting, mocks, collaboration, AI) is the territory of platform products with 10× PostmanClone's scope — and is explicitly out of scope per PROJECT.md.

**v1 deliverable shape:** ~31 active requirements across CORE / SPRING / BODY / DB / CHAIN / MAP, all already defined in PROJECT.md. The differentiator surface is ~24 of those — the Spring-aware engine is the product.

**v2 surface (natural extensions):** OpenAPI export/import, mock servers from detected endpoints, basic test assertions, Spring Security/CSRF awareness, profile-aware endpoint filtering, multi-DB expansion (SQL Server, MongoDB via JDBC), richer auth (OAuth 2.0, mTLS).

**Deliberately NOT built (per PROJECT.md + industry reality):** GraphQL, gRPC, WebSocket, SOAP, cloud sync, team workspaces, API monitoring, scheduled runs, CI/CD, server-side code generation, auto endpoint↔table inference, plugin system, AI features, full scripting engine.

---

## 1. Table Stakes (Standard Postman Parity)

These features are **expected by every user coming from Postman/Insomnia/Bruno**. Missing any of them and the product is unusable for the target audience. All map to CORE-01..CORE-10 in PROJECT.md (already validated as in-scope).

### 1.1 Request Construction (CORE-01, CORE-05)

| Feature | Source | Notes / Complexity |
|---------|--------|-------------------|
| HTTP method picker: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS | Postman, Bruno, Insomnia, JetBrains | **Low.** Standard dropdown. |
| URL bar with variable interpolation (`{{baseUrl}}`) | All | **Low.** Pre-req: variable scope engine. |
| Query params editor (key/value table) | All | **Low.** |
| Path params editor (parsed from URL braces) | All | **Low.** |
| Headers editor (key/value, with default-header display) | All | **Low.** |
| Request body with multiple modes | All | **Medium.** See 1.7 below. |

**Complexity:** Low overall. The hard part of CORE-01 is not the UI but the variable resolution engine and the body-mode state machine.

### 1.2 cURL Interop (CORE-02)

| Feature | Source | Notes / Complexity |
|---------|--------|-------------------|
| Generate cURL command from any request (copy-to-clipboard) | All | **Low.** Pure text transformation. |
| Import cURL command into a new request (paste-handler) | Postman, Bruno, JetBrains | **Low.** Parse a single cURL string, map to internal request model. |

**Why table stakes:** Developers routinely paste from terminal to repo issues, Slack, stack overflow, and back. Both directions are expected. JetBrains' HTTP Client auto-converts on paste, which is now the de-facto UX.

### 1.3 Variables (CORE-03)

| Feature | Source | Notes / Complexity |
|---------|--------|-------------------|
| Global scope | All | **Low.** Stored locally, no sync. |
| Environment scope (named environments) | All | **Low.** Dev/Staging/Prod switching. |
| Collection scope | Postman, Bruno | **Low.** |
| Request scope (request-local) | Bruno, JetBrains | **Low.** |
| Folder scope (sub-grouping) | Bruno | **Low.** Optional — skip in v1. |
| Variable interpolation in URL, headers, body | All | **Medium.** Needs `{{var}}` parser and scope precedence. |

**Scope precedence (industry standard, must follow):** Local > Data > Environment > Collection > Global. Lock this in from v1 — Postman users will expect it.

**Variable types:** `string` (default), `secret` (masked in logs/screenshots), `any` for nested objects. v1 should support string + secret.

### 1.4 Collections (CORE-04)

| Feature | Source | Notes / Complexity |
|---------|--------|-------------------|
| Named collections | All | **Low.** |
| Folders (nested) inside collections | Postman, Bruno | **Low.** |
| Save request into collection | All | **Low.** |
| Move/copy requests between collections/folders | All | **Low.** |
| Duplicate request | All | **Low.** |
| Search across collection | All | **Low** with a search input. |
| Persistence (local filesystem) | All | **Low.** See 1.9 (storage format). |

**Why folders matter:** Postman users organize by service/module (`Users/`, `Orders/`). Without folders, a 50-endpoint collection is unusable.

### 1.5 Response Viewing (CORE-06)

| Feature | Source | Notes / Complexity |
|---------|--------|-------------------|
| Status line (code, status text, HTTP version) | All | **Low.** |
| Response time + size | All | **Low.** |
| Headers table | All | **Low.** |
| Body with format auto-detect (JSON, XML, HTML, image, PDF) | All | **Medium.** Need a body viewer component per format. |
| Body pretty-print toggle | All | **Low.** |
| Body syntax highlighting | All | **Low.** |
| Body raw vs preview toggle | All | **Low.** |
| Save response body to file | All | **Low.** |
| Copy response to clipboard | All | **Low.** |
| Search/filter within response body | All | **Low.** |
| Image/PDF inline preview | All | **Medium.** Nice-to-have. |

**Minimum for v1:** Status, headers, time/size, JSON pretty-print with syntax highlight, copy-to-clipboard, search-in-body.

**Defer to v2:** Image/PDF preview, advanced rendering (hex view, raw byte inspect for binary).

### 1.6 Authentication (CORE-07)

| Feature | Source | Notes / Complexity |
|---------|--------|-------------------|
| No auth | All | **Low.** Default. |
| Bearer token | All | **Low.** |
| Basic auth | All | **Low.** |
| API key (header or query) | All | **Low.** |
| Inherit from parent (collection-level auth) | Postman, Bruno | **Medium.** Inheritance model needs design. |

**Already in PROJECT.md Active list. Lock the four types above for v1.**

**Defer to v2 (high complexity, low value for v1):**
- OAuth 1.0 / OAuth 2.0 (requires token endpoint, grant flows, refresh logic — Bruno devotes 8 doc pages to it; not core to a Spring-focused tool where most devs use JWT bearer)
- AWS Sig v4 (irrelevant for Spring)
- Digest / NTLM (legacy, ~1% usage)
- mTLS / client certificates (Spring uses these for some auth — flag as v2 candidate, see Differentiators)

### 1.7 Request Body Modes (CORE-08)

| Mode | Source | Notes / Complexity |
|------|--------|-------------------|
| None | All | **Low.** |
| form-data (multipart, with file picker) | All | **Medium.** Need file picker. |
| url-encoded (`application/x-www-form-urlencoded`) | All | **Low.** |
| raw (JSON / XML / text, with content-type picker) | All | **Low.** |
| binary (file body) | All | **Low.** |
| GraphQL (typed body) | Postman, Insomnia, Bruno | **Defer to v2.** Project scope is REST only. |

**v1 body modes: none / form-data / url-encoded / raw / binary.** The "JSON" subset of "raw" gets extra features (JSON schema validation, JSONPath search) but it's still a raw mode.

### 1.8 Request History (CORE-09)

| Feature | Source | Notes / Complexity |
|---------|--------|-------------------|
| Persist last N requests per collection | All | **Low.** Ring buffer or capped list. |
| Click a history entry to re-send | All | **Low.** |
| Show timestamp, method, URL, status | All | **Low.** |
| Search/filter history | All | **Low.** |
| Clear history (per collection) | All | **Low.** |
| Disable history (per request) via `@no-log`-style tag | JetBrains | **Low.** Required for requests with secrets. |

**Cap default:** 100 entries per collection. Configurable.

### 1.9 Import / Export (CORE-10)

| Feature | Source | Notes / Complexity |
|---------|--------|-------------------|
| Import Postman v2.1 collection JSON | All | **Medium.** Postman format is rich; need to map to internal model. |
| Import Postman environment JSON | All | **Low.** |
| Export collection to Postman v2.1 | All | **Medium.** Lossy round-trip (e.g., chain definitions may not have Postman equivalent — see 3.4). |
| Export environment | All | **Low.** |
| Import cURL (one-off) | All | **Low** (already covered in 1.2). |
| Import OpenAPI 3.0 spec | Postman, Bruno, Insomnia, JetBrains | **Defer to v2.** Spring scan (SPRING-01..05) is the v1 entry point; OpenAPI import is the alternative path. |
| Import WSDL | Postman, Bruno, JetBrains | **Defer.** SOAP out of scope. |
| Import Insomnia export | Bruno (converts), Insomnia native | **Skip v1.** Insomnia users are a secondary audience. |

**Decision for v1:** Postman v2.1 import/export only. OpenAPI is v2.

### 1.10 Code Generation (Adjacent to cURL)

| Feature | Source | Notes / Complexity |
|---------|--------|-------------------|
| Generate as cURL | All | **Low.** Required (CORE-02). |
| Generate as fetch / XHR / Python requests / Java HttpClient / etc. | Postman, Bruno | **Low each, medium cumulative.** Each is a template. |

**Decision for v1:** cURL only (CORE-02). Other language code-gen is a v2 convenience.

### 1.11 Per-Request Settings (Not currently in Active)

These are table-stakes details that should ship in v1 even though they're not called out as separate CORE-* requirements. Group them under a single "per-request settings" concept.

| Feature | Source | Notes / Complexity |
|---------|--------|-------------------|
| Per-request timeout (ms) | Bruno (1000-300000ms, default 30000) | **Low.** |
| Follow redirects on/off + max redirect count | Bruno (1-50, default 5) | **Low.** |
| Auto URL-encode parameters | Bruno | **Low.** |
| Verify SSL cert | All | **Low.** |
| Send/omit default headers | All | **Low.** |

**Note for PROJECT.md:** These are properties of the request model that the v1 implementation must support. Recommend adding a CORE-11 requirement: "User can configure per-request execution settings (timeout, redirects, SSL verification)".

### 1.12 Other Table-Stakes Items to Verify in v1

These are present in most competitors and would be noticed by their absence — but they're not currently in the Active list. Flag for review during requirements finalization.

| Feature | Source | Recommendation |
|---------|--------|----------------|
| Cookie jar (auto-send cookies on matching domain) | Postman, Insomnia, JetBrains | **v1.** Almost every real API uses session cookies or CSRF tokens. |
| Proxy configuration (HTTP / SOCKS, with auth) | All | **v1.** Common in enterprise. |
| Tabs (multiple requests open at once) | All | **v1.** Expected UX. |
| Keyboard shortcuts (send, save, switch tab) | All | **v1.** Expected by power users. |
| Dark / light theme | All | **v1.** Trivial to add, big perceived-quality win. |
| SSL client certificate (mTLS) | Postman, Bruno, Insomnia | **v2 candidate.** Some Spring services require mTLS; non-trivial. |

---

## 2. Differentiators (The Spring-Aware Engine)

These are features that **no general-purpose API client ships today** and they form PostmanClone's product moat. All map to existing SPRING-* / BODY-* / DB-* / CHAIN-* / MAP-* in PROJECT.md.

### 2.1 Spring Project Scanning (SPRING-01..SPRING-05)

| Feature | Active ID | Complexity | Why It Matters |
|---------|-----------|------------|----------------|
| Point app at Spring project root, trigger scan | SPRING-01 | **Medium** | Single click. App must detect Gradle vs Maven, locate `src/main/java` + `build/classes` (Maven) or `build/classes/java/main` (Gradle). |
| Detect `@RestController` / `@Controller` | SPRING-02 | **High** | Must parse source AND resolve compiled classpath to read annotations. Recursive scan of all packages under main sources root. |
| Extract endpoint method + path + verb | SPRING-02 | **High** | Resolve `@RequestMapping`, `@GetMapping`/`@PostMapping`/etc., merge class-level + method-level paths. Handle `consumes`, `produces`, path patterns. |
| Extract path params, query params | SPRING-02 | **High** | Read `@PathVariable`, `@RequestParam` names and types from method signature. |
| Resolve request body DTO class | SPRING-03 | **High** | Read `@RequestBody` parameter type; resolve via classpath; handle `Optional<T>`, generics, inheritance. |
| Sidebar shows endpoints grouped by controller | SPRING-04 | **Low** | Tree view. |
| Click endpoint → prefilled request | SPRING-05 | **Medium** | Pre-populate method, URL template, body schema (from DTO). |

**Hard problem: resolving DTOs.** Three approaches (PROJECT.md Constraints):
1. **javaparser (source)** — fastest iteration, but loses type-erasure info; generics need workarounds.
2. **ASM (bytecode)** — works without sources, robust to generics; requires `build/classes` to be present.
3. **Run the project's classpath** — heaviest, most accurate; requires embedding a JVM or shelling out.

**Recommendation:** javaparser for source-aware metadata (annotations, generics) + ASM as fallback when sources are missing. Do not embed a JVM in v1 — too heavy for desktop.

**Hard problem: Spring Boot 2.7 vs 3.x.** `javax.*` vs `jakarta.*` namespaces. Scan code must normalize both. This is table-stakes hygiene for "Spring support" — v1 must work on both.

**Hard problem: classpath resolution.** When `@RequestBody SomeDto body` is in code, the app must find `SomeDto.class` to inspect its fields. The scan must walk the dependency JARs in the user's `.m2` or `~/.gradle/caches`. This is real complexity — likely the largest engineering risk in v1.

### 2.2 DTO-Driven Body Generation (BODY-01..BODY-03)

| Feature | Active ID | Complexity | Notes |
|---------|-----------|------------|-------|
| Generate JSON matching DTO schema | BODY-01 | **High** | Recursive field walk: primitives, enums, collections, nested objects, generics, inheritance, records (Java 14+). |
| Placeholder values user can edit | BODY-02 | **Medium** | Smart placeholders by type: `"string"`, `0`, `false`, ISO date, ISO datetime, UUID. Respect Bean Validation annotations (`@NotNull`, `@Size`, `@Min`, `@Max`, `@Pattern`) when present. |
| Cycle detection | BODY-03 | **Medium** | Track seen types. Emit `"$ref": "#/components/schemas/TypeName"` style marker, or break cycle with a depth limit + null. |

**Why it matters:** Most API clients make the user hand-type the JSON body. Even with a schema available, the user must construct the payload. PostmanClone eliminates this. This is the single most visible "magic moment" of the product.

**Edge cases to handle (track as research items):**
- Java `record` types (immutable, no setters) — field discovery still works.
- Lombok `@Data`, `@Getter`, `@Value` — bytecode-only, requires ASM path.
- `@JsonIgnore`, `@JsonProperty` (Jackson) — must respect.
- Generic types (`Response<Page<User>>`).
- `Map<String, T>` — emit `{}` with one example entry.
- Polymorphism (`@JsonTypeInfo`) — best-effort, emit base.

### 2.3 DB-Driven Body Generation (DB-01..DB-07)

| Feature | Active ID | Complexity | Notes |
|---------|-----------|------------|-------|
| JDBC connection to user DB | DB-01 | **Medium** | Standard JDBC URL + credentials. No driver bundling — user provides driver jar path or points to project's classpath. |
| List tables and columns | DB-02 | **Low** | Schema introspection (`DatabaseMetaData.getTables`, `getColumns`). |
| User picks table for endpoint | DB-03 | **Low** | UI: dropdown of tables. |
| Fetch rows, emit JSON shaped to DTO | DB-04 | **High** | Per-row SELECT, then per-row map → JSON using the same engine as BODY-01. |
| Column-to-field mapping (with override) | DB-05 | **Medium** | Default: case-insensitive name match + snake_case ↔ camelCase. UI: editable two-column table (column ↔ field). |
| Row selection: by id / by query / first N | DB-06 | **Medium** | Need query builder UI (simple) or raw SQL editor (advanced). |
| Local credential storage, no egress | DB-07 | **Low** | OS keychain or encrypted local file. Never in logs, never in export. |

**Why it matters:** Real-looking data beats invented data. If a Spring dev wants to test a "create order" endpoint, the body should look like a real order — pulled from a real order row. This is unique to PostmanClone.

**Critical design constraint (PROJECT.md, confirmed):** the user picks the table. The app **never** infers "this endpoint uses this table." That is a user-driven decision.

**Multi-DB coverage (PROJECT.md Constraint):** PostgreSQL, MySQL, Oracle, H2 in v1. **Add SQL Server as v1 candidate** — it's a top-3 enterprise Spring DB. MongoDB would require a JDBC-mongo shim and is out of scope; defer.

### 2.4 Request Chaining (CHAIN-01..CHAIN-05)

| Feature | Active ID | Complexity | Notes |
|---------|-----------|------------|-------|
| Define ordered chain of N requests | CHAIN-01 | **Low** | UI: ordered list with drag-to-reorder. |
| Reference earlier step's response in URL/headers/body | CHAIN-02 | **Medium** | Variable syntax: `{{step1.response.body.id}}` or similar. Resolution engine walks the chain. |
| Run full chain end-to-end, view per-step results | CHAIN-03 | **Medium** | Sequential executor; UI shows per-step status, time, response, errors. Abort on first failure or continue (configurable). |
| Re-run single step | CHAIN-04 | **Low** | Re-uses prior step's stored responses. |
| Chain saved with collection | CHAIN-05 | **Low** | Persisted in collection JSON. |

**Why it matters:** This is the "execute a user signup flow" killer feature — POST user, capture id, POST order with that user id, capture order id, GET order by id. Postman/Bruno can do this with script (test-script + post-response), but script is a barrier for users who just want to click "run chain." The chain abstraction is a usability win even though the engine is comparable.

**Design choices to make explicit:**
- **Failure handling:** stop on first failure vs. continue-and-report? **Default: stop, with override.**
- **Variable scope:** chain step (transient) vs. chain global (persists across step iterations).
- **Manual ordering vs. dependency graph:** v1 is **manual ordered list**, no DAG. Simpler model, covers 90% of cases.

### 2.5 Response-to-Body Mapping (MAP-01..MAP-04)

| Feature | Active ID | Complexity | Notes |
|---------|-----------|------------|-------|
| Pull field from earlier step's response into a later step's body | MAP-01 | **High** | UI: drag from response tree → drop on body field, or pick from a popup. |
| Explicit, editable mappings | MAP-02 | **Medium** | Storage model: list of `{source: "step1.response.body.users[0].id", target: "body.userId"}`. |
| Mappings resolve at run time, not edit time | MAP-03 | **Medium** | Avoid caching resolved values. Re-evaluate on every step run. |
| Preview resolved body before running | MAP-04 | **Medium** | With all upstream steps "frozen" at last run, show what body would be. |

**Why it matters:** The combination of CHAIN-* + MAP-* + DB-* is the **end-to-end workflow story**:
1. POST `/users` (DTO-schema body) → response has `id`.
2. POST `/orders` with body `userId` ← `{{step1.response.body.id}}` (response-mapping) → body is shaped like OrderDTO.
3. Run chain: dev sees user created, then order created with that user.

This is what "Spring project becomes a live API playground" looks like.

---

## 3. v2 Surface (Natural Extensions, Not in Active)

These features are **commonly expected** in mature API clients but should be deferred from v1 to protect scope. They fall into clear categories: import path alternatives, depth on the differentiator surface, polish on the table-stakes surface, and cross-cutting platform features.

### 3.1 Import Path Alternatives to Spring Scan

| Feature | Why Defer | Trigger |
|---------|-----------|---------|
| OpenAPI 3.0 import (alternative to scanning) | Most natural v2 once scan is solid; gives users whose project isn't on Spring 2.7+/3.x a path in. | v2.0 |
| Postman v2.1 round-trip (lossless export incl. chains) | Round-trip with chains needs a Postman-extension schema; ship once chains are stable. | v2.0 |
| Insomnia / Bruno collection import | Secondary audience. | v2.x |

### 3.2 Depth on Differentiator Surface

| Feature | Why Defer | Trigger |
|---------|-----------|---------|
| Mock server generated from detected endpoints | Listed as v2 in PROJECT.md Out of Scope. High value but high scope. | v2.x |
| Spring Security/CSRF auto-detect | Detect CSRF token endpoint and inject token automatically. | v2.x |
| Spring profile-aware endpoint filtering | Only show endpoints for active Spring profile. | v2.x |
| Spring `application.properties` / `application.yml` aware | Auto-pick base URL from server.port. | v2.x |
| Multi-project workspaces (scan N Spring projects at once) | Most users have one project. | v2.x |
| Return type introspection (DTO → response schema for response-viewer) | Useful for "what does this endpoint return?" but not in v1 spec. | v2.x |
| Recompile-watcher (re-scan on Java rebuild) | Triggers re-detect when user changes controllers. | v2.x |
| Validation constraint-aware placeholders (Bean Validation) | `@NotNull`, `@Size`, `@Email` influence placeholder choice. **Strong v2 candidate** — natural depth on BODY-01. | v2.x |

### 3.3 Depth on Table-Stakes Surface

| Feature | Why Defer | Trigger |
|---------|-----------|---------|
| OAuth 1.0 / OAuth 2.0 / mTLS auth | Big implementation, low priority for Spring dev. | v2.x |
| Code generation (Java/JS/Python/etc.) | Easy individually; aggregate is a long tail. | v2.x |
| Image / PDF inline response preview | Polish, not core. | v2.x |
| Response visualization (charts/tables) | Postman Visualizer-style; nice but not core. | v2.x |
| Per-request scripts (pre/post JS) | Replaces/competes with Java; defer or skip. | v2.x |
| Basic test assertions (`pm.expect(...).to.eql(...)` style) | Chain run already gives per-step status. | v2.x |
| Response diff (compare two responses) | Useful for debugging, not core. | v2.x |
| Snippet / live templates for common request shapes | Polish. | v2.x |
| Custom request methods (custom verbs) | Rare. | v2.x |
| Bulk operations on requests (multi-select, bulk move/delete) | Polish. | v2.x |
| Tagging / labeling requests | Polish. | v2.x |

### 3.4 Persistence / Format

| Feature | Why Defer | Trigger |
|---------|-----------|---------|
| OpenCollection YAML format export (Bruno-style plain text) | Trade-off: plain text = version-control friendly, JSON = richer. Lock in v1; v2 evaluates the switch. | v2.0 |
| Encrypted-at-rest collection storage | v1 can use OS keychain for secrets, plain JSON for collections. | v2.x |

### 3.5 Cross-Cutting Platform (Almost Certainly Never)

These are platform-tier features that would mean rebuilding Postman/Insomnia. Defer indefinitely; raise as out-of-scope markers.

| Feature | Why Defer |
|---------|-----------|
| Cloud sync / accounts | Not aligned with "single-user local tool" (PROJECT.md). |
| Team workspaces / sharing | Not aligned. |
| API monitoring / scheduled runs | Not aligned. |
| CI/CD integration / CLI | Not aligned. |
| AI features (test generation, request suggestions) | Not aligned; major scope. |
| Plugin / extension system | Major scope; defer until v3+ if ever. |
| API documentation generation from collections | Adjacent to platform. |
| API governance / linting | Adjacent to platform. |
| Custom themes | Trivial; flip in v1 if there's a free hour. |

---

## 4. Anti-Features (DO NOT Build in v1)

These are features that look attractive but **must be deliberately rejected** in v1 — either per PROJECT.md's explicit Out of Scope list, or because they would expand scope, dilute focus, or compete unfavorably with established tools.

### 4.1 From PROJECT.md "Out of Scope"

| Anti-Feature | Why Reject | Source |
|--------------|------------|--------|
| Non-Spring backends (Node, Go, Python, .NET) | Single ecosystem keeps v1 focused. Multi-stack is a separate effort. | PROJECT.md |
| Generating server-side code, scaffolding, migrations | App consumes Spring projects, does not modify them. | PROJECT.md |
| Cloud sync, team workspaces, sharing across users | Single-user local tool. | PROJECT.md |
| API monitoring, scheduled runs, webhooks | Out of v1 scope. | PROJECT.md |
| Mock servers generated from detected endpoints | v2. | PROJECT.md |
| GraphQL and gRPC support | REST/HTTP only in v1. | PROJECT.md |
| Auto-detecting endpoint↔table mapping | User picks; app does not infer. (Confirmed design boundary, not a missing feature.) | PROJECT.md |
| CI/CD integrations | Local developer tool only. | PROJECT.md |

### 4.2 Implicit Anti-Features (Industry Temptations to Reject)

| Anti-Feature | Why Reject | What To Do Instead |
|--------------|------------|--------------------|
| Full OAuth 2.0 flow (auth code, refresh tokens) | High implementation cost; Spring devs typically use JWT bearer or basic auth. | Defer to v2 if user demand emerges. |
| Plugin / extension system | Massive scope; traps the team in API design. | Ship as a closed app; revisit in v3+. |
| AI features (request gen, test gen) | Large LLM bill + scope + vendor lock-in. | Skip until v3+. |
| Full scripting engine (pre/post JS like Postman) | Competes with Spring's own Java; requires a sandboxed JS runtime. | Replaced by Chain + MAP (which are purpose-built for the Spring use case). |
| Implicit "smart" body generation (auto-pick schema source) | Magic creates fragile, surprising results. | Keep DTO-mode vs DB-mode as **explicit user choice**. |
| Auto-infer table from endpoint | Already rejected by user. | User picks. |
| Custom themes beyond dark/light | Vanity feature. | Ship dark + light in v1, defer custom. |
| Multi-window / multi-pane UI | Electron complexity not worth it. | Single window, tabs. |
| Cloud-hosted desktop (telemetry, auto-updates via server) | Privacy concern for "local tool" positioning. | Use standard OS auto-update mechanism (Squirrel / Tauri updater). |
| WebSocket / SSE / Server-Sent Events | REST/HTTP only per PROJECT.md. | Defer. |
| SOAP / WSDL | Legacy, ~1% of Spring traffic. | Defer. |
| Response diff across requests | Useful for debugging but not core. | Defer to v2. |
| API documentation generation from chains | Adjacent product; Postman's territory. | Defer. |
| Full test framework with assertions | Competes with JUnit. | v1 just reports pass/fail on chain runs. |
| Video tutorials / in-app onboarding | Marketing concern, not product. | Skip. |
| Custom HTTP/2 / HTTP/3 toggle | HTTP/2 is default in modern stacks; toggle is a footgun. | Use HTTP/2 by default for HTTPS; expose override in v2. |
| Saving requests as code (Java/Kotlin snippets) | Tempting for Spring devs but creates a competing code-gen product. | Defer. |
| Reusable DTO snippet library | Anti-feature vs. the point of DTO-mode (read from project). | Reject. |

### 4.3 The Cardinal Anti-Pattern for This Product

**Don't try to be a smaller Postman.** The market is saturated with smaller Postmans. PostmanClone's reason to exist is the Spring-differentiation surface. If a v1 feature doesn't either (a) make the table-stakes baseline usable, or (b) deepen the Spring-aware engine, it doesn't belong in v1.

---

## 5. Feature Dependency Map

Dependencies between features shape the build order. Arrows mean "depends on":

```
CORE-01 (HTTP methods) ─┐
CORE-05 (URL/params/headers) ─┤
                            ├─> CORE-02 (cURL view/import)
                            ├─> CORE-06 (response viewer)
                            ├─> CORE-07 (auth)
                            └─> CORE-08 (body modes)

CORE-03 (variables) ──> CORE-01, CORE-05, CORE-06, CORE-07, CORE-08
                       (interpolation in all of the above)

CORE-04 (collections) ──> CORE-01 (you save requests into collections)
CORE-09 (history)    ──> CORE-04 (history is per-collection)
CORE-10 (import/export) ──> CORE-04 (collections are the unit of import/export)

SPRING-01 (point at project) ──> SPRING-02 (scan controllers)
SPRING-02 ──> SPRING-03 (resolve DTOs from classpath)
SPRING-02 + SPRING-03 ──> SPRING-04 (sidebar)
SPRING-04 ──> SPRING-05 (prefilled request on click)

BODY-01 (schema) ──> BODY-02 (placeholders)
BODY-01 ──> BODY-03 (cycles)

DB-01 (connect) ──> DB-02 (list tables)
DB-02 ──> DB-03 (pick table)
DB-03 ──> DB-04 (fetch rows)
DB-04 + BODY-01 ──> DB-05 (map columns to fields)
DB-04 ──> DB-06 (row selection)
DB-01 ──> DB-07 (credential storage; needs to be there before connection)

CHAIN-01 (define) ──> CHAIN-02 (reference prior step)
CHAIN-01 + CHAIN-02 ──> CHAIN-03 (run)
CHAIN-01 + CHAIN-02 + CHAIN-03 ──> CHAIN-04 (re-run single step)
CHAIN-01 ──> CHAIN-05 (persist with collection)

MAP-01 (pull field) ──> MAP-02 (explicit mappings)
MAP-01 + MAP-02 ──> MAP-04 (preview)
MAP-01 + MAP-02 + CHAIN-03 ──> MAP-03 (run-time resolution; must work with chain run)

Differentiator engine: SPRING-03 + BODY-01 + DB-04 + CHAIN-02 + MAP-01
                       all must work together to deliver the
                       "Spring project → live API playground" vision.
```

**Build-order implication:**
- **Foundation first:** CORE-01..CORE-08 (HTTP, variables, body modes, auth) + per-request settings + cookie jar + tabs + theme.
- **Then:** CORE-04 (collections) + CORE-09 (history) + CORE-10 (import/export).
- **Then:** SPRING-01..SPRING-05 (scanning, sidebar, prefilled request).
- **Then:** BODY-01..BODY-03 (DTO body generation).
- **Then:** DB-01..DB-07 (DB body generation).
- **Then:** CHAIN-01..CHAIN-05 (chains).
- **Then:** MAP-01..MAP-04 (mapping), which closes the loop with the chain run.

---

## 6. Recommended v1 Feature Set (Summary)

| Category | v1 | v2 | Anti-feature |
|----------|----|----|--------------|
| HTTP methods (all 7) | ✅ | | |
| URL/params/headers/body | ✅ | | |
| cURL view + import | ✅ | | |
| Variables (4 scopes: global/env/coll/req) | ✅ | | |
| Collections + folders | ✅ | | |
| Response viewer (status/headers/time/body/JSON pretty-print) | ✅ | | |
| Auth (none/bearer/basic/api-key) | ✅ | | |
| Body modes (none/form/urlencoded/raw/binary) | ✅ | | |
| History (per collection) | ✅ | | |
| Postman v2.1 import/export | ✅ | | |
| Per-request settings (timeout/redirects/SSL) | ✅ | | |
| Cookie jar | ✅ | | |
| Proxy | ✅ | | |
| Tabs | ✅ | | |
| Keyboard shortcuts | ✅ | | |
| Dark / light theme | ✅ | | |
| **Spring project scan + endpoint detection** | ✅ | | |
| **DTO resolution from classpath** | ✅ | | |
| **Sidebar with detected endpoints** | ✅ | | |
| **Prefilled request on click** | ✅ | | |
| **DTO-schema body generation** | ✅ | | |
| **Cycle detection** | ✅ | | |
| **JDBC connect (Postgres/MySQL/Oracle/H2)** | ✅ | | |
| **List tables/columns** | ✅ | | |
| **Row → JSON with column↔field mapping** | ✅ | | |
| **Row selection strategies** | ✅ | | |
| **Local credential storage** | ✅ | | |
| **Chain definition + run + single-step re-run + persistence** | ✅ | | |
| **Response-to-body field mapping (explicit, run-time, preview)** | ✅ | | |
| | | | |
| Image/PDF preview in response | | ✅ | |
| OAuth 2.0 / OAuth 1.0 / mTLS / client certs | | ✅ | |
| Code generation (JS/Python/Java/etc.) | | ✅ | |
| OpenAPI import/export | | ✅ | |
| Mock servers from endpoints | | ✅ | |
| Spring Security/CSRF auto-detect | | ✅ | |
| Validation-annotation-aware placeholders | | ✅ | |
| Recompile watcher | | ✅ | |
| Response assertions | | ✅ | |
| Response diff | | ✅ | |
| Visualizer / response charts | | ✅ | |
| Pre/post request scripts | | ✅ | |
| API docs generation | | ✅ | |
| | | | |
| GraphQL | | | ❌ (REST only per PROJECT.md) |
| gRPC | | | ❌ (REST only per PROJECT.md) |
| WebSocket / SSE | | | ❌ (REST only per PROJECT.md) |
| SOAP / WSDL | | | ❌ (REST only per PROJECT.md) |
| Cloud sync / accounts | | | ❌ (Local tool per PROJECT.md) |
| Team workspaces / sharing | | | ❌ (Single-user per PROJECT.md) |
| API monitoring / scheduled runs | | | ❌ (Out of v1 per PROJECT.md) |
| CI/CD integrations | | | ❌ (Local tool per PROJECT.md) |
| Server-side code generation | | | ❌ (Read-only per PROJECT.md) |
| Auto endpoint↔table inference | | | ❌ (User-picks per PROJECT.md) |
| Non-Spring backends | | | ❌ (Spring-only per PROJECT.md) |
| Plugin / extension system | | | ❌ (Defer indefinitely) |
| AI features | | | ❌ (Defer indefinitely) |
| Implicit / "smart" body source picking | | | ❌ (Explicit user choice) |
| Full scripting engine | | | ❌ (Replaced by Chain + MAP) |

---

## 7. MVP Recommendation

If a "minimum lovable product" is desired (a v0.5 cut of v1):

**Must-have for MLP:**
1. CORE-01..CORE-08 (HTTP, variables, body modes, auth, response viewer) — without these, the user can't actually send a request.
2. CORE-04 (collections) — without this, the differentiator sidebar has no home.
3. SPRING-01..SPRING-05 (scan + sidebar + prefilled request) — **the headline feature**.
4. BODY-01 (DTO-schema body) — second headline feature, makes prefilled request useful.

**Nice-to-have for v1, can ship in v1.1 if needed:**
- CORE-09 (history)
- CORE-10 (Postman import)
- BODY-02, BODY-03
- Per-request settings (timeout, redirects)
- Cookie jar, proxy, tabs, dark/light theme

**Defer to v1.1 / v2 even within v1:**
- DB-01..DB-07
- CHAIN-01..CHAIN-05
- MAP-01..MAP-04

**Rationale:** the MLP = "scan project → see endpoints → click → send a request with a DTO-shaped body." Everything else deepens this core loop.

---

## 8. Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Table-stakes baseline | **HIGH** | Industry consensus across Postman, Insomnia, Bruno, JetBrains. Confirmed against official docs. |
| Differentiation surface (SPRING/BODY/DB/CHAIN/MAP) | **HIGH** | Maps directly to PROJECT.md Active requirements; no competitor overlaps. |
| Spring annotation coverage | **HIGH** | Verified against official Spring Framework 7.0.7 reference (`@RequestMapping`, `@*Mapping`, `@RestController`, `@PathVariable`, `@RequestParam`, `@RequestBody` all confirmed in current docs). |
| Recommended v1 / v2 / anti split | **MEDIUM** | Anti-features are firm (PROJECT.md-driven). v2 candidates are best-judgment — could be reshuffled based on user feedback. |
| MLP cut | **MEDIUM** | A reasonable guess. Real product judgment comes from shipping MLP and watching what users do. |
| Per-request settings / cookie jar as table stakes | **MEDIUM** | Present in all major clients, but not all explicitly called out in PROJECT.md Active. Flag for review. |
| Spring Boot 2.7 vs 3.x (javax vs jakarta) | **HIGH** | Well-documented gotcha; must be handled. |
| Classpath resolution approach (javaparser + ASM) | **MEDIUM** | Industry-known pattern; specific implementation risk exists. |

---

## 9. Gaps to Address

These need **phase-specific research** (i.e., when a phase that touches them is planned):

- **Lombok handling in DTO body generation** — `@Data`, `@Value`, `@Builder` change what's on the classpath. Likely requires bytecode-level inspection (ASM).
- **Java records** — generally well-supported by modern javaparser; needs verification against a Spring Boot 3.x test project.
- **Kotlin Spring controllers** — many Spring devs use Kotlin. The annotation processor would need to handle `.kt` files. **Recommend deferring Kotlin to v2.**
- **Spring WebFlux (reactive controllers)** — return type `Mono<T>` / `Flux<T>` wraps DTOs. Body generation needs to unwrap. Verify whether PROJECT.md's Spring scope includes WebFlux or only MVC.
- **Multi-module Gradle/Maven projects** — classpath assembly gets more complex. Likely fine but worth testing.
- **JDBC driver bundling** — should the app bundle Postgres/MySQL/Oracle/H2 drivers, or require user to point at them? UX decision.
- **Postman import round-trip with chains** — chains may need a custom Postman extension to round-trip cleanly. Postman v2.1 schema allows extension fields.
- **Java 8/11/17/21 coverage** — different bytecode versions may need different ASM versions.

---

## Sources

- Postman: https://www.postman.com/api-platform/api-client/ (industry standard reference)
- Postman Learn (training docs, partially fetched)
- Bruno Docs: https://docs.usebruno.com/llms.txt (extensive index, multiple sub-pages fetched)
- Insomnia (Kong): https://insomnia.rest/product (feature list)
- JetBrains HTTP Client (IntelliJ IDEA 2026.1 docs, comprehensive fetch)
- Spring Framework 7.0.7 Reference: https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-requestmapping.html (annotation reference)
- PROJECT.md (own project context)
