# Domain Pitfalls: PostmanClone

**Project:** PostmanClone — a Postman-like desktop API client for Java Spring developers
**Dimension:** Pitfalls (failure modes, technical traps, UX mistakes)
**Researched:** 2026-06-03
**Overall confidence:** HIGH for stack/parser/security domains; MEDIUM for UX workflows (deeper validation needed during early phases)

---

## How to Read This File

Each pitfall includes:
- **What goes wrong** — the failure scenario
- **Why it happens** — root cause
- **Warning signs** — how to detect early
- **Prevention** — actionable strategy
- **Phase** — which roadmap phase should plan or implement the fix (mapping uses placeholders: `Phase 1 (Scan)`, `Phase 2 (Body Gen)`, `Phase 3 (Chains)`, `Phase 4 (Persistence)`, `Cross-cutting`)

Pitfalls are grouped by severity: **CRITICAL** (rewrites the architecture), **MODERATE** (recoverable but costly), **MINOR** (UX/sanity issues).

---

# CRITICAL PITFALLS — These Will Bite You

## C-1: Recursive DTOs Without Cycle Detection Cause Stack Overflow and Browser Hang

**What goes wrong:** A Spring `User` has a `List<Order>`. Each `Order` has a `User owner`. Naively walking fields produces `User → Order → User → Order…` forever. The body generator emits JSON that, when sent, either (a) explodes the app's serializer with a stack overflow, (b) sends a 50MB payload the server rejects with 413, or (c) hangs the renderer because the JSON tree view contains a million nodes.

**Why it happens:** Object graphs in DTOs routinely contain back-references (`@OneToMany`/`@ManyToOne` pairs, parent/child, audit `createdBy`/`createdEntities`). The naive approach "recurse into every field of declared type" has no termination condition.

**Warning signs:**
- "Generate Body" on a Spring project with bidirectional relationships freezes the UI.
- Generated JSON body is > 1MB and contains repeated `{"id":1,"user":{...}}` structures.
- Backend returns `400`/`413` consistently on generated POSTs.

**Prevention:**
- **Cycle detection in Phase 2 (Body Gen):** Track a `Set<FQN>` of types currently being expanded. When a cycle is detected, emit a `{"$ref": "TypeName"}` marker (OpenAPI 3.0 semantics) OR a clearly-labeled placeholder object with the conflicting field name + a banner telling the user "cyclic reference — fill by hand or map from another row."
- Cap recursion depth at e.g. 6 levels with a visible warning ("truncated at depth 6 — schema continues").
- Treat Jackson `@JsonManagedReference` / `@JsonBackReference` annotations as cycle markers; don't break them.
- For Lombok-generated fields, infer parents from getter return types of the *same* DTO name.

**Phase:** Phase 2 (Body Gen — DTO schema mode). Make cycle detection the first thing built, not the last.

---

## C-2: JavaParser Symbol Resolution Falls Over on Real Spring Projects

**What goes wrong:** JavaParser successfully *parses* almost any Java source, but **type resolution** — the thing that turns `List<MyDto>` into "the field is a list of `com.example.MyDto`" — fails for a huge class of real-world code. When resolution fails silently (returns `null` or throws), the app silently generates *empty* bodies, missing fields, or crashes mid-scan with no usable error.

**Why it happens (confirmed via JavaParser docs):**
- **No symbol solver configured = no resolution.** Without `JavaSymbolSolver` attached, every `type.resolve()` call returns `null` (Source: JavaParser wiki — "The Symbol Solver requires one or more TypeSolver instances to locate type definitions").
- **Generic resolution is incomplete.** The symbol solver has "evolved to cover many cases but does not strictly adhere to the JLS… an in-progress implementation aims to resolve method calls involving generics" (Source: JavaParser wiki — *About the Symbol-Solver*). `List<Foo<T>>` and lambdas can cause "circular dependencies" (Source: same).
- **Inner class scope confusion** is a known test case. JavaParser's own test suite includes `class Parent { private class ResolveMe {} }` with a `class Child extends Parent` that creates `ResolveMe` — the resolver has to disambiguate shadowed inner classes correctly and historically hasn't (Source: JavaParser symbol-solver-testing/ComplexTypeResolving.java).
- **Cross-module resolution** requires every dependency on the classpath. Spring Boot starters pull 100+ JARs; without `JarTypeSolver` added for every `~/.m2/repository/.../jars`, types outside the project are invisible.
- **Multi-module Maven/Gradle projects** parse sources from multiple roots. `JavaParserTypeSolver` is one root per instance; combining them needs `CombinedTypeSolver` and they must be ordered.

**Warning signs:**
- Scan completes but endpoint list is short ("only 12 endpoints found" in a project you know has 200).
- Generated bodies for `List<UserDto>` resolve to a list of empty `{}` objects.
- Logs fill with `java.lang.UnsolvedSymbolException` and `java.lang.NullPointerException` from the parser.
- App fails to find a class that the user can plainly see in the same package.

**Prevention:**
- **Phase 1 (Scan) planning must include a "resolution test suite":** build a fixed corpus of 10+ real Spring projects (with generics, sealed types, records, inner classes, Lombok, MapStruct, multi-module) and assert known endpoint counts. Anything below 100% coverage is a blocker.
- Configure the parser with `ParserConfiguration.LanguageLevel.JAVA_21` (or `POPULAR` = Java 11) explicitly. Without this, parse errors are silent for newer syntax (records need `LanguageLevel.JAVA_16+` — records support since JavaParser 3.22.0; sealed types also need explicit level).
- Use `ParseResult` everywhere, never `parse(file)` which throws on syntax errors and halts the scan. Always check `result.isSuccessful()` and accumulate `result.getProblems()` for reporting.
- Build a **type-fallback chain**: if `type.resolve()` returns null, attempt (a) a string match against known class names, (b) `Class.forName()` against the user's classpath, (c) skip with a clear "unresolved type — body will use a generic placeholder" warning visible in the UI.
- For unresolved generics, default to `Object` shape, not crash. The body is a *placeholder* anyway.
- **Limit scope of symbol solving.** It is O(n²) at worst; an H2-backed cache of resolved types is essential for projects with thousands of files.

**Phase:** Phase 1 (Scan). Symbol solver configuration and the resolution test suite must be day-one work, not polished later.

---

## C-3: Lombok Hides Fields From Source Parsers — Generated Getters/Setters Are Invisible

**What goes wrong:** A DTO is `@Data class UserDto { private String name; private List<Address> addresses; }`. JavaParser sees the *field* `name` but does NOT see `getName()` / `setName()` — they don't exist in the source. If the body generator walks methods (or uses the resolved return type of `getName()`), it returns nothing. If it walks fields, it misses Lombok's `lombok.AccessLevel.NONE` / `@ToString.Exclude` / `@EqualsAndHashCode.Exclude` nuances.

Conversely, if a class has `@Getter` on the *class* and the parser walks getters, it correctly sees `getName()` — but if the user wrote a custom getter with a different name (`displayName()` instead of `getName()`), the parser finds a *different* field name than what the JSON should contain.

**Why it happens:**
- Lombok generates bytecode at compile time. The `.java` file has no getters/setters. (Source: Project Lombok — `@Data is a convenient shortcut annotation that bundles the features of @ToString, @EqualsAndHashCode, @Getter / @Setter and @RequiredArgsConstructor together`.)
- Lombok's `@Jacksonized` is *experimental* and only works when paired with `@Builder` or `@SuperBuilder` (Source: Baeldung — *Jackson's Deserialization With Lombok*, Lombok docs).
- `@JsonProperty` is the user escape hatch for renaming; without it, generated getters follow Java Bean naming (`getName()` → JSON `name`).

**Warning signs:**
- A field that's `@Getter @Setter` private is missing from the generated body.
- A field annotated `@ToString.Exclude` (e.g., a password hash) appears in the body, gets sent in a POST, and creates a security issue or validation error.
- The Lombok `@Accessors(fluent = true)` flag silently changes the getter name from `getName()` to `name()`, breaking any parser that names JSON fields after `getX()`.

**Prevention:**
- **Phase 2 (Body Gen) must support two field-discovery strategies, configurable per scan:**
  1. **Fields-first:** walk the AST `FieldDeclaration`s, respect `@ToString.Exclude` / `@EqualsAndHashCode.Exclude` (treat as excluded from body).
  2. **Methods-first:** walk `MethodDeclaration`s that match the `getX`/`isX` pattern, with awareness of `@JsonProperty` on the getter to override the JSON field name.
  3. **Hybrid (recommended):** prefer getters (they reflect the wire format), fall back to fields for what getters don't cover, and de-duplicate.
- For `@JsonProperty("first_name")` on a getter, emit `first_name` in the JSON, not `firstName`.
- For Lombok `@Builder.Default`, use the initializer as the placeholder.
- For Lombok `@NonNull` fields, use a non-null placeholder; for unmarked fields, allow `null` or use a "default for type" placeholder.
- Detect `@Accessors(fluent = true)` and adjust getter matching.
- For a fully bulletproof approach, optionally run `delombok` on the project to a temp directory and parse the *expanded* sources. Cost: requires `lombok.jar` on the desktop app's classpath, or a separate `delombok` CLI invocation. Worth it as a v2 escape hatch.

**Phase:** Phase 1 (Scan) detection of Lombok usage, Phase 2 (Body Gen) field discovery.

---

## C-4: PostgreSQL `json` / `jsonb` Columns Come Back as `PGobject` Strings — Not Parsed JSON

**What goes wrong:** The DTO has `private Map<String, Object> metadata`. The DB has a `metadata` column of type `jsonb`. The JDBC driver returns a `org.postgresql.util.PGobject` (not a Map). When the body generator does `resultSet.getObject("metadata")` and tries to stuff it into the JSON body, the user sees a weirdly-escaped string like `"{\"key\": \"value\"}"` inside their JSON. Or worse: the body generator throws because the type is unrecognized.

The same shape problem exists for `hstore`, `uuid`, custom enum types, and array columns (`text[]`).

**Why it happens:** JDBC drivers are free to return column values as their native Java type. The PostgreSQL driver returns `jsonb` as a `PGobject` whose string value is the raw JSON; H2 returns JSON columns as `java.lang.String` (the raw text); Oracle returns `JSON` as `java.sql.SQLXML` in some versions and `String` in others.

**Warning signs:**
- Generated body has nested escaped strings: `"metadata": "{\"key\":\"val\"}"` instead of `"metadata": {"key":"val"}`.
- Type errors when the user tries to copy the body and re-import it.
- "First row" picked by the app shows a value that looks like `PGobject@1a2b3c`.

**Prevention:**
- **Phase 2 (DB Body Gen) needs a per-driver type normalizer:**
  - PostgreSQL: detect `PGobject` whose `getType()` is `json` or `jsonb` and call `getValue()`, then re-parse to `JsonNode` and merge.
  - H2: JSON columns are plain `String`; parse the string and merge into the body.
  - MySQL: `JSON` columns come back as `String`; same as H2.
  - Oracle: handle `SQLXML` or `String` per version.
- For unknown types, fall back to a `{"_raw": "...stringified value..."}` envelope so the user sees the data is there, just not in the right shape — better than crashing.
- For collections of enum values, arrays (`text[]`, `int[]`), use Jackson's ability to parse a JSON string into `JsonNode` and re-emit in the right place in the body.
- For `null` values, never call `.toString()` on the JDBC-returned object — call `resultSet.getObject(col)` and check for `null` first; some drivers return `null` for SQL NULL, others return a typed null wrapper.

**Phase:** Phase 2 (DB Body Gen).

---

## C-5: Reading Huge Result Sets in the DB Browser Freezes the Desktop App

**What goes wrong:** The user picks "first row" from a table. The app does `SELECT * FROM events` — and that table has 80 million rows. The driver buffers the entire result set in memory. The renderer tries to display all of them. The app freezes for 30+ seconds, or crashes with `OutOfMemoryError`. Even with a LIMIT clause, a wide row (say, a `payload` JSON column with 5MB of data per row × 10,000 rows) is 50GB if naively loaded.

**Why it happens:**
- Naive `Statement.executeQuery("SELECT * FROM table")` loads everything.
- Most JDBC drivers buffer rows by default. PostgreSQL needs `Statement.setFetchSize(N)` to stream; even then, you must keep the connection open and consume.
- "First N" semantics in the app must be done at the SQL level (`ORDER BY id LIMIT N`), not by loading and slicing in memory.

**Warning signs:**
- App freeze when picking a table from a "large" schema.
- Memory usage climbs during a table scan and never drops.
- The user has to force-quit.

**Prevention:**
- **Phase 2 (DB Body Gen) must enforce:**
  - `LIMIT` / `OFFSET` clauses for any "preview" view, with a default cap (e.g., 100 rows) and an obvious "load more" path.
  - Per-row column size cap: any single column > 100KB gets replaced with a "truncated" marker in the preview, with the full value accessible only on explicit request.
  - `Statement.setFetchSize(50)` (PostgreSQL) or use cursor mode for any "stream" view.
  - Wrap the query in `try-with-resources` to release the `ResultSet` and `Statement` deterministically.
- Use **HikariCP** with `maximumPoolSize=2-3` and `connectionTimeout=10s` for desktop usage (Source: HikariCP defaults — pool of 10 is way too large for a single user).
- Provide a "row count" preview query (`SELECT COUNT(*)` is acceptable; `SELECT reltuples FROM pg_class` is faster for PostgreSQL) so the user knows the table size before loading.
- For tables that look dangerous (no primary key, JSON columns > 1MB), show a warning *before* executing.

**Phase:** Phase 2 (DB Body Gen). Apply on day one — this is "first-run" UX.

---

## C-6: Desktop App Database Credentials End Up in a Plaintext Config File

**What goes wrong:** "Remember my DB password" checkbox stores the password in `~/.postmanclone/credentials.json` as `{ "url": "jdbc:postgresql://prod-db:5432/users", "user": "app", "password": "hunter2" }`. A backup tool, a screen-share, a git commit (the user has `~/.postmanclone` in their dotfiles repo), or a malicious sibling app reads it. This is exactly the threat model the PROJECT.md calls out: "DB credentials stored locally only. No network egress of credentials or query results."

**Why it happens:** Storing secrets is hard. The default is "write to disk and forget about it." Postman and Insomnia both have to solve this; many tools do it badly.

**Warning signs:**
- A grep for the password string in `~/.postmanclone/` returns a hit.
- The credentials file is readable by all users on the system (Linux/macOS).
- The app crashes on a fresh system with "no credentials found" — meaning the storage was tied to the system in a way that broke portability.

**Prevention:**
- **Use the OS-native secret store:**
  - macOS: **Keychain** via `security` CLI or `keyring-rs` (`/websites/rs_keyring_keyring` library).
  - Windows: **Credential Manager** via `keyring-rs` or `wincred`.
  - Linux: **Secret Service** (libsecret) via `keyring-rs`, with a "fallback to encrypted file with a user-provided passphrase" when libsecret is unavailable.
- For Tauri, the **`tauri-plugin-stronghold`** plugin (formerly the Stronghold secrets store) is the Rust-native path; **Electron** users can use **`keytar`** (now archived but widely deployed) or its modern fork **`@napi-rs/keyring`**.
- Never store passwords in the app's data directory unencrypted. The "remember password" UX should imply "store in OS keychain" — surface that distinction in the UI.
- For the in-app "Connection profiles" list, show the URL and username but mask the password (••••••) with a "reveal" button that requires re-auth (touch ID, system password) on macOS, or just a click on Windows.
- DB query results in memory are fine; never write them to a log file. The PROJECT.md explicitly forbids network egress of query results — local file persistence is *not* network egress but is a different exposure surface.
- If keychain access fails (e.g., headless Linux server), warn loudly and offer the encrypted-file fallback with a one-time passphrase prompt.

**Phase:** Phase 2 (DB Connection) — do not ship the DB feature without this.

---

## C-7: CORS / Preflight Fails When Calling the Spring App From the Desktop Webview

**What goes wrong:** The desktop app's renderer (Chromium webview in Tauri/Electron) makes a `POST` with `Content-Type: application/json`. The browser sends an `OPTIONS` preflight first. If the Spring app's CORS config does not include the desktop app's origin (which is typically `http://localhost:port` for Tauri/Electron, or a `tauri://`/`file://` origin), the preflight returns 403 and the request never goes through. The user sees "Network Error" with no detail.

**Why it happens:** Many Spring apps are configured for CORS only for the front-end origins (e.g., `localhost:3000`). The desktop app's origin is different. Even when the desktop app uses a `tauri://` custom scheme, the browser may treat it as a CORS boundary.

**Warning signs:**
- Direct cURL works; the desktop app fails.
- Browser DevTools shows a preflight `OPTIONS` returning 403.
- The error is "CORS policy: No 'Access-Control-Allow-Origin' header is present" — but only when sent from the app.

**Prevention:**
- **Cross-cutting — make the desktop app use a Tauri/Electron-main-process HTTP client, not a renderer fetch.** In Tauri, use the `tauri-plugin-http` with a custom `ClientConfig` and set the `Origin` header explicitly (e.g., `Origin: http://localhost:port-of-the-spring-app`). The Rust side isn't subject to browser CORS in the same way.
- In Electron, use the main-process `net` module (Electron 22+) or `node-fetch` with a custom `Origin` — these are Node HTTP, not browser fetch, and aren't blocked by browser CORS.
- For the user: document a "CORS exception" troubleshooting entry. Many users will hit this on their first run.
- Provide a quick "Diagnose Connection" button that does a `curl` from the desktop app's host process to the target URL and shows headers — that isolates the issue from the app.

**Phase:** Phase 1 (HTTP request engine) — choose main-process HTTP from the start.

---

## C-8: Reading a Spring Project's `.git`, `target/`, `node_modules/` Multiplies Scan Time by 10x–50x

**What goes wrong:** The user points the app at a Spring project root. The file walker descends into `target/classes/`, `target/generated-sources/`, `.git/objects/`, `node_modules/`, `build/`, `.idea/`, `.gradle/`, `.mvn/`, and every JAR inside `~/.m2/repository/`. JavaParser tries to parse `.class` files, chokes, reports thousands of "parse errors" per file, and the scan takes 60+ seconds instead of 5.

**Why it happens:** Default file walking doesn't know what to skip. Every file is treated as a candidate.

**Warning signs:**
- Initial scan is slow (>15s for a small project).
- The "Endpoints found" counter is dwarfed by the "Files scanned" counter (10000 files scanned, 47 endpoints found).
- Logs show `Parse error in target/classes/META-INF/...` repeatedly.

**Prevention:**
- **Phase 1 (Scan) — implement a denylist before walking:**
  - Always skip: `.git/`, `node_modules/`, `.idea/`, `.gradle/`, `.mvn/`, `build/`, `out/`, `dist/`, `target/classes/`, `target/test-classes/`, `target/generated-sources/`, `target/generated-test-sources/`.
  - For Maven: only walk `src/main/java/`, `src/main/kotlin/`, and (for completeness) `src/main/resources/` (XML config).
  - For Gradle: only walk `src/main/java/`, `src/main/kotlin/`.
  - Honor `.gitignore` from the project root — projects with custom layouts (e.g., `app/src/`) deserve respect.
- Add a cap: ignore files > 1MB (probably generated, definitely not hand-written controllers).
- Add a `.postmancloneignore` opt-in file for projects with weird layouts.
- Show a progress bar ("Scanning… 1423 of 5000 files") with a cancel button — scans should feel responsive, not frozen.

**Phase:** Phase 1 (Scan). Profile on a real Spring project (e.g., `spring-petclinic`, `spring-boot-realworld-example-app`) on day one.

---

## C-9: Jakarta EE 9+ (`jakarta.*`) vs Java EE 8 (`javax.*`) Silently Fails Annotation Matching

**What goes wrong:** Spring Boot 3.x migrated from `javax.servlet.*` to `jakarta.servlet.*`. The fully-qualified name of `@RestController` is still `org.springframework.web.bind.annotation.RestController`, but other annotations the app may want to detect — like `@RequestMapping` — are also still Spring's, so the FQN is unchanged. **However**, many Java EE annotations (`@Resource`, `@PostConstruct`, `@PreDestroy`, `@Generated`, etc.) moved. If the app hardcodes `javax.annotation.Generated` to detect Lombok-generated code, it will not match Lombok's actual annotation (which is `lombok.Generated` in recent versions, but historically `javax.annotation.Generated` — Lombok switched to `lombok.Generated` in 1.18.20 to align with the Jakarta migration).

**Why it happens:** The Jakarta EE namespace migration in Spring Boot 3 (Java 17 baseline) is real. Project Lombok had to change annotations because the `javax.annotation` package is no longer in the JDK by default in Java 11+ (it was removed in Java 11, was a separate dependency in 9-10). If the app uses string-based annotation matching (`@RequestMapping.class.getName()`), it's safe. If it does regex on import statements, it's brittle.

**Warning signs:**
- Spring Boot 2.7 project: app works fine.
- Spring Boot 3.x project: same app fails to detect controllers / endpoints.
- Mixed project (multi-module with both Boot 2 and Boot 3): bizarre partial detection.

**Prevention:**
- **Phase 1 (Scan) — match annotations by FQN string, not by class reference.** Use `annotation.getNameAsString().equals("org.springframework.web.bind.annotation.RestController")` not `annotation.equals(RestController.class)` — the latter requires Spring on the parsing classpath, which the desktop app should not need.
- Maintain a table of known FQNs:
  - `org.springframework.web.bind.annotation.RestController`
  - `org.springframework.web.bind.annotation.Controller`
  - `org.springframework.web.bind.annotation.RequestMapping` + its composed children (`GetMapping`, `PostMapping`, etc.)
  - `org.springframework.web.bind.annotation.RequestBody`
  - `org.springframework.web.bind.annotation.PathVariable`
  - `org.springframework.web.bind.annotation.RequestParam`
- For Lombok detection: check for `lombok.Data`, `lombok.Getter`, `lombok.Value`, `lombok.Builder`, `lombok.extern.jackson.Jacksonized` (and the older `javax.annotation.Generated` as a deprecated alias for old Lombok versions).
- Never require the user's project on the parser's classpath. The parser reads source/bytecode standalone.

**Phase:** Phase 1 (Scan). Decide the detection strategy up front; do not retrofit.

---

# MODERATE PITFALLS — Recoverable, But Costly

## M-1: Snake_case Columns vs camelCase Fields Without a Mapping Layer = Permanent Drift

**What goes wrong:** The Spring DTO has `private String firstName`. The DB column is `first_name`. The user picks "Use column `first_name`" and the body generator copies the value verbatim — but the Spring app's Jackson configuration serializes `firstName` as `firstName` in JSON (or `first_name` if `@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy)` is configured). The generated body has `firstName` or `first_name`; the actual wire format is whatever Jackson is configured to do. The user has to know the project's Jackson configuration to predict the field name in JSON.

**Why it happens:** DTOs and DB columns have different naming conventions. Jackson has 6+ naming strategies. The user must connect the dots.

**Warning signs:**
- 400 errors on POST with "unknown field" or "missing field."
- "Why is my body wrong?" — the user can't tell if the issue is mapping, naming, or type.

**Prevention:**
- **Phase 2 (DB Body Gen) needs a *naming-aware* mapper:**
  - On first scan of a Spring project, detect `@JsonNaming` annotations on the DTOs (or on a `@Configuration` class with a `Jackson2ObjectMapperBuilderCustomizer`). The user sees: "Detected: PropertyNamingStrategies.SnakeCaseStrategy — field names will be transformed."
  - The column-to-field mapping UI shows both: "DB column `first_name` → JSON field `first_name`" or "DB column `first_name` → JSON field `firstName`" depending on the detected strategy.
  - Provide a "transform: snake_case ↔ camelCase ↔ kebab-case" toggle that the user can apply per-mapping.
  - Never *silently* transform — show the user what the result will look like.
- Default to a heuristic: if the Spring project uses Spring Boot defaults (no `@JsonNaming` anywhere), assume camelCase JSON. If snake_case columns are detected and no `@JsonNaming` is found, *ask the user* — don't guess.

**Phase:** Phase 2 (DB Body Gen).

---

## M-2: Chain Run That References a Missing Variable Fails Silently or With Cryptic Errors

**What goes wrong:** The user defines a chain: Step 1 calls `POST /login` and sets `authToken` from the response. Step 2 references `{{authToken}}` in the `Authorization` header. The user re-runs the chain. Step 1's response is *different* this time (token is now in `access_token` not `authToken`). Step 2 sends an empty Authorization header. The endpoint returns 401, the user sees a 401 error and has no idea why their chain "broke."

**Why it happens:** Chain step response mappings are paths into the response body. If the path doesn't exist (because the response shape changed, or because the user picked the wrong field), the resolution returns `null` and gets substituted as the empty string or `"null"`. The HTTP request goes out malformed; the failure surfaces as the *target endpoint's* error, not the chain's.

**Warning signs:**
- Chains that worked yesterday don't work today after a Spring code change.
- "Step 2 failed with 401" — but Step 1 succeeded.
- Variable substitution log says `{{authToken}} → null` but the user didn't notice.

**Prevention:**
- **Phase 3 (Chains) — strict, visible resolution:**
  - Before sending, log every variable substitution: `Resolved {{authToken}} from step 1 → "eyJ..."` or `WARN: {{authToken}} is null (no path or empty value)`.
  - If a referenced variable is `null` and the request is being sent anyway, surface a "Missing variable: authToken (resolved from step 1.response.body.token)" warning in the chain run output.
  - Provide a "Dry run" / "Preview" button on each step that shows the *fully resolved* request (URL, headers, body) without sending — the user can verify substitutions before running.
  - Persist the *response shape* of each step with the chain run history, so the user can compare what worked vs. what changed.
  - For each step, the user can mark variables as "required" — if not resolved, the step is blocked from running.

**Phase:** Phase 3 (Chains). Bake into the resolver, not bolted on.

---

## M-3: Request Logs Leak Bearer Tokens, Basic Auth, and Cookies

**What goes wrong:** Request history is the killer feature of API clients. But the user enables "log all responses" for a chain run, and the chain calls `/api/login` which returns a JWT, then `/api/me` with `Authorization: Bearer <jwt>`. The history panel now shows the raw request headers including the JWT. The user shares their screen. The token is in the screenshot. Worse: chain history is persisted to a SQLite/SQLite-like store on disk, unencrypted.

**Why it happens:** "Log everything" is the default in most API tools. Users forget to mask secrets in headers, or the tool never warns about it.

**Warning signs:**
- A grep for the literal string `Bearer ` in the app's data directory returns hits.
- History is shareable as a Postman collection export and contains plaintext credentials.
- A new endpoint with `Authorization: Bearer` is added and shows up in history with the actual token.

**Prevention:**
- **Cross-cutting — secret-aware logging from day one:**
  - Maintain a "secret headers" list per request: anything matching `Authorization`, `Cookie`, `X-API-Key`, `Proxy-Authorization`, or user-flagged.
  - In the history view, mask the value: `Authorization: Bearer ••••••••3a2f`. Reveal requires a click.
  - For response bodies, if the body looks like `{ "access_token": "..." }` or `{ "token": "..." }`, mask those fields in the history view.
  - For chain export, do NOT include the actual header values; export only the *names* of secret headers and a warning "auth values not exported — re-enter in target environment."
  - Encrypt the local history store. SQLite + SQLCipher, or a JSON file with a key derived from the OS keychain.
  - Provide a "Redact secrets before sharing" toggle that the user clicks before any export.

**Phase:** Cross-cutting. Apply to the very first history-saved feature in Phase 4 (Persistence).

---

## M-4: Re-parsing the Whole Project on Every File Change Wastes Minutes and Battery

**What goes wrong:** The user edits a controller, the file watcher fires, the app kicks off a full project re-scan, including the unaffected 499 other files. Re-scans on every keystroke are a battery and CPU disaster. A 1000-file project takes 8s to scan; if the editor saves 10 times in a minute, that's 80s of CPU and a hot laptop fan.

**Why it happens:** Naive file watcher = full re-scan. No incremental analysis.

**Warning signs:**
- CPU fan spins up whenever the user edits a Spring file.
- Scan progress bar restarts on every save.
- "Endpoints list" flickers / re-renders on every save.

**Prevention:**
- **Phase 1 (Scan) — incremental parsing:**
  - File watcher (chokidar in Node, `notify` crate in Rust) with debouncing (300ms idle = scan the changed file).
  - On file change, re-parse *only* that file. Diff its declared classes and methods against the in-memory model. Update the endpoint list in place — don't re-render from scratch.
  - On file *deletion*, drop the file's contributions; on file *rename* (often appearing as delete+create), treat as new.
  - On dependency change (`pom.xml` / `build.gradle` changed), do trigger a full re-scan — that's legitimate.
  - Throttle the full re-scan to at most 1 per 5 seconds under continuous save pressure.
  - Run scans in a worker thread / web worker, never on the UI thread.

**Phase:** Phase 1 (Scan). Profile before shipping.

---

## M-5: Timeout Handling in Chain Steps Is Inconsistent — Some Fail, Some Hang, Some Succeed With Partial Data

**What goes wrong:** A chain has 5 steps. Step 3 hits a slow endpoint that takes 2 minutes. Default timeout is 30s. Step 3 fails with a timeout. The chain runner's behavior:
- **Option A (default):** abort the chain, mark Steps 4-5 as "skipped."
- **Option B:** continue with Steps 4-5 using a stale variable from Step 2.
- **Option C:** retry Step 3 with exponential backoff.
- **Option D:** all of the above, depending on which version of the runner code the user has.

The user is left wondering which behavior they'll get. Worse: in async / WebSocket / SSE / chunked responses, a "timeout" can fire mid-response, the user sees a partial body, and saves the partial body as "the response."

**Why it happens:** Timeouts, retries, and partial-failure semantics are easy to get wrong. Postman has documented quirks here; chains that use server-sent events or websockets have especially weird behavior.

**Warning signs:**
- Chains abort on the first timeout with no retry.
- Steps marked "skipped" never run even after a fix.
- A response body has `}` count not matching `{` because it was truncated mid-stream.

**Prevention:**
- **Phase 3 (Chains) — explicit, configurable, per-step:**
  - Per-step timeout (default 30s, max 10min). UI shows the timeout.
  - Per-step retry policy: `none` / `on-timeout` / `on-5xx` / `on-any-error` with max attempts and backoff.
  - Chain-level policy: `abort-on-first-failure` (default) / `continue-and-mark-failed` / `continue-only-on-certain-errors`.
  - Clearly mark "skipped" steps in the run output; never re-use stale variables from a failed step without an explicit "use last known value" toggle.
  - For streaming / chunked responses, set `Content-Length`-aware timeouts OR a separate "idle timeout" (no data for N seconds = fail). Don't time out a slow-but-progressing download.
  - On timeout, the response body field shows "incomplete (N bytes received, timed out after 30s)" — never pretend the truncated body is the complete response.

**Phase:** Phase 3 (Chains). Make timeout/retry UI a first-class feature.

---

## M-6: User-Picked Endpoint↔Table Mapping Is Obvious-Broken Without Linting

**What goes wrong:** The user maps `POST /api/users` to the `user` table. The DTO is `UserDto { firstName, lastName, email, age }`. The `user` table has `first_name, last_name, email_address, dob, status`. The user manually maps 5 fields. The app silently allows the user to leave 4 DTO fields unmapped (which will be null on the server side and likely cause a 400) and 3 table columns unmapped (data is dropped). The user sends the request. 400 error. No hint why.

**Why it happens:** "User picks the mapping" is the right product decision (per PROJECT.md), but the UI has to make the consequences obvious. A naive dropdown doesn't.

**Warning signs:**
- Users frequently get 400s on first send.
- Users re-map the same fields repeatedly because they forgot which mapping is active.
- Users can't tell which fields will be sent and which will be null.

**Prevention:**
- **Phase 2 (DB Body Gen) — visible mapping state:**
  - The mapping panel is a two-column table: `DB column | → JSON field`. Every DTO field is a row. Every row is colored:
    - Green: mapped, types compatible.
    - Yellow: mapped, but types differ (e.g., DB `text` → DTO `LocalDate`).
    - Red: DTO field is required (no `@Nullable`, no `Optional`) but no DB column is mapped to it.
    - Gray: DTO field is `Optional` and no column mapped; OK, will be `null` in the body.
  - A "Coverage" badge at the top: "5 of 8 fields mapped (63%); 2 fields will be null."
  - Allow a "test row" — pick a row from the table and show the *actual generated body* in a preview pane, with null fields highlighted. The user sees "if I send this, the server will receive these nulls."
  - The mapping is *saved* with the endpoint in the collection — no re-mapping every time.
  - For "first row" mode, let the user pick by primary key, by `LIMIT N OFFSET M`, or by a custom `WHERE` clause (with a "danger: this query runs on the user's DB" warning for non-SELECT).

**Phase:** Phase 2 (DB Body Gen). The mapping UI *is* the feature; don't ship a stub.

---

## M-7: JPA / Hibernate Proxies and Lazy Collections Trip the Body Generator Up

**What goes wrong:** The user has a Spring Boot app with `spring-boot-starter-data-jpa`. The DTO is hand-rolled but the *entity* (`@Entity class User { @OneToMany(fetch=LAZY) List<Order> orders; }`) is what JDBC actually returns when querying. The body generator, if it naively iterates `resultSet` and serializes via Jackson, will trigger lazy loading on every `orders` field, hit `LazyInitializationException: no Session` (a well-documented Hibernate pitfall — Source: Baeldung, Thorben Janssen, multiple Stack Overflow threads on this exact issue), and the body generation fails.

**Why it happens:** JPA entities have lazy associations. Outside an open Hibernate `Session`, accessing them throws. JDBC-based body generation is not in a Hibernate session, so any lazy field explodes.

**Warning signs:**
- Body generation works for hand-rolled DTOs but fails for JPA entities.
- Error log: `org.hibernate.LazyInitializationException: could not initialize proxy - no Session`.
- Body preview shows `null` for lazy fields but doesn't explain why.

**Prevention:**
- **Phase 2 (DB Body Gen) — design around it:**
  - The body generator queries the *table* directly via JDBC, not via the user's Hibernate session. So the result is a `ResultSet`, not an entity. The Hibernate proxy problem is bypassed by construction.
  - For the user: detect that the *target DTO* has JPA annotations (`@Entity`, `@OneToMany`, etc.) and warn: "This DTO is a JPA entity. The body generator cannot safely use lazy fields. Use the corresponding DTO class for request body, not the entity."
  - If the DTO is a JPA entity and the user insists, only emit scalar fields and `@Column` simple mappings; skip associations entirely.
  - For records, which are *not* JPA entities, this is a non-issue.
  - The body generator should never invoke the user's JPA `EntityManager`. Always raw JDBC. This is a hard architectural boundary.

**Phase:** Phase 2 (DB Body Gen) — set the JDBC-only boundary in the design.

---

## M-8: The App's Embedded HTTP Client's Default Headers / Cookies Leak Between Unrelated Requests

**What goes wrong:** Postman has session-scoped cookies. If the app reuses one HTTP client across requests without a `CookieJar` reset, the `Set-Cookie` from `POST /login` carries into `GET /api/users` in an unrelated collection. The user sees requests succeeding that shouldn't, and can't reproduce the bug in cURL.

**Why it happens:** Long-lived HTTP clients maintain state. The user expects "request isolation" by default.

**Warning signs:**
- A request works in the app but fails via cURL.
- Cookies from a previous request appear in a request that doesn't have a session context.
- A "session expired" error appears for a request that shouldn't have a session.

**Prevention:**
- **Cross-cutting — explicit, isolated request contexts:**
  - Default: each request is a fresh `Client` / `HttpClient` instance with no cookie jar, no default headers, no connection reuse.
  - The "session" concept is opt-in: the user explicitly creates a "Session" tab and adds requests to it.
  - For chains, the cookie jar persists across chain steps (this is the whole point), but is reset between chain runs unless "reuse cookies from last run" is checked.
  - Surface the active cookies in a side panel: "This request will send: `sessionid=abc123` (from step 2)." The user can see the leak.
  - For preflight / CORS: the desktop app's main-process HTTP client must add `Origin` deliberately; see C-7.

**Phase:** Phase 1 (HTTP engine) — design with isolation as the default.

---

## M-9: Scanning a Multi-Module Maven Project Misses the Module Roots

**What goes wrong:** The user points the app at a multi-module Maven project: `parent/pom.xml` with `<modules><module>api</module><module>core</module><module>db</module></modules>`. The app walks `parent/src/` (empty or contains only the parent POM) and finds zero controllers. The user thinks the app is broken. The controllers are in `parent/api/src/main/java/...`.

**Why it happens:** Naive file walking starts at the project root and looks for `.java` files. Multi-module projects have a different root per module.

**Warning signs:**
- "0 endpoints found" on a project the user knows has 200+.
- The user has to point the app at each module separately.

**Prevention:**
- **Phase 1 (Scan) — Maven and Gradle module awareness:**
  - Detect `pom.xml` at the root → parse `<modules>` and add each module's `src/main/java/` (or `src/main/kotlin/`) to the scan roots.
  - Detect `settings.gradle` / `settings.gradle.kts` → parse `include` statements.
  - Detect `build.gradle` / `build.gradle.kts` without a `settings.gradle` → assume single-module.
  - When a user points the app at a project root, show a confirmation: "Found 3 Maven modules. Scanning all? [Yes] / [Pick specific]."
  - Detect subprojects' `pom.xml` / `build.gradle` and recurse.

**Phase:** Phase 1 (Scan). Critical for "real" Spring projects; the first user complaint will be "I have 4 modules, why did you find 0 controllers?"

---

## M-10: Postman Collection v2.1 Import/Export Has Field Inconsistencies That Lose Data

**What goes wrong:** The user imports a Postman collection with 50 requests. Some requests use `request.url.raw` (a string), others use `request.url` as an object with `protocol/host/path`. Some have `request.body.raw` as a JSON string, others have `request.body.options.raw` deeply nested. Some `auth` objects use the v2.1 nested form, others use the v2.0 flat form. The import "succeeds" but loses the body, auth, or URL on 10% of requests.

On export, the reverse: a request with multiple headers, query params, and a body mode of `formdata` is exported but the body becomes a flat string, the headers lose their order, and an `auth.bearer` array gets re-serialized into the v2.0 flat form, breaking round-trip identity.

**Why it happens:** Postman v2.1 schema is forgiving; Postman v2.0 is more rigid. The format is large and the spec is informal. Real-world collections have inconsistencies. Round-trip identity (import what you exported) is not guaranteed by the spec.

**Warning signs:**
- Imported requests have no body, no auth, or wrong URL.
- Round-tripping (export → re-import) loses fields.
- Some auth types survive, others (e.g., `oauth2`) become a string.

**Prevention:**
- **Phase 4 (Import/Export) — write a strict, narrow import and a lossless export:**
  - **Import:** parse the JSON, normalize to an internal model, and *report* which fields couldn't be parsed: "Imported 47 of 50 requests. 3 requests had unrecognized auth types: [OAuth1, hawk]. Skipped." Never silently drop.
  - **Export:** always emit the latest schema version (v2.1) in a normalized form. Don't preserve the original's quirks.
  - For the round-trip test, build a fixture of 20+ Postman collections (publicly shared ones on GitHub) and assert round-trip equality.
  - For body modes, support `raw` (any text), `formdata` (multipart key-value), `urlencoded` (key-value), `file` (binary ref), `graphql` (query+variables). `file` mode means: the user has a file in the collection's working dir. Handle missing files gracefully.

**Phase:** Phase 4 (Persistence + Import/Export). Test against real collections, not hand-crafted JSON.

---

# MINOR PITFALLS — UX and Polish Issues

## m-1: Big Response Bodies Crash the Renderer

**What goes wrong:** The user fires a request that returns 50MB of JSON. The renderer tries to syntax-highlight and virtual-scroll the whole thing. UI freezes.

**Prevention:**
- **Phase 1 (HTTP engine):** Cap body display at 1MB. Show "Body truncated at 1MB (full size: 52.3MB). Click to load full body." For "load full," stream via the OS file picker, save to a temp file, and offer "Open in external viewer."
- Use a virtualized JSON tree renderer (e.g., `react-json-view` with `collapsed` depth limit) for the body panel. Do not render > 5,000 nodes without explicit user action.

**Phase:** Phase 1.

---

## m-2: Variable Substitution Recursion (A→B→A) Hangs the Chain Resolver

**What goes wrong:** Variable `x` is defined as `{{y}}`, variable `y` is defined as `{{x}}`. Resolver enters infinite recursion. Stack overflow.

**Prevention:**
- **Phase 3 (Chains):** Resolver tracks `Set<String> currentlyResolving`; if a name appears twice, throw `CircularVariableReference` and surface "Variables `x` and `y` form a cycle."

**Phase:** Phase 3.

---

## m-3: Endpoint Disambiguation by Path Collides When the App Shows the Wrong Match

**What goes wrong:** The Spring app has two controllers with overlapping paths: `UserController.getUser(@PathVariable Long id)` and `AdminUserController.getUser(@PathVariable Long id)`. Both produce `GET /users/{id}`. The detected endpoint list shows "GET /users/{id}" once. The user picks it. Sends the request. Hits the wrong controller (depends on Spring's URL matching precedence). The user is confused.

**Prevention:**
- **Phase 1 (Scan):** When a path collision is detected, suffix the entry with the controller class name: `GET /users/{id}  [UserController]`. Allow the user to filter or pick the specific one.
- In the URL display, show the source file path: `UserController.java:23`.

**Phase:** Phase 1.

---

## m-4: Lombok's `@Builder.Default` Silently Uses Null Instead of the Default

**What goes wrong:** `@Builder class User { @Builder.Default String status = "active"; }`. The user picks this DTO. The body generator emits `"status": null` because it doesn't know to emit the initializer value. The server receives a null and fails validation.

**Why it happens:** Lombok hides initializers from the constructor; the parser sees no constructor parameter for `status` and assumes null.

**Prevention:**
- **Phase 2 (Body Gen):** When scanning Lombok classes, also read the field initializer (the `= "active"` part). For `@Builder.Default`, use the initializer as the placeholder. For fields with no initializer and no `@NonNull`, use `null` (with a yellow indicator).
- For Lombok's `@Builder.Default` specifically, the initializer expression is in the source — extract it from `VariableDeclarator.getInitializer()` and use it as the JSON value, not the parameter-less default.

**Phase:** Phase 2.

---

## m-5: User's `.postmanclone` Data Directory in a Cloud-Synced Folder Causes Multi-Machine Corruption

**What goes wrong:** The user has `~/Projects` synced via Dropbox / iCloud / OneDrive. The PostmanClone data directory (`~/.postmanclone/collections/`, `~/.postmanclone/history/`, etc.) gets synced. Two machines open the same data; writes conflict; the SQLite history DB is corrupted ("database disk image is malformed").

**Why it happens:** Desktop apps that store state in the user's home directory assume the home is local. Cloud-synced home directories break this assumption.

**Prevention:**
- **Cross-cutting:** Document the recommended location. Default: `~/.postmanclone/` (local). On first run, detect if the path is inside a known-synced location (Dropbox, OneDrive, iCloud Drive) and warn: "Your data directory is inside a cloud-synced folder. This can cause corruption if the app is open on multiple machines. Move to a local folder?"
- For SQLite specifically, use WAL mode (`PRAGMA journal_mode=WAL`) and `PRAGMA synchronous=NORMAL` for better concurrent-read behavior. Even so, multi-machine is a no-go.
- Provide an explicit "Workspace" location setting — let the user pick.

**Phase:** Phase 4 (Persistence).

---

## m-6: Java Records With No Getters, Only Accessor Methods Named After Fields

**What goes wrong:** `record User(String name, int age) {}`. The accessor is `name()`, not `getName()`. A parser that looks for `getX()` patterns misses every record field.

**Why it happens:** Records use the accessor name as the field name (no `get` prefix). This is the JEP 395 design.

**Warning signs:**
- "Generated body is empty" for a class that is clearly a record.
- Field names show in the parser AST but not in the body's JSON.

**Prevention:**
- **Phase 1 (Scan):** Detect `record` types (JavaParser exposes `RecordDeclaration`) and use the record component name directly. Don't rely on getter naming.
- For records, the canonical constructor takes all components; the body generator can synthesize a JSON with one of each component.

**Phase:** Phase 1.

---

## m-7: Sealed Types and Pattern Matching Break Naive Field Walking

**What goes wrong:** `sealed interface Shape permits Circle, Rectangle { } record Circle(double radius) implements Shape {} record Rectangle(double w, double h) implements Shape {}`. The DTO is `Shape`. Walking the AST for `Shape` finds the interface but no fields. The body generator emits `{}`. The user has to pick a concrete subtype.

**Why it happens:** Sealed types are abstract by design. The "shape" depends on which concrete subtype.

**Prevention:**
- **Phase 1 (Scan):** When a DTO is a sealed type, show all permitted subtypes in the body picker. Let the user pick which subtype to instantiate: "Body for `Shape`: [Circle] [Rectangle]."
- Emit the JSON with a `{"type": "circle", ...}` discriminator (or whatever the project's Jackson config uses for `@JsonTypeInfo`).
- Detect `@JsonTypeInfo` and `@JsonSubTypes` annotations; use them to drive the picker.

**Phase:** Phase 1 + Phase 2.

---

## m-8: Connection Pool in a Desktop App Eats the Single-User DB Connection

**What goes wrong:** HikariCP defaults are `maximumPoolSize=10` (Source: HikariCP — `private static final int DEFAULT_POOL_SIZE = 10`). For a desktop app with one user, 10 connections to a developer's local Postgres is wasteful and may hit `max_connections` on small dev DBs.

**Prevention:**
- **Phase 2 (DB Body Gen):** Configure HikariCP (or whatever) with `maximumPoolSize=2`, `minimumIdle=1`, `connectionTimeout=10s`, `idleTimeout=5min`, `maxLifetime=15min` (Source: HikariCP defaults). Single user = small pool.
- `keepaliveTime=2min` to avoid stale connections.
- Shut down the pool when the DB connection panel is closed (or after 5 min idle).
- On app exit, call `dataSource.close()` deterministically (JVM shutdown hook).

**Phase:** Phase 2.

---

## m-9: Tauri Filesystem Scope Blocks Reading User's Project Without Explicit Permission

**What goes wrong:** The user points the app at `C:\Projects\my-spring-app`. Tauri v2's capability system requires the renderer to declare a `fs:allow-read-text-file` permission *and* the path must be in the allowed scope (Source: Tauri docs — `Configure allowed URLs for HTTP plugin` and `Command Scopes`). Default scopes are `$DOWNLOAD/*`, `$DOCUMENT/*`, `$DESKTOP/*`, etc. — *not* arbitrary project directories. The user gets a permission denied error that says nothing about scope.

**Why it happens:** Tauri v2's security model is strict by design. Permissions must be declared in `tauri.conf.json` capabilities.

**Prevention:**
- **Phase 1 (Scan):** Tauri config: declare a `fs:scope` that includes the user's project root, OR provide a per-pick scope that uses a custom command and the file path passed in as an argument (which is then validated).
- The safer pattern: route all filesystem reads through a Rust command in `src-tauri/` that takes a path argument and validates it (e.g., path must be a directory, must be readable). The renderer never has raw FS access; it calls `plugin:fs|read_dir` or a custom `read_java_files(path: String)` command.
- For Electron (if chosen): enable `contextIsolation: true`, `nodeIntegration: false`, and expose file system access via a narrow preload script using `contextBridge` (Source: Electron docs — `contextBridge.exposeInMainWorld`). Never expose `ipcRenderer.send` directly (Source: Electron docs — `Unsafe IPC Exposure via Context Bridge`).

**Phase:** Phase 1 (Scan) — capability config is a Tauri/Electron phase-1 concern.

---

## m-10: Native Modal Dialogs for File Picker Block on Long-Path Namespaces

**What goes wrong:** On Windows, paths longer than 260 characters throw `ERROR_FILE_NOT_FOUND` from `CreateFile` unless the app opts into long-path support (`\\?\` prefix, manifest setting). Java `Files.walk()` and Tauri's `fs` plugin may or may not handle this consistently.

**Prevention:**
- **Cross-cutting:** On Windows, ensure the manifest has `longPathAware` enabled (Tauri does this by default for newer versions; verify). For Java's NIO, use `Paths.get` with the `\\?\` prefix when paths exceed 240 chars.
- For Tauri/Electron, the file picker dialog returns native paths — the app's parser must handle both `C:\foo\bar` and `\\?\C:\foo\bar`.

**Phase:** Cross-cutting.

---

# PHASE MAPPING — Where Each Pitfall Should Be Addressed

| Phase | Pitfalls to Plan / Implement For |
|-------|----------------------------------|
| **Phase 1: Scan & Project Onboarding** | C-1 (cycle detection: starts here, fully in Phase 2), C-2 (JavaParser symbol resolution, test corpus), C-3 (Lombok detection), C-8 (denylist), C-9 (Jakarta namespace), M-4 (incremental scan), M-9 (multi-module), m-3 (path collisions), m-6 (records), m-7 (sealed types), m-9 (Tauri FS scope), m-10 (long paths) |
| **Phase 2: Body Generation (DTO + DB)** | C-1, C-3, C-4, C-5, C-6, C-7, M-1 (snake_case vs camelCase), M-6 (mapping UI), M-7 (JPA boundary), m-4 (Lombok @Builder.Default), m-8 (small pool) |
| **Phase 3: Chains & Response Mapping** | M-2 (chain var resolution), M-5 (timeouts/retries), m-2 (var cycle) |
| **Phase 4: Persistence + Import/Export** | M-3 (secret-aware logging), M-10 (Postman v2.1 round-trip), m-5 (data dir location), m-1 (response size cap) |
| **Cross-cutting (apply throughout)** | C-7 (main-process HTTP), M-3 (secrets), M-8 (request isolation), m-5 (data dir), C-6 (keychain), m-9 (capabilities) |

---

# RESEARCH FLAGS — Phases That Need Deeper Research

The following pitfalls need phase-specific research because the path forward is non-obvious:

- **Phase 1 / M-9 + multi-module Gradle:** Multi-module Gradle (Kotlin DSL) is more complex than Maven. Needs its own research spike.
- **Phase 2 / C-4 (JSON column handling):** Per-driver quirks (Oracle 21c+ `JSON` vs older `CLOB`; SQL Server 2016+ `nvarchar(max)` JSON; DB2 JSON). Worth a research spike before implementation.
- **Phase 2 / M-1 (naming strategy):** Jackson naming strategies + custom `PropertyNamingStrategy` subclasses in user code. Possible research spike.
- **Phase 3 / M-5 (streaming responses):** SSE, chunked, and WebSocket semantics for chain steps. Likely needs a dedicated research phase.
- **Phase 4 / M-3 (secret storage):** Picking the right cross-platform keychain library for the chosen desktop stack (Tauri → `tauri-plugin-stronghold` vs custom `keyring-rs`; Electron → `keytar` vs `@napi-rs/keyring`).

---

# SOURCES & CONFIDENCE

| Source | Type | Confidence | Notes |
|--------|------|-----------|-------|
| [JavaParser wiki — About the Symbol-Solver](https://github.com/javaparser/javaparser/wiki/About-the-Symbol-Solver) | Official docs | HIGH | Confirms: generics resolution incomplete, JLS non-compliance, lambda circularity, inner class scope. |
| [JavaParser symbol-solver-testing/ComplexTypeResolving.java](https://github.com/javaparser/javaparser) | Source test | HIGH | Confirms inner-class disambiguation is a known concern. |
| [JavaParser FEATURES.md](https://github.com/javaparser/javaparser/blob/master/FEATURES.md) | Official | HIGH | Records: 3.22.0+; sealed: 3.22.0+; pattern matching for instanceof: 3.18.0+. |
| [JavaParser Migration-Guide-3.25.10-to-3.26.0](https://github.com/javaparser/javaparser/wiki/Migration-Guide-3.25.10-to-3.26.0) | Official wiki | HIGH | Java 21 record pattern support requires 3.26.0+. |
| [Project Lombok — `@Data` feature](https://projectlombok.org/features/Data) | Official | HIGH | `@Data` is a shortcut for `@ToString`, `@EqualsAndHashCode`, `@Getter/Setter`, `@RequiredArgsConstructor`. |
| [Baeldung — Jackson's Deserialization With Lombok](https://www.baeldung.com/java-jackson-deserialization-lombok) | Tutorial | MEDIUM | `@Jacksonized` requires `@Builder`/`@SuperBuilder`; still experimental. |
| [Electron — Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model) | Official | HIGH | `contextBridge` is the safe IPC exposure pattern. |
| [Electron — Security Tutorial](https://www.electronjs.org/docs/latest/tutorial/security) | Official | HIGH | `contextIsolation: true`, `nodeIntegration: false` are mandatory. |
| [Tauri v2 — Capabilities](https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/security/capabilities.mdx) | Official | HIGH | Capabilities are JSON-declared; default scopes are limited. |
| [Tauri v2 — Command Scopes](https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/security/scope.mdx) | Official | HIGH | `fs` and `http` plugins use scopes; must be declared per command. |
| [HikariCP — HikariConfig.java](https://github.com/brettwooldridge/HikariCP/blob/dev/src/main/java/com/zaxxer/hikari/HikariConfig.java) | Source | HIGH | `DEFAULT_POOL_SIZE=10`, `MAX_LIFETIME=30min`, `IDLE_TIMEOUT=10min`. |
| [Jackson core — TypeReference usage](https://github.com/FasterXML/jackson) | Source/docs | HIGH | ObjectMapper + JsonNode for normalized JSON handling. |
| [Spring Boot 3.0 — System Requirements](https://docs.spring.io/spring-boot/docs/3.0.0/reference/htmlsingle/) | Official | HIGH | Spring Boot 3 requires Java 17+; uses Jakarta EE namespace. |
| [Baeldung, Thorben Janssen, multiple SO threads on `LazyInitializationException`](https://stackoverflow.com/questions/578433) | Tutorial/QA | HIGH | Confirms classic Hibernate pitfall; must be designed around. |
| [Keyring-rs](https://github.com/hwchen/awesome-rust-security) | Library | MEDIUM | Cross-platform secret store; recommended for Tauri. |
| [Tauri issue tracker — `tauri-apps/tauri` issues](https://github.com/tauri-apps/tauri/issues) | Issue tracker | MEDIUM | Multiple historical "filesystem permission denied" issues; capability config is the cause. |

**Gaps to address in phase research:**
- Real-world failure modes in Postman v2.1 import/export (no formal spec; Postman docs are informal). Recommend collecting 10+ real collections as fixtures.
- Spring Boot 3.x + Java records + Lombok + MapStruct interactions in production codebases (no public corpus; build one).
- HikariCP behavior in a long-lived desktop process (most HikariCP guidance is server-side; desktop is a different beast — single connection user, idle for hours).
- ORM (Hibernate / jOOQ) interactions with the desktop JDBC boundary — does the user's *running* Spring app interfere with the desktop app's raw JDBC connection to the same DB? (Likely not, but worth a research spike.)
