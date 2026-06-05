# Phase 3: Body Generation (DTO + DB) - Research

**Researched:** 2026-06-05
**Domain:** Java DTO schema walking + JDBC database integration + Electron secure credential storage
**Confidence:** HIGH for DTO walking patterns, HikariCP config, safeStorage API; MEDIUM-HIGH for per-driver JDBC type normalization

## Summary

Phase 3 delivers two body generation modes: DTO Schema Mode (BODY-01..03) where the JVM helper walks a DTO class and produces placeholder JSON matching its shape, and DB Data Mode (DB-01..07) where the helper connects to PostgreSQL/MySQL/Oracle/H2, fetches rows, and maps them to the DTO's JSON shape.

The body generation engine lives entirely in the JVM helper -- the renderer never parses DTOs or runs SQL. It sends JSON-RPC 2.0 requests over stdio (`classpath:walkDto`, `db:connect`, `db:fetchRows`, etc.) and receives JSON results. The main process acts as a relay (IPC router -> supervisor -> helper client) with all payloads Zod-validated at both boundaries.

Cycle detection for recursive DTOs is the highest-risk item (PITFALL C-1). The algorithm tracks visited FQNs in a `Set<String>`, emits `{"$ref": "ClassName"}` on revisit, and caps depth at 6 with a `_cycle_depth_exceeded` sentinel. This must be built first in 03-01, not retrofitted.

Database connections are per-project, stored in `db-connections/<id>.json`, with passwords encrypted via Electron `safeStorage` (async API). HikariCP pool size is capped at 2 for desktop use. Each JDBC driver requires a type normalizer for non-scalar column types (PostgreSQL `jsonb` as PGobject, MySQL `JSON` as String, Oracle `JSON` as CLOB/String, H2 as String).

**Primary recommendation:** Implement the DTO schema walker (03-01) as a standalone Java module tested against a corpus of DTO classes -- this can progress independently of Phase 2. DB connection management (03-02) and the mapping UI (03-03) depend on the Phase 2 IPC contract but not its full implementation. Build safeStorage integration as the first task of 03-02 to ensure credential encryption is never an afterthought.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** "Generate" button in body editor toolbar. When a DTO is detected, a "Generate" button appears in the body editor toolbar. The current body mode auto-switches to raw-JSON.
- **D-02:** Overwrite current body on generate. Generated JSON replaces whatever is in the body editor. `isDirty: true` so user can Ctrl+Z undo.
- **D-03:** Dropdown for multiple subtypes. When @RequestBody accepts abstract base with concrete subtypes, a small dropdown appears next to Generate button listing detected subtype names.
- **D-04:** Record/Lombok constructor tracing for placeholder generation. Walk constructor parameters; map parameter names to JSON fields.
- **D-05:** Type-indicative placeholder values with angle brackets. `String` -> `"<string>"`, `int`/`long`/`Integer` -> `"<number>"`, `boolean` -> `"<boolean>"`, `UUID` -> `"<uuid>"`, `LocalDate` -> `"<date>"`, `LocalDateTime`/`Instant` -> `"<datetime>"`.
- **D-06:** Enum fields generate with first value + comment listing all options. `"status": "ACTIVE" // valid: ACTIVE, INACTIVE, SUSPENDED`. Comment is display-only (stripped before send).
- **D-07:** Optional<T> fields included with type placeholder. All Optional fields appear in generated body. Not omitted or null.
- **D-08:** Collections show one sample element. `List<T>` -> `["<t-value>"]`, `Set<T>` -> `["<t-value>"]`, `Map<K,V>` -> `{"<key>": "<value>"}`.
- **D-09:** Cycle detection via `$ref` markers, depth cap 6. Bidirectional relationships emit `{"$ref": "ClassName"}`. Depth counter caps at 6; beyond that, `"_cycle_depth_exceeded": true`.
- **D-10:** Strip JSON comments before HTTP send. Enum comments and display-only annotations removed when sending request.
- **Stack:** Electron 42.3.2 + React 19.2.0 + Vite 8 + TypeScript 5.6+ + Zustand 5 + TanStack Query 5 + Zod 4 + undici 7 + Monaco + Java 21 LTS + jsonrpc4j 1.6 + safeStorage (NOT keytar) + HikariCP 6 (pool size 2)
- **3-process architecture:** Renderer <-> Main (Pattern 2 invoke/handle + Zod) <-> JVM Helper (JSON-RPC 2.0 stdio, long-lived)
- **Storage:** JSON files in `app.getPath('userData')`, atomic writes, secrets via `safeStorage`
- **Read-only Spring project access:** Helper must never write to the Spring project directory
- **No DB credential egress:** Never log, never send off-device, never include in error messages

### the agent's Discretion

- DB connection management UX: where connections are created/managed (settings page vs. panel off request editor vs. global sidebar section). How connection linked to request (per-request dropdown, per-collection). Reference sketch 006-B (JDBC URL auto-parse with parsed grid).
- Column->field mapping editor: Exact UI design for the mapping table (dropdowns per column? Auto-map by name similarity as default?). How required-field coverage badge is visualized. How green/yellow/red type-compatibility is rendered. Reference sketch 007-D.
- DB connection lifecycle: When connections are opened/closed. Per-request vs. persistent pool. Connection naming. Test-connection button behavior.
- Helper-offline degraded mode: How body generation UI behaves when helper is offline (disabled button with tooltip, or button absent). DB features fully unavailable without helper; DTO schema mode may be cacheable in renderer.
- Row picker UX: How "by id", "by custom WHERE", and "first N rows" options are presented. Reference sketch 007-D (tree sidebar with inline rows).
- Per-driver type normalizer scope: Exactly which JDBC column types map to which JSON types per driver (PostgreSQL jsonb->PGobject, MySQL JSON->String, Oracle JSON->CLOB, H2 String).

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BODY-01 | Generate JSON body matching DTO schema (field names, types, nesting, enums, collections, optionals) | JavaParser field walking with CombinedTypeSolver for type resolution; hybrid source+bytecode strategy for Lombok |
| BODY-02 | Sensible placeholder values user can edit | PlaceholderFactory maps Java types to `<string>`, `<number>`, `<boolean>` etc.; enum values use first constant |
| BODY-03 | Recursive types without infinite loops (cycle detection, `$ref` markers, depth cap 6) | CycleDetector tracks visited FQNs in Set<String>; depth counter caps at 6; emits `{"$ref": "ClassName"}` on revisit |
| DB-01 | Connect app to database (JDBC) used by Spring project | HikariCP 6.x pool per connection; drivers bundled in helper fat-jar; credentials via safeStorage |
| DB-02 | List available tables and their columns | DatabaseMetaData.getTables()/getColumns(); per-driver schema introspection |
| DB-03 | Pick a table for endpoint's request body | Renderer table picker UI (tree sidebar per sketch 007-D); helper returns table list |
| DB-04 | Fetch rows, produce JSON shaped to DTO | JDBC ResultSet -> Jackson ObjectNode; column->field name matching; per-driver type normalization |
| DB-05 | Column-to-field mapping user can override | Case-insensitive + snake_case/camelCase default mapping; two-column editable table UI; color-coded compatibility |
| DB-06 | Row selection by id, by query, or "first N" | LIMIT cap 100 default; user provides id/custom WHERE; "Load 10 more" pagination |
| DB-07 | DB credentials stored locally (OS keychain), never sent off-device | Electron safeStorage async API (encryptStringAsync/decryptStringAsync); encrypted in JSON; never logged |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| DTO field walking and type resolution | JVM Helper | -- | JavaParser + symbol-solver-core run in the JVM; renderer has no Java classpath access |
| Cycle detection and `$ref` emission | JVM Helper | -- | Walks the DTO AST; produces JSON body string |
| Placeholder value generation (type-indicative) | JVM Helper | -- | Uses Java type info to emit `<string>`, `<number>`, etc. |
| DB connection management (HikariCP pool) | JVM Helper | Main (safeStorage) | JDBC drivers live in helper; Main process holds encrypted credentials and relays to helper at connect time |
| DB password encryption/decryption | Main (Node) | -- | Electron `safeStorage` API is only available in the main process |
| DB connection lifecycle (open/close/test) | JVM Helper | Main (supervisor) | Helper manages pool; main relays connect/disconnect/test RPC calls |
| Table/column enumeration | JVM Helper | -- | Uses `DatabaseMetaData.getTables()` / `getColumns()` |
| Row query and JSON generation | JVM Helper | -- | Raw JDBC to Jackson `ObjectNode` to JSON string |
| Column-to-field name matching | JVM Helper | -- | Case-insensitive + snake_case/camelCase transform |
| Per-driver type normalization (jsonb->JSON) | JVM Helper | -- | Driver-specific detection of PGobject/String/CLOB |
| Body editor toolbar (Generate button, DTO picker) | Renderer | -- | React component extending existing BodyTab |
| DB connection settings UI | Renderer | -- | JDBC URL auto-parse panel, table/row picker tree |
| Column-to-field mapping editor UI | Renderer | -- | Two-column mapping table with color-coded compatibility |
| IPC routing (body:*, db:* channels) | Main (Node) | -- | Zod-validated ipcMain.handle relay to helper client |
| DB connection JSON persistence | Main (Node) | -- | Atomic JSON writes to `db-connections/<id>.json` |

## Standard Stack

### Core (Java -- JVM Helper)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| JavaParser + symbol-solver-core | 3.28.1 | Parse DTO source, resolve types, walk fields/constructors | [VERIFIED: STACK.md Context7] Only source-level parser with symbol resolution for Spring projects |
| ASM | 9.x | Bytecode fallback for Lombok-generated fields/getters | [ASSUMED] Standard bytecode library; handles classes without sources |
| Jackson (core+databind+annotations) | 2.21.2 | JSON generation from DTO walk; JDBC row to JsonNode | [VERIFIED: STACK.md Context7] Every Spring project ships Jackson 2.x; avoids version conflicts |
| HikariCP | 6.x | JDBC connection pooling | [VERIFIED: STACK.md Context7] Industry standard; single-user desktop overrides well-documented |
| jsonrpc4j | 1.6.0 | Already used for helper RPC server; new RPC methods register here | [VERIFIED: STACK.md] Existing dependency; no new RPC framework needed |
| PostgreSQL JDBC | 42.7.11 | PostgreSQL driver | [VERIFIED: STACK.md Context7] |
| MySQL Connector/J | 9.x | MySQL driver | [ASSUMED] Exact patch version not verified; major line clear |
| Oracle JDBC (ojdbc11) | 23.x | Oracle driver (Java 11+) | [ASSUMED] Oracle versioning irregular; verify at build time |
| H2 Database | 2.3.x | H2 embedded driver | [ASSUMED] Exact patch not verified; 2.x major confirmed |

### Core (Node/TypeScript -- Main Process)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron `safeStorage` (async API) | built-in (Electron 42) | Encrypt/decrypt DB passwords | [VERIFIED: Context7 docs] Built into Electron; no extra dep; OS-native keychain/DPAPI/libsecret |
| electron-store | latest | Persist DB connection metadata (non-secret fields) | [ASSUMED] Existing Phase 1 dependency |
| Zod | 4.0.1 | Validate new IPC payloads (body generation, DB operations) | [ASSUMED] Existing Phase 1 dependency |

### Core (React -- Renderer)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.2.0 | UI components (Generate button, DB connection panel, mapping editor) | [ASSUMED] Existing Phase 1 dependency |
| Monaco Editor | via @monaco-editor/react 4.7.0 | JSON body editor with inline comment display | [ASSUMED] Existing Phase 1; npm view confirms 4.7.0 |
| Zustand | 5.0.14 | Local UI state (DB connections, generated body metadata) | [ASSUMED] npm view confirms 5.0.14 |
| TanStack Query | 5.101.0 | Server state cache (DTO schemas, table lists, row data) | [ASSUMED] npm view confirms 5.101.0 |
| react-virtuoso | 4.18.7 | Virtualized table/row lists | [ASSUMED] npm view confirms 4.18.7 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JavaParser field walking | Eclipse JDT | JDT has better generics resolution but heavier; defer to v2 |
| HikariCP | Tomcat JDBC Pool / c3p0 | HikariCP faster, better-documented |
| `keytar` for secrets | Electron `safeStorage` | keytar ARCHIVED 2022-12-15; safeStorage built-in |
| `mariadb-java-client` (LGPL) | MySQL Connector/J (GPLv2) | LGPL friendlier for distribution; current stack uses Oracle's driver |

**Installation (helper/build.gradle.kts additions):**
```groovy
implementation 'com.github.javaparser:javaparser-core:3.28.1'
implementation 'com.github.javaparser:javaparser-symbol-solver-core:3.28.1'
implementation 'org.ow2.asm:asm:9.7'
implementation 'com.zaxxer:HikariCP:6.2.1'
implementation 'org.postgresql:postgresql:42.7.11'
implementation 'com.mysql:mysql-connector-j:9.1.0'
implementation 'com.oracle.database.jdbc:ojdbc11:23.7.0.25.01'
implementation 'com.h2database:h2:2.3.232'
```

No new npm packages are needed for Phase 3 -- all renderer/main dependencies are existing from Phase 1.

## Package Legitimacy Audit

Phase 3 introduces **no new npm packages**. All existing npm packages were installed in Phase 1. The phase is primarily Java-side (Maven/Gradle dependencies for the helper fat-jar).

| Package | Registry | Age | Disposition |
|---------|----------|-----|-------------|
| @monaco-editor/react | npm | ~5 yrs | Existing - Phase 1 |
| react-virtuoso | npm | ~5 yrs | Existing - Phase 1 |
| zustand | npm | ~6 yrs | Existing - Phase 1 |
| @tanstack/react-query | npm | ~6 yrs | Existing - Phase 1 |
| zod | npm | ~4 yrs | Existing - Phase 1 |
| javaparser-core | Maven | 10+ yrs | Existing - Stack decision |
| HikariCP | Maven | 10+ yrs | Existing - Stack decision |
| org.postgresql:postgresql | Maven | 20+ yrs | Existing - Stack decision |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck installed via pip but not callable from shell)

**Packages flagged as suspicious [SUS]:** none

*slopcheck could not execute from shell path. All npm packages above are tagged `[ASSUMED]`. The planner should gate any new npm install behind a `checkpoint:human-verify` task. Maven dependencies (Java side) were verified in STACK.md via Context7.*

## Architecture Patterns

### System Architecture Diagram

```
  RENDERER (Chromium + React 19)
  +-------------------+  +---------------------+  +------------------------+
  | Body Editor       |  | DB Connection Panel  |  | Column-Field Mapping  |
  | "Generate" button |  | JDBC URL auto-parse  |  | Two-column table      |
  | DTO picker (D-03) |  | Table/row tree (D)   |  | Green/yellow/red      |
  | Monaco editor     |  | sketch 007-D         |  | Coverage badge        |
  +--------+----------+  +----------+----------+  +-----------+------------+
           |                        |                         |
           | ipcRenderer.invoke()   |  (Zod-validated payloads)
           +----------+-------------+-------------+-----------+
                      |
  MAIN (Node 24 + Electron 42)
  +-------------------+  +------------------+  +-----------------------+
  | IPC Router        |  | safeStorage       |  | Storage Layer         |
  | body:generateDto  |  | encryptStringAsync|  | db-connections/*.json |
  | db:connect        |  | decryptStringAsync|  | atomic writeFileAtomic|
  | db:fetchRows      |  |                   |  |                       |
  +--------+----------+  +------------------+  +-----------------------+
           |
  +--------+----------+
  | JVM Supervisor    |
  | JsonRpcClientImpl |
  +--------+----------+
           |  JSON-RPC 2.0 over stdio (newline-framed)
  +--------+----------+
  | JVM HELPER (Java 21, long-lived subprocess)
  | +------------------+  +---------------------------+
  | | DTO Schema Walker|  | DB Connection Manager     |
  | | JavaParser walk  |  | HikariCP pool (maxSize=2) |
  | | Cycle detection  |  | Per-driver type normalizer|
  | | ASM Lombok fallbk|  | Row->JsonNode via Jackson |
  | +------------------+  +---------------------------+
  +----------------------------------------------------+
```

### Pattern 1: JVM Helper RPC Method Registration (Extending HelperJsonRpcServer)

**What:** Add new RPC methods to the existing helper server by dispatching on `method` string in the JSON-RPC request loop. The existing `initialize` and `shutdown` methods are the template.

**When to use:** For every new helper capability (DTO walk, DB connect, table list, row fetch).

**Example:**
```java
// In HelperJsonRpcServer.java, dispatch loop extension:
} else if ("classpath:walkDto".equals(method)) {
    String fqn = request.get("params").get("fqn").asText();
    DtoWalker walker = new DtoWalker(solver);
    String bodyJson = walker.walk(fqn, classpathRoots);
    response = mapper.writeValueAsString(Map.of(
        "jsonrpc", "2.0", "id", id,
        "result", bodyJson
    ));
} else if ("db:connect".equals(method)) {
    JsonNode params = request.get("params");
    String connId = params.get("connId").asText();
    String url = params.get("url").asText();
    String user = params.get("user").asText();
    String password = params.get("password").asText();
    DbConnectionManager mgr = new DbConnectionManager();
    mgr.connect(connId, url, user, password);
    response = mapper.writeValueAsString(Map.of(
        "jsonrpc", "2.0", "id", id,
        "result", Map.of("status", "connected")
    ));
}
```

### Pattern 2: Main Process IPC Handler Registration (Following Phase 1 Convention)

**What:** Register `ipcMain.handle('body:generateDto', ...)` and `ipcMain.handle('db:connect', ...)` in router.ts. Validate args with Zod, relay to helper via `supervisor.client.request()`, validate response, return to renderer.

**When to use:** For each new IPC channel the renderer needs to call.

**Example:**
```typescript
// In router.ts:
ipcMain.handle('body:generateDto', async (_, args) => {
  const { requestId, dtoFqn } = DtoGenerateArgsSchema.parse(args);
  const helper = supervisor.getClient();
  if (!helper) return { ok: false, error: 'Helper offline' };
  const bodyJson = await helper.request('classpath:walkDto', { fqn: dtoFqn });
  return DtoGenerateResultSchema.parse({ ok: true, bodyJson });
});
```

### Pattern 3: safeStorage Credential Wrapper (New for Phase 3)

**What:** A dedicated module `src/main/ipc/safeStorage.ts` that wraps Electron's `safeStorage` async API. Exposes `encryptCredential(text: string)` and `decryptCredential(encrypted: Buffer)` functions. Checks `safeStorage.isEncryptionAvailable()` first.

**Example:**
```typescript
// src/main/ipc/safeStorage.ts
import { safeStorage } from 'electron';

export function isAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

export async function encryptCredential(plainText: string): Promise<Buffer> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption not available on this platform');
  }
  // Async API preferred per Electron docs
  const encrypted = await safeStorage.encryptStringAsync(plainText);
  return encrypted;
}

export async function decryptCredential(encrypted: Buffer): Promise<{ result: string; shouldReEncrypt: boolean }> {
  return safeStorage.decryptStringAsync(encrypted);
}
```

### Pattern 4: DTO Schema Walker -- Hybrid Field Discovery

**What:** Prefer getter methods (they reflect Jackson's wire format). Fall back to declared fields for Lombok types. De-duplicate by JSON field name. Respect `@JsonProperty` name overrides.

**Java AST walk flow:**
1. Parse class via `StaticJavaParser.parse(sourceFile)`
2. Check if it's a `RecordDeclaration` -> walk constructor parameters (record accessors)
3. Check if it's an `EnumDeclaration` -> walk enum constants
4. Otherwise, walk `ClassOrInterfaceDeclaration.getFields()` and `getMethods()`
5. For each field/method, resolve type via `CombinedTypeSolver`
6. Check `@JsonProperty("name")` for field name override
7. For Lombok fallback: use ASM to read bytecode class, find getter/setter patterns
8. Track visited FQNs in `CycleDetector`; depth cap at 6

### Pattern 5: Per-Driver Type Normalizer (Strategy Pattern)

**What:** Interface `TypeNormalizer` with `Object normalize(ResultSet rs, int columnIndex, String columnTypeName)`. Each driver gets its own implementation. Called by `RowToJsonMapper` before inserting values.

```java
public interface TypeNormalizer {
    Object normalize(ResultSet rs, int columnIndex, String columnTypeName) throws SQLException;
}

public class PostgresTypeNormalizer implements TypeNormalizer {
    @Override
    public Object normalize(ResultSet rs, int col, String typeName) throws SQLException {
        Object raw = rs.getObject(col);
        if (raw instanceof PGobject) {
            PGobject pg = (PGobject) raw;
            String pgType = pg.getType();
            if ("json".equals(pgType) || "jsonb".equals(pgType)) {
                // Re-parse raw JSON string to JsonNode
                return new ObjectMapper().readTree(pg.getValue());
            }
            // hstore, uuid, etc. -- return string value
            return pg.getValue();
        }
        return raw;
    }
}
```

### Recommended Project Structure (New Files)

```
helper/src/main/java/com/postmanclone/helper/
  dto/
    DtoWalker.java              # Entry: FQN -> JSON string
    CycleDetector.java          # Set<FQN> + depth cap 6
    FieldDiscoveryStrategy.java # Interface
    SourceFieldDiscovery.java   # JavaParser-based
    BytecodeFieldDiscovery.java # ASM Lombok fallback
    PlaceholderFactory.java     # Type -> placeholder
    EnumCommentEmitter.java     # "ACTIVE" // valid: ...
  db/
    DbConnectionManager.java    # HikariCP pool lifecycle
    ConnectionPoolFactory.java  # HikariConfig builder
    TableEnumerator.java        # DatabaseMetaData calls
    RowToJsonMapper.java        # ResultSet -> ObjectNode
    ColumnFieldNameMatcher.java # snake_case <-> camelCase
    type/
      TypeNormalizer.java       # Interface
      PostgresTypeNormalizer.java
      MySqlTypeNormalizer.java
      OracleTypeNormalizer.java
      H2TypeNormalizer.java
  rpc/
    ClasspathRpcHandler.java    # dispatch for classpath:*
    DbRpcHandler.java           # dispatch for db:*
  config/
    ParserConfig.java           # CombinedTypeSolver, JAVA_21

src/main/
  ipc/
    safeStorage.ts              # NEW: wraps safeStorage API
  storage/
    db-connections.ts           # NEW: CRUD for db-connections/*.json

src/renderer/components/
  DbConnectionPanel/            # NEW: JDBC URL auto-parse + table/row tree
  ColumnFieldMapping/           # NEW: mapping editor table
```

### Anti-Patterns to Avoid

- **Walking getters alone without field fallback:** Lombok @Data classes have no source getters. Must use hybrid field+bytecode approach.
- **Silently skipping unresolvable types:** If type resolution fails, emit a `{"_unresolved_type": "TypeName"}` placeholder object, not empty `{}`. The user must know something is missing.
- **Using `parse()` instead of `ParseResult`:** `parse()` throws on syntax errors and halts the scan. Always use `ParseResult` and check `isSuccessful()`.
- **Storing raw (unencrypted) DB passwords:** Even in memory, clear passwords after use. Never serialize to JSON without encryption. Never include in error messages or logs.
- **Reusing HikariCP defaults without desktop override:** Default pool size is 10. Desktop app must override to `maximumPoolSize=2`.
- **Loading entire result sets into memory:** Always use `LIMIT` (cap 100 default), `setFetchSize`, and `try-with-resources` for JDBC operations.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Secret credential storage | Custom AES/file encryption | Electron `safeStorage` (async API) | OS-native keychain/DPAPI/libsecret; no custom crypto bugs |
| JDBC connection pooling | Custom pool / single-connection | HikariCP 6.x with desktop overrides | Proven, handles connection validation, timeout, leak detection |
| JSON serialization from Java | String concatenation / manual JSON building | Jackson 2.21.2 ObjectMapper + ObjectNode | Handles all edge cases (escaping, nesting, Unicode); already in helper |
| Cycle detection in recursive DTOs | Depth counter alone (still crashes on deep recursion) | Set<String> visited FQNs + depth cap 6 + `{"$ref": "ClassName"}` | Depth counter without visited set still O(2^n) on bidirectional relationships |
| Snake_case to camelCase conversion | Regex replacement / naive split | Guava CaseFormat (if added) or simple hand-rolled transform with edge case handling | Underscore followed by digit, consecutive underscores, leading underscore all need specific handling |
| JSON body comment stripping | Custom parser / regex | Pre-send filter: JSON.stringify(JSON.parse(stripped)) after Monaco editor | Simple, reliable, handles any valid JSON; comments stripped as pre-processing step |
| JDBC connection per driver | Four separate connection APIs | Unified DriverManager path: each driver registers via Class.forName(driverClass) or ServiceLoader | JDBC standard; HikariCP wraps DriverManager uniformly |

**Key insight:** The body generation engine is application code, not library composition. The "don't hand-roll" items are the supporting infrastructure (security, pooling, JSON). The DTO walker logic itself (field traversal, placeholder selection, cycle detection) is the unique value and must be bespoke.

## Common Pitfalls

### Pitfall 1: Recursive DTO Stack Overflow (PITFALL C-1)
**What goes wrong:** Naively walking DTO fields on bidirectional JPA relationships (User <-> Order) creates infinite recursion, stack overflow, or 50MB JSON payload.
**Why it happens:** Object graphs have back-references (@OneToMany/@ManyToOne). No termination condition.
**How to avoid:** `CycleDetector` tracks visited FQNs in `Set<String>`. On revisit, emit `{"$ref": "ClassName"}`. Depth counter caps at 6; beyond that emit `{"_cycle_depth_exceeded": true}`. Build this FIRST in 03-01.
**Warning signs:** UI freeze on "Generate" click. JSON > 1MB. Repeated nested structures.

### Pitfall 2: JavaParser Symbol Resolution Gaps (PITFALL C-2)
**What goes wrong:** `type.resolve()` returns null for generics, inner classes, cross-module types. Generated body has empty `{}` or missing fields.
**Why it happens:** Symbol-solver needs CombinedTypeSolver with all dependency JARs. Generic resolution is incomplete per JavaParser docs.
**How to avoid:** Configure CombinedTypeSolver with ReflectionTypeSolver + JavaParserTypeSolver + JarTypeSolver for every dependency. Use `ParseResult.isSuccessful()` instead of `parse()`. Fall back to `Object` shape for unresolved generics. Never crash on null resolve.
**Warning signs:** Fewer endpoints than expected. Empty generated bodies for generic DTOs. `UnsolvedSymbolException` in logs.

### Pitfall 3: Lombok Field Detection (PITFALL C-3)
**What goes wrong:** JavaParser sees source fields but not generated getters/setters. @Data class body generation misses fields or uses wrong names.
**Why it happens:** Lombok generates bytecode at compile time. Source has no getters. @Accessors(fluent=true) changes getter names.
**How to avoid:** Hybrid strategy: prefer getters (match `getX`/`isX` patterns), fall back to declared fields. Use ASM bytecode inspection for Lombok-only classes. Detect @Accessors annotation. Support @JsonProperty name overrides.
**Warning signs:** Lombok classes generating empty bodies. `@Accessors(fluent=true)` fields named wrong in JSON.

### Pitfall 4: PostgreSQL jsonb as PGobject (PITFALL C-4)
**What goes wrong:** `rs.getObject("metadata")` returns `PGobject` instead of parsed JSON. Body shows escaped string `"{\"key\": \"value\"}"` instead of nested object.
**Why it happens:** PostgreSQL JDBC driver returns json/jsonb columns as `PGobject` whose string value is the raw JSON.
**How to avoid:** Per-driver TypeNormalizer interface. PostgresTypeNormalizer checks `instanceof PGobject`, reads `getType()`, if "json" or "jsonb" calls `getValue()` and re-parses to Jackson `JsonNode`.
**Warning signs:** Nested escaped strings in generated body. `PGobject@1a2b3c` in body preview.

### Pitfall 5: Plaintext DB Credentials (PITFALL C-6)
**What goes wrong:** Password stored in plaintext JSON. Backup/screenshot/git commit exposes credentials.
**Why it happens:** "Remember password" defaults to plaintext file write.
**How to avoid:** Use Electron `safeStorage.encryptStringAsync()` before writing to `db-connections/<id>.json`. Decrypt only at connect time via `decryptStringAsync()`. Check `isEncryptionAvailable()` first. Never log credentials. Use async API (non-blocking) per Electron docs. Do NOT use keytar (archived 2022).
**Warning signs:** Grep for password in data directory returns hit. Credential file readable by all users.

### Pitfall 6: JDBC Driver Type Quirks (Oracle JSON, MySQL JSON)
**What goes wrong:** Oracle `JSON` column returns as `java.sql.SQLXML` in some versions, `String` in others. MySQL `JSON` returns as `String`. H2 returns as `String`. Without per-driver normalizer, body generation fails or emits wrong types.
**Why it happens:** JDBC spec allows drivers to return native types. Each driver does it differently.
**How to avoid:** TypeNormalizer interface with four implementations (Postgres, MySQL, Oracle, H2). Each checks the runtime type and normalizes to a Jackson `JsonNode`-compatible value. For unknown types, emit `{"_raw": "...stringified..."}` envelope.
**Warning signs:** Type mismatch errors. `CLOB@hash` in generated body. Oracle version-dependent behavior.

### Pitfall 7: Large Result Sets Freeze the App (PITFALL C-5)
**What goes wrong:** `SELECT * FROM events` on a table with 80M rows loads everything into memory. App freezes or OOM.
**Why it happens:** Naive JDBC without LIMIT or fetchSize.
**How to avoid:** Default `LIMIT 100` on all preview queries. `setFetchSize(50)` for PostgreSQL. `try-with-resources` for ResultSet/Statement. Per-row column size cap at 100KB with truncation marker. Row count preview via `SELECT COUNT(*)` before loading.
**Warning signs:** App freeze on table selection. Memory climb during DB browse. Force quit needed.

### Pitfall 8: Jakarta vs javax Annotation Namespace (PITFALL C-9)
**What goes wrong:** Spring Boot 2.7 uses `javax.*`; Spring Boot 3.x uses `jakarta.*`. Hardcoded FQN strings miss annotations on the other namespace.
**Why it happens:** The Jakarta EE 9+ migration changed package names.
**How to avoid:** Match annotations by FQN string, not class reference. Maintain a table of known FQNs for both namespaces. Phase 2 handles this for detection; Phase 3 inherits the DTO classes Phase 2 resolved. The DTO walker should accept resolved FQNs from Phase 2, not re-parse annotations.
**Warning signs:** Phase 2 resolves DTOs on Boot 3.x but Phase 3 can't find them. Mixed-namespace project fails.

## Code Examples

Verified patterns from official sources:

### DTO Walker: Field Discovery with JavaParser
```java
// Source: Context7 /javaparser/javaparser (llms.txt)
// Also: JavaParser wiki on symbol resolution
ClassOrInterfaceDeclaration cls = cu.getClassByName("UserDto").get();
for (FieldDeclaration field : cls.getFields()) {
    for (VariableDeclarator var : field.getVariables()) {
        String fieldName = var.getNameAsString();
        ResolvedType resolvedType = var.getType().resolve();
        // Check @JsonProperty override
        var.getAnnotationByName("JsonProperty").ifPresent(ann -> {
            String jsonName = ann.asStringLiteralExpr().asString();
            fieldName = jsonName;
        });
        // Emit placeholder based on resolved type
        String placeholder = PlaceholderFactory.forType(resolvedType);
        ObjectNode target = mapper.createObjectNode();
        target.put(fieldName, placeholder);
    }
}
```

### Record Declaration Walking
```java
// Source: Context7 /javaparser/javaparser — RecordPatternExpr (JavaParser 3.26.0+)
// Records expose getParameters() for constructor components
if (typeDecl.isRecordDeclaration()) {
    RecordDeclaration record = typeDecl.asRecordDeclaration();
    for (Parameter param : record.getParameters()) {
        String paramName = param.getNameAsString();
        ResolvedType paramType = param.getType().resolve();
        String placeholder = PlaceholderFactory.forType(paramType);
        target.put(paramName, placeholder);
    }
}
```

### Cycle Detection Algorithm
```java
// Source: PITFALLS.md C-1 — Locked decision D-09
public class CycleDetector {
    private final Set<String> visited = new HashSet<>();
    private int depth = 0;
    private static final int MAX_DEPTH = 6;

    public JsonNode walk(String fqn) {
        if (visited.contains(fqn)) {
            return mapper.createObjectNode().put("$ref", fqn);
        }
        if (depth >= MAX_DEPTH) {
            return mapper.createObjectNode().put("_cycle_depth_exceeded", true);
        }
        visited.add(fqn);
        depth++;
        try {
            // Walk the DTO fields...
        } finally {
            depth--;
            visited.remove(fqn);
        }
    }
}
```

### HikariCP Desktop Configuration
```java
// Source: Context7 /brettwooldridge/hikaricp — Defaults confirmed in HikariConfig.java
//        PITFALLS m-8 — Desktop overrides required
HikariConfig config = new HikariConfig();
config.setJdbcUrl(url);
config.setUsername(user);
config.setPassword(password);
// Desktop overrides (single user, small pool)
config.setMaximumPoolSize(2);       // Default: 10
config.setMinimumIdle(1);           // Default: -1 (matches max)
config.setConnectionTimeout(10_000); // Default: 30s
config.setIdleTimeout(300_000);      // Default: 10min -> override to 5min
config.setMaxLifetime(900_000);      // Default: 30min -> override to 15min
config.setKeepaliveTime(120_000);    // Default: 2min (keep)
HikariDataSource ds = new HikariDataSource(config);
```

### safeStorage Encrypt/Decrypt (Main Process)
```javascript
// Source: Context7 /websites/electronjs — safeStorage API docs
// Async API recommended per Electron docs (non-blocking)
import { safeStorage } from 'electron';

export async function encryptPassword(plainText) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption not available');
  }
  return safeStorage.encryptStringAsync(plainText); // Promise<Buffer>
}

export async function decryptPassword(encryptedBuffer) {
  const { shouldReEncrypt, result } = await safeStorage.decryptStringAsync(encryptedBuffer);
  if (shouldReEncrypt) {
    // Key rotation occurred — re-encrypt with new key
    const reEncrypted = await safeStorage.encryptStringAsync(result);
    // Store re-encrypted value back
  }
  return result;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| keytar for credential storage (Node native module) | Electron `safeStorage` async API (built-in) | 2022 (keytar archived) | Zero extra deps; works on all 3 OSes; no rebuild pain |
| Field-only DTO walking | Hybrid: getters first (reflect Jackson wire format), fields as fallback, ASM for Lombok | Current best practice | Respects @JsonProperty, @JsonNaming, @Accessors |
| c3p0 / Tomcat JDBC Pool | HikariCP 6.x | ~2018 (industry shift) | Faster, lighter, better-documented for desktop use |
| Synchronous safeStorage.encryptString | safeStorage.encryptStringAsync (Promise-based) | Electron docs recommendation | Non-blocking; doesn't freeze main process |
| Hand-rolled JSON building | Jackson ObjectMapper + ObjectNode API | Standard practice | Handles all JSON edge cases; same lib as Spring projects |

**Deprecated/outdated:**
- **keytar:** Archived 2022-12-15. No Electron 42 prebuilt binaries. Use `safeStorage` instead.
- **sync safeStorage API:** Still available but Electron docs recommend async for non-blocking behavior.
- **c3p0 connection pool:** Effectively unmaintained. HikariCP is the standard replacement.
- **`react-monaco-editor`:** Deprecated wrapper. Use `@monaco-editor/react` (already in Phase 1).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | JavaParser 3.28.1 resolves 100% of DTO types in Spring projects | Standard Stack | MEDIUM — symbol-solver gaps documented in PITFALL C-2; mitigation is ASM fallback + Object placeholder |
| A2 | Lombok field detection via ASM 9.x is sufficient for v1 DTOs | Architecture Patterns | MEDIUM — some Lombok edge cases (@SuperBuilder, @Jacksonized) may require delombok preprocessing |
| A3 | Electron `safeStorage` is available on all target platforms (Win/Mac/Linux) | Standard Stack | LOW — Linux may fall back to `basic_text` storage on non-GNOME/KDE desktops |
| A4 | PostgreSQL jsonb/json columns always return as PGobject with getType() "json"/"jsonb" | Common Pitfalls | LOW — well-documented behavior verified in pgjdbc docs |
| A5 | MySQL Connector/J 9.x GPLv2 license is acceptable for distribution | Standard Stack | MEDIUM — may need to switch to mariadb-java-client (LGPL) if distribution requires it |
| A6 | Phase 2 IPC contract provides resolved DTO FQNs + classpath roots | Architecture Patterns | MEDIUM — Phase 3 depends on Phase 2's DTO resolution; can be developed against test corpus independently |
| A7 | Body editor is always in 'raw' mode with Monaco for JSON editing | Patterns | LOW — confirmed by Phase 1 conventions and D-01 decision |
| A8 | HikariCP 6.x works correctly with Oracle ojdbc11 23.x | Standard Stack | LOW — HikariCP is driver-agnostic and widely tested with Oracle |

## Open Questions

1. **Lombok `@SuperBuilder` and `@Jacksonized` handling**
   - What we know: These are Lombok experimental/complex features. @Jacksonized requires @Builder pairing. ASM can read generated bytecode but may not expose the builder pattern cleanly.
   - What's unclear: Whether these annotations are common enough in Spring DTOs to require v1 support.
   - Recommendation: Document as "v1: best-effort via ASM; v2: add delombok preprocessing."

2. **Oracle JDBC driver Maven repository access**
   - What we know: Oracle JDBC drivers are on Maven Central (since 2020) via `com.oracle.database.jdbc:ojdbc11`. Older versions required Oracle's proprietary repo.
   - What's unclear: Whether all 23.x versions are on Maven Central, and whether there are runtime dependency conflicts with the user's Spring project.
   - Recommendation: Use the Maven Central coordinates confirmed in STACK.md. Test against a real Oracle instance.

3. **MySQL Connector/J GPLv2 license implications**
   - What we know: MySQL Connector/J is GPLv2 with FOSS exception. If PostmanClone is distributed commercially, the license may matter.
   - What's unclear: The distribution model for PostmanClone (free? paid? open source?).
   - Recommendation: Default to MySQL Connector/J per STACK.md. Flag `mariadb-java-client` (LGPL) as a drop-in alternative in the plan.

4. **Linux safeStorage fallback behavior**
   - What we know: On Linux, safeStorage depends on kwallet/gnome-libsecret. If neither is available, it may degrade to `basic_text` (plaintext equivalent).
   - What's unclear: How common this is on developer Linux desktops (Ubuntu, Fedora, Arch).
   - Recommendation: Check `isEncryptionAvailable()` at startup. If false, show a warning banner. Offer an optional passphrase-based encrypted file fallback.

5. **DTO body caching across helper restarts**
   - What we know: Generated body is deterministic (same DTO + same helper = same output). Caching could improve UX when helper restarts.
   - What's unclear: Whether the cache should be in the renderer (Zustand), main process (JSON file), or both.
   - Recommendation: Cache in renderer Zustand store keyed by `dtoFqn`. Invalidate on helper version change. Do not persist to disk (re-generate is cheap).

6. **How DB connection is linked to requests (per-request? per-collection? per-project?)**
   - What we know: User discretion item. Sketch 007-D has the table/row picker adjacent to the body editor.
   - What's unclear: Whether a connection is a global resource or scoped to a collection/project.
   - Recommendation: Recommend per-project scope. A Spring project typically has one primary database. The connection picker is a dropdown in the body editor when DB mode is active.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| JDK 21 | JVM helper compilation + runtime | Needs verification | -- | JDK 17 minimum |
| Gradle 8.x | Building helper fat-jar | Needs verification | -- | Maven 3.9+ |
| Electron 42 | Desktop app shell | Installed (Phase 1) | 42.3.2 | -- |
| Node 24 | Main process runtime | Bundled with Electron | 24.15.0 | -- |
| npm packages | Renderer + main process | Installed (Phase 1) | various | -- |
| JavaParser + symbol-solver | Helper DTO walking | Not yet installed | 3.28.1 | Added to build.gradle.kts |
| HikariCP 6.x | Helper DB pool | Not yet installed | 6.x | Added to build.gradle.kts |
| PostgreSQL JDBC | Helper DB driver | Not yet installed | 42.7.11 | Added to build.gradle.kts |
| MySQL Connector/J | Helper DB driver | Not yet installed | 9.x | Added to build.gradle.kts |
| Oracle ojdbc11 | Helper DB driver | Not yet installed | 23.x | Added to build.gradle.kts |
| H2 Database | Helper DB driver | Not yet installed | 2.3.x | Added to build.gradle.kts |
| ASM 9.x | Helper bytecode reading | Not yet installed | 9.x | Added to build.gradle.kts |

**Missing dependencies with no fallback:**
- Java JDK 21 (or 17 minimum): Required to compile and run the helper JAR. Needs `findJava()` detection as in Phase 1.

**Missing dependencies with fallback:**
- MySQL Connector/J -> mariadb-java-client (LGPL) if license issues arise
- Oracle JDBC -> if Maven Central access fails, add Oracle's Maven repo

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Not applicable to Phase 3 |
| V3 Session Management | No | Not applicable to Phase 3 |
| V4 Access Control | No | Not applicable to Phase 3 |
| V5 Input Validation | Yes | Zod 4.0.1 for all IPC payloads; Jackson for JSON body validation |
| V6 Cryptography | Yes | Electron `safeStorage` (DPAPI/Keychain/libsecret) for DB credentials; no hand-rolled crypto |
| V7 Error Handling | Yes | Never include DB credentials in error messages; structured JSON-RPC error codes |
| V8 Data Protection | Yes | Encrypted DB passwords at rest; never logged; never sent off-device; cleared from memory after use |

### Known Threat Patterns for Java/Electron JDBC Desktop App

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Plaintext password in JSON file | Information Disclosure | `safeStorage.encryptStringAsync()` before write; encrypt per-connection JSON |
| Password in log files | Information Disclosure | Filter passwords from all log statements; sanitize helper stderr before writing `helper.log` |
| SQL injection via user-provided WHERE clause | Tampering | Validate user input; use PreparedStatement; never concatenate WHERE strings |
| Network egress of query results | Information Disclosure | All DB queries run in local JVM helper; no network calls from helper; main process never sends results off-device |
| Credential reuse across helper restarts | Elevation of Privilege | Passwords decrypted only at connect RPC call time; cleared from helper memory after pool creation; never cached in helper |
| JDBC driver classpath injection | Elevation of Privilege | Drivers bundled in helper fat-jar; no dynamic classpath loading |
| XXE via JDBC XML types (Oracle SQLXML) | Tampering | Configure Jackson with `XMLInputFactory` disabling external entities; prefer `getString()` over `getSQLXML()` |
| Memory dump containing credentials | Information Disclosure | Set HikariCP password to empty char array after DataSource creation; avoid storing password in member fields |

## Sources

### Primary (HIGH confidence)

- **Context7 /javaparser/javaparser** — JavaParser + symbol-solver: FieldDeclaration API, ClassOrInterfaceDeclaration API, RecordDeclaration, CombinedTypeSolver setup, type resolution with calculateResolvedType(). Library ID verified via Context7 search (721 snippets, 96K tokens, last update 2026-05-07).
- **Context7 /brettwooldridge/hikaricp** — HikariCP: Default configuration constants (DEFAULT_POOL_SIZE=10, CONNECTION_TIMEOUT=30s, IDLE_TIMEOUT=10min, MAX_LIFETIME=30min, DEFAULT_KEEPALIVE_TIME=2min). Library ID verified via Context7 search (285 snippets, 30K tokens, last update 2026-05-28).
- **Context7 /websites/electronjs** — safeStorage API: encryptStringAsync, decryptStringAsync, isEncryptionAvailable, encryptString (sync). Library ID verified via Context7 search (3,595 snippets, 517K tokens, last update 2026-05-22).
- **Context7 /pgjdbc/pgjdbc** — PostgreSQL JDBC: PGobject API (getType(), getValue()), custom type mapping, geometric type handling, ResultSet.getObject() usage. Library ID verified as official pgjdbc GitHub repo (1,223 snippets, 63K tokens, last update 2026-04-29).
- **STACK.md** — Prescriptive versions: JavaParser 3.28.1, Jackson 2.21.2, HikariCP 6.x, PostgreSQL JDBC 42.7.11, MySQL Connector/J 9.x, Oracle ojdbc11 23.x, H2 2.3.x. All verified via Context7 at research time (2026-06-03).
- **PITFALLS.md** — C-1 (recursive DTO), C-2 (symbol-solver gaps), C-3 (Lombok), C-4 (PostgreSQL jsonb), C-5 (large result sets), C-6 (plaintext credentials), C-9 (Jakarta vs javax).
- **ARCHITECTURE.md** — 3-process architecture, JSON-RPC 2.0 over stdio, main<->helper IPC contract.

### Secondary (MEDIUM confidence)

- **npm registry** — Package existence verified: @monaco-editor/react 4.7.0, react-virtuoso 4.18.7, zustand 5.0.14, @tanstack/react-query 5.101.0, zod 4.4.3 (npm view, 2026-06-05).
- **Existing codebase** — JsonRpcClientImpl (src/main/jvm/client.ts), Supervisor (src/main/jvm/supervisor.ts), IPC router (src/main/ipc/router.ts), BodyTab (src/renderer/components/RequestEditor/BodyTab.tsx), useRequest store (src/renderer/state/useRequest.ts).
- **Sketch findings** — database-integration.md (006-B JDBC URL auto-parse, 007-D right tree + inline rows), request-builder-layout.md (003-A pill bar body modes, 001-A attached method badge).

### Tertiary (LOW confidence — flagged for validation)

- **Oracle JDBC version 23.7.0.25.01:** Version string format is speculative. Verify at build time against Maven Central.
- **MySQL Connector/J 9.1.0:** Exact patch version not verified against Maven Central. Verify at build time.
- **H2 Database 2.3.232:** Exact patch version not verified. Verify at build time.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All core libraries (JavaParser, HikariCP, Jackson, safeStorage) verified via Context7 official docs. Patch versions for MySQL/Oracle/H2 are [ASSUMED] and marked LOW.
- Architecture: HIGH — Patterns follow Phase 1 conventions exactly. IPC flow (Renderer->Main->Helper) is proven. safeStorage pattern from Electron docs.
- Pitfalls: HIGH — All known pitfalls (C-1 through C-9) addressed with specific mitigations rooted in verified documentation.

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (30-day validity; stable domain)
**Phase requirement coverage:** 10/10 requirements (BODY-01..03 + DB-01..07) research-supported.
**Dependency readiness:** Java dependencies need Gradle build.gradle.kts addition. No new npm packages needed.
**Key risk items:**
1. JavaParser symbol-solver coverage on real Spring DTOs (mitigated by ASM fallback + Object placeholder)
2. safeStorage availability on Linux (mitigated by isEncryptionAvailable() check + warning banner)
3. Oracle JDBC Maven Central availability and version compatibility (mitigated by build-time verification)
