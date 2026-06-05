# Phase 3: Body Generation (DTO + DB) - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers two body generation modes for endpoints detected in Phase 2:

1. **DTO Schema Mode** (BODY-01..03): The JVM helper walks DTO class fields (via JavaParser + ASM for Lombok) and produces a JSON body with type-indicative placeholder values matching the DTO shape. Handles records, enums, collections, Optional, nested classes, recursive types (cycle detection via `$ref` markers, depth cap 6).

2. **DB Data Mode** (DB-01..07): Connect to PostgreSQL/MySQL/Oracle/H2 databases with credentials encrypted via Electron `safeStorage`. Browse tables/rows, pick a row, and the helper produces a JSON body from that row shaped to match the endpoint's DTO schema. User can override column→field mappings with color-coded type-compatibility indicators.

Both modes build on Phase 2's endpoint and DTO detection — the Java helper already resolves DTO classes for body-bearing endpoints.

**Carrying forward from Phase 1:**
- Stack: Electron 42.3.2 + React 19.2.0 + Vite 8 + TypeScript 5.6+ + Zustand 5 + TanStack Query 5 + Zod 4 + undici 7 + Monaco + Java 21 LTS + jsonrpc4j 1.6 + safeStorage (NOT keytar) + HikariCP 6 (pool size 2 for desktop)
- 3-process architecture: Renderer ↔ Main (Pattern 2 invoke/handle + Zod) ↔ JVM Helper (JSON-RPC 2.0 stdio, long-lived)
- Storage: JSON files in `app.getPath('userData')`, atomic writes, secrets via `safeStorage`
- Theme: Dark (#1a1b1e background, #25262b surface, #373a40 borders). System sans-serif (Inter) + JetBrains Mono. Compact spacing (4/6/10/14px scale)
- UI patterns from Phase 1: Vertical tab strip (002-C), pill bar body modes (003-A), attached method badge URL bar (001-A), Monaco editor for JSON body
- Sketch findings: JDBC URL auto-parse pattern (006-B), right-side tree for table/row picker (007-D), click-to-copy expressions

</domain>

<decisions>
## Implementation Decisions

### DTO Body Generation UX (discussed 2026-06-05)

- **D-01:** **"Generate" button in body editor toolbar.** When a DTO is detected for the current endpoint (resolved in Phase 2), a "Generate" button appears in the body editor toolbar. The current body mode auto-switches to raw-JSON. Replicates Postman's "Generate from example" pattern.
- **D-02:** **Overwrite current body on generate.** Generated JSON replaces whatever is in the body editor. The dirty indicator turns on (`isDirty: true`) so the user can Ctrl+Z to undo or Ctrl+S to save. No preview/diff step.
- **D-03:** **Dropdown for multiple subtypes.** When a controller endpoint's `@RequestBody` accepts an abstract base class with concrete subtypes (polymorphism), a small dropdown appears next to the Generate button listing detected subtype names (e.g., "CreateUserDTO" / "UpdateUserDTO"). User picks one, then generates. Defaults to the first detected subtype.
- **D-04:** **Record/Lombok constructor tracing for placeholder generation.** For Java records (all-args constructor) and Lombok `@Value`/`@AllArgsConstructor` types, walk the constructor parameters and map parameter names to JSON fields. The output JSON shape is identical to field-based generation — only the Java-side resolution path differs.
- **D-05:** **Type-indicative placeholder values with angle brackets.** Each field shows its Java type as a placeholder value:
  - `String` → `"<string>"`
  - `int`/`long`/`Integer`/`Long`/`BigDecimal` → `"<number>"`
  - `boolean`/`Boolean` → `"<boolean>"`
  - `UUID` → `"<uuid>"`
  - `LocalDate` → `"<date>"`, `LocalDateTime` / `Instant` → `"<datetime>"`
  - Nested objects → `{ ... }` with their own placeholders
  - Angle brackets make it obvious these are placeholders, not real values.
- **D-06:** **Enum fields generate with first value + comment listing all options.** The JSON output uses the first enum constant as the value and includes a comment showing all valid values. Example: `"status": "ACTIVE" // valid: ACTIVE, INACTIVE, SUSPENDED`. The comment is display-only in Monaco (stripped before send).
- **D-07:** **Optional<T> fields included with type placeholder.** All Optional fields appear in the generated body with their type placeholder (e.g., `"description": "<string>"`). Fields are NOT omitted or set to null — the user needs to discover them. Required vs. optional distinction can be indicated visually (e.g., optional fields get a faint "optional" badge).
- **D-08:** **Collections show one sample element.** `List<T>` → `["<t-value>"]`, `Set<T>` → `["<t-value>"]`, `Map<K,V>` → `{"<key>": "<value>"}`. One item shows the type and structure; the user can add more.

### Recursive DTO Handling (decided in ROADMAP — locked)

- **D-09:** **Cycle detection via `$ref` markers, depth cap 6.** Bidirectional `@OneToMany`/`@ManyToOne` cycles emit `{ "$ref": "ClassName" }` with a visible warning in the body editor. Walker tracks visited FQNs in a `Set<String>`; on revisit, emits `$ref`. Depth counter caps at 6; beyond that, truncate with `"_cycle_depth_exceeded": true`.

### Body Preprocessing Before Send

- **D-10:** **Strip JSON comments before HTTP send.** Enum comments (D-06) and any other display-only annotations are removed when the user sends the request. The body in the editor keeps comments for readability; the sent body is clean JSON.

### the agent's Discretion

The following were identified as gray areas but not discussed — the planner and researcher have flexibility:

- **DB connection management UX:** Where connections are created/managed (settings page vs. panel off request editor vs. global sidebar section). How a connection is linked to a request (per-request dropdown, per-collection). Reference sketch 006-B (JDBC URL auto-parse with parsed grid) as starting point.
- **Column→field mapping editor:** Exact UI design for the mapping table (dropdowns per column? Auto-map by name similarity as default?). How the required-field coverage badge is visualized. How green/yellow/red type-compatibility is rendered. Reference sketch 007-D.
- **DB connection lifecycle:** When connections are opened/closed. Per-request vs. persistent pool. Connection naming. Test-connection button behavior.
- **Helper-offline degraded mode:** How body generation UI behaves when helper is offline (disabled button with tooltip, or button absent). DB features are fully unavailable without helper; DTO schema mode may be cacheable in renderer.
- **Row picker UX:** How "by id", "by custom WHERE", and "first N rows" options are presented. Reference sketch 007-D (tree sidebar with inline rows).
- **Per-driver type normalizer scope:** Exactly which JDBC column types map to which JSON types per driver (PostgreSQL `jsonb`→PGobject, MySQL `JSON`→String, Oracle `JSON`→CLOB, H2 String). This is implementation detail but affects the shape of generated JSON.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context

- `.planning/PROJECT.md` — Core Value, Active requirements (BODY-01..03, DB-01..07), Constraints (DB drivers, read-only project access)
- `.planning/REQUIREMENTS.md` — Full requirement definitions + Traceability table (Phase 3 rows)
- `.planning/ROADMAP.md` § Phase 3 — Success criteria (5 items), dependency on Phase 2, plan outline (03-01..03)
- `.planning/STATE.md` — Current position, accumulated decisions, Phase 3 risk assessment (MEDIUM-HIGH: JDBC JSON column quirks, Oracle repo, MySQL license)
- `.planning/phases/01-foundation-postman-parity/01-CONTEXT.md` — Phase 1 decisions: 3-process IPC, storage layout, theme, keyboard shortcuts, body editor conventions (D-12..D-15)

### Research docs (stack + architecture)

- `.planning/research/STACK.md` — Prescriptive stack with versions: JavaParser 3.28.1 + symbol-solver-core, ASM 9.x (Lombok fallback), HikariCP 6, jsonrpc4j 1.6, Jackson 2.21.2, PostgreSQL JDBC 42.7.11, MySQL Connector/J 9.x, Oracle ojdbc11 23.x, H2 2.3.x
- `.planning/research/ARCHITECTURE.md` §4 — Main ↔ Helper IPC contract (JSON-RPC 2.0 stdio, newline-framed)
- `.planning/research/PITFALLS.md` — C-1 (recursive DTO crash), C-2 (JavaParser symbol-solver gaps), C-3 (Lombok field detection), C-4 (PostgreSQL jsonb normalization), C-6 (plaintext DB creds), C-9 (Jakarta vs javax)
- `.planning/research/FEATURES.md` — v1/v2 split, BODY and DB feature boundaries

### Sketch findings (UI direction)

- `.opencode/skills/sketch-findings-postman-clone/SKILL.md` — Design direction: dark palette, method colors, compact spacing, monospace fonts
- `.opencode/skills/sketch-findings-postman-clone/references/database-integration.md` — DB connection: JDBC URL auto-parse (006-B), table/row picker: right tree + inline rows (007-D)
- `.opencode/skills/sketch-findings-postman-clone/references/request-builder-layout.md` — URL bar with attached badge (001-A), vertical tab strip (002-C), pill bar body modes (003-A)

### Existing code (Phase 1 patterns)

- `src/main/jvm/client.ts` — JSON-RPC 2.0 client (newline-framed stdio, `request`/`notify`/`on` API)
- `src/main/jvm/supervisor.ts` — Helper lifecycle (spawn, restart with backoff, status emission)
- `src/main/ipc/channels.ts` — Zod schemas for all IPC payloads (pattern for Phase 3 additions)
- `src/main/ipc/router.ts` — IPC handler registration pattern

### Key constraints to respect

- **safeStorage (async API):** `.planning/research/STACK.md` §3 + https://www.electronjs.org/docs/latest/api/safe-storage — DB credentials must use this, NOT plaintext, NOT keytar (archived)
- **HikariCP pool size:** Maximum 2, minimumIdle 1, connectionTimeout 10s, idleTimeout 5min, maxLifetime 15min (per `.planning/research/STACK.md` §4, PITFALLS m-8)
- **Read-only Spring project access:** Helper must never write to the Spring project directory
- **No DB credential egress:** Never log, never send off-device, never include in error messages

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`JsonRpcClientImpl`** (`src/main/jvm/client.ts`): The JSON-RPC 2.0 over stdio client. Phase 3 extends this with new methods (`classpath:walkDto`, `db:connect`, `db:listTables`, `db:fetchRows`, `db:fetchRowToJson`). The `request(method, params)` API is already proven.
- **`Supervisor`** (`src/main/jvm/supervisor.ts`): Helper lifecycle management. Phase 3 adds DB connection state tracking (active connections, pool health) to the `HelperStatus` schema. The singleton `supervisor` export can be used to relay DB operations.
- **`RequestSpecSchema`** (`src/main/ipc/channels.ts`): The Zod-validated request schema. Phase 3 extends the body discriminator with a `generated` flag or metadata field to track whether the body was DTO/DB-generated.
- **Monaco editor** (already integrated in renderer): The body editor already supports JSON with syntax highlighting. Phase 3 adds inline comment display (for enum hints) and strip-on-send preprocessing.
- **Dark theme CSS variables** (from Phase 1): `--color-primary` (#f08c00), `--color-border` (#373a40), method colors, monospace font tokens. All Phase 3 UI uses these existing tokens.

### Established Patterns

- **IPC handler registration** (`src/main/ipc/router.ts`): New channels follow `<domain>:<verb>` naming (e.g., `body:generateDto`, `db:connect`, `db:fetchRows`). All payloads Zod-validated at both handler and renderer boundaries.
- **Zustand + TanStack Query** (renderer state): Cross-tab UI state via Zustand stores; server-state (collections, envs) via TanStack Query. Phase 3 adds a `useDbConnections` query and a `useDtoBody` query (or mutation) for generated bodies.
- **`safeStorage` encryption** (Phase 1 Pattern): Passwords encrypted before storage, decrypted only at use-time. Phase 3 follows the same pattern for JDBC credentials. The `safeStorage` API is async — callers must await.

### Integration Points

- **Body editor** — The "Generate" button (D-01) lives in the body editor toolbar. This requires adding a new action to the existing body editor component. The dropdown for multiple DTOs (D-03) is a sibling control.
- **IPC router** — New channels register in the existing router. The renderer calls `ipcRenderer.invoke('body:generateDto', { requestId })` → main → helper. Response flows back through the same path.
- **Helper status bar** — Phase 3 adds DB connection status indicators (e.g., "🟢 PostgreSQL connected" / "🔴 Helper offline"). Extends the existing `HelperStatus` discriminated union.
- **Request editor tabs** — The "Generate" button is contextual (visible only when a DTO is detected). The request editor must know whether the current endpoint has a resolved DTO class (from Phase 2 data).

</code_context>

<specifics>
## Specific Ideas

- **DTO generation is a helper RPC call.** The renderer never walks DTOs itself — it sends a `classpath:walkDto` RPC to the helper with the DTO FQN. The helper returns the JSON body as a string. This keeps the renderer thin and the symbol resolution in the JVM where JavaParser lives.
- **Generated body is deterministic.** For the same DTO class + same helper version, the output JSON is identical. This enables caching: if the user generates a body, sends a request, and comes back later, regenerating produces the same shape (placeholders), not a different random output.
- **DB connections are per-project, not per-request.** A user connects once to a project's database; all requests against that project can use the same connection. Connections are named (e.g., "MyApp Dev DB") and stored in `db-connections/<id>.json` with encrypted passwords.
- **Row→JSON mapping respects the DTO shape, not the DB schema.** The helper first walks the DTO to get the expected shape, then maps DB columns to those fields. If the DB row has extra columns (e.g., `created_at`, `updated_at`), they are excluded from the output JSON unless the DTO has matching fields.
- **Column→field name matching is case-insensitive by default.** `user_name` ↔ `userName` (snake_case → camelCase) auto-maps. Explicit overrides take precedence. Unmatched required DTO fields trigger the coverage warning.
- **Phase 2 dependency is real but parallelizable.** 03-01 (DTO schema walker) can be developed against a test corpus independently — it doesn't need the real Phase 2 scanner, just a DTO FQN+classpath. 03-02 (DB) and 03-03 (UI) depend on Phase 2 IPC contract for endpoint metadata.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. All identified gray areas not discussed are captured under "the agent's Discretion" above.

</deferred>

---

*Phase: 3-Body Generation (DTO + DB)*
*Context gathered: 2026-06-05 via /gsd-discuss-phase (1 area discussed: DTO body generation UX)*
