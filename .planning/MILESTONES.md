# Milestones

## v2.1 milestone (Shipped: 2026-06-06)

**Phases completed:** 4 phases, 12 plans, 24 tasks

**Key accomplishments:**

- Electron 42 + React 19 + Vite 8 desktop scaffold proving end-to-end IPC chain: renderer → preload → main → undici → response viewer, with JVM helper subprocess over JSON-RPC 2.0 on stdio
- 7-method HTTP client with 5 body modes, 4 auth types, Monaco-based editors, color-coded response viewer, cURL generate+import, 1MB body cap, and keyboard shortcuts — delivering CORE-01, CORE-02, CORE-05, CORE-06, CORE-08
- 22-collection Postman v2.1 round-trip with 4-scope variable resolution, per-request masked auth, per-collection secret-aware history, and 23-fixture CI test passing in <400ms
- Scanner + IPC vertical slice: EndpointScanner detects @RestController/@Controller endpoints via JavaParser AST, full IPC pipeline from renderer through preload to JVM helper with Zod validation and project-cache persistence.
- Controller-grouped endpoint tree in sidebar with colored method badges, expand/collapse, SpringProjectPicker with folder dialog, ScanProgress with indeterminate progress bar, and StatusBar scanner section.
- Click-to-prefill opens new tab with URL, method, headers, path/query params, and body mode. DtoClassPanel shows resolved DTO FQN. Open-time rescan with lastSpringProjectPath persistence.
- DTO schema body generation via JavaParser with cycle detection, type-indicative placeholders, and Generate button in BodyTab toolbar
- DB connection CRUD with encrypted credential storage, HikariCP pool management, JDBC driver bundling, and DbConnectionForm UI with JDBC URL auto-parse
- Row-to-JSON mapper with SQL injection protection, table tree sidebar for browsing, row detail panel, and column-field mapping editor with color-coded type compatibility

---
