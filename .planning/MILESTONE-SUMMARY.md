# Milestone Summary: v2.1

**Completed:** 2026-06-06
**Total Duration:** ~6 hours (12 plans, avg 30min each)
**Requirements Verified:** 34/34 (100%)

## Overview

PostmanClone v2.1 delivers a complete Postman alternative built specifically for Java Spring developers. The app auto-detects Spring project endpoints, generates request bodies from DTO schemas or live database rows, and chains requests with response-to-body field mapping — all in a desktop application with a 3-process architecture.

## What Was Built

### Phase 1: Foundation & Postman Parity (2026-06-04)

Established the 3-process desktop architecture (Electron renderer + Node main + Java 21 helper) and shipped a fully usable Postman alternative covering all CORE requirements. The foundation includes HTTP client (undici 7), Monaco body editor, response viewer, collections with nested folders, 4-scope variables (global/environment/collection/request), per-request auth (Bearer/Basic/API key/none), request history, and Postman v2.1 import/export. The JVM helper supervisor proves reliability with auto-restart and exponential backoff.

### Phase 2: Spring Project Detection (2026-06-06)

Added the ability to point the app at a local Spring project and see all detected `@RestController` / `@Controller` endpoints in the sidebar, grouped by controller. The JVM helper uses JavaParser 3.28.1 with symbol-solver to scan Java source files, supporting Spring Boot 2.7+ and 3.x (Jakarta vs javax). Click-to-prefill builds a complete request with URL, method, headers, and DTO body shape. Scan completes in under 10 seconds for typical projects (~100 controllers, ~500 endpoints) with denylist filtering.

### Phase 3: Body Generation (DTO + DB) (2026-06-06)

Implemented two body generation modes: DTO schema mode (placeholder values matching field types, enums, collections, optionals) and database data mode (real rows from PostgreSQL, MySQL, Oracle, or H2). Features include JavaParser AST walker with Lombok field fallback, cycle detection (Set<FQN> + depth cap 6), HikariCP connection pooling (size 2 for desktop), encrypted credentials via Electron safeStorage, and column→field mapping with type-compatibility indicators.

### Phase 4: Workflow Chains & Response Mapping (2026-06-06)

Completed the "Spring project → live API playground" story with ordered multi-step chains. Users can define chains of N requests, reference earlier responses via JSONata expressions, drag fields between response trees and request bodies, and preview resolved bodies before running. The chain orchestrator executes sequentially with timeout/retry policy per step, and chains persist with collections in Postman v2.1 + `chains` extension format.

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Electron over Tauri | JDBC parity gap (Oracle/H2 not natively supported in Rust); fs:scope friction; larger API-client component ecosystem |
| 3-process architecture | Renderer (Chromium+React) ↔ Main (Node 24) ↔ JVM Helper (Java 21) with JSON-RPC 2.0 on stdio |
| JavaParser over Eclipse JDT | Lighter, easier to embed, well-documented; ASM fallback for Lombok-generated code |
| Jackson 2.21.2 over Jackson 3.x | Spring ecosystem still on Jackson 2.x; avoids mixing major versions |
| JSON files over SQLite | Nested data shapes (chains/steps/mappings) are more natural in JSON; atomic rename for v1 |
| Electron safeStorage for secrets | Built-in DPAPI/Keychain/libsecret; no archived dependencies like keytar |
| JSONata for chain expressions | Purpose-built for JSON transformation; mature client; teachable over custom DSL |

## Performance Metrics

| Metric | Value |
|--------|-------|
| Total plans completed | 12 |
| Average plan duration | 30 minutes |
| Total execution time | 6 hours |
| Requirements coverage | 34/34 (100%) |
| Phase 1 (Foundation) | 3 plans, 90min |
| Phase 2 (Spring Detection) | 3 plans, 95min |
| Phase 3 (Body Generation) | 3 plans, 90min |
| Phase 4 (Workflow Chains) | 3 plans, 90min |
| Scan performance target | <10s for ~500 endpoints |
| Cycle detection depth cap | 6 levels |

## Learnings

- **Annotation FQN string matching** works reliably across Spring Boot versions without requiring Spring on the parser classpath
- **JavaParser + symbol-solver** handles most real-world Spring projects; Lombok field fallback covers the most common gap
- **Atomic JSON writes** (tmp → fsync → rename) are sufficient for v1; SQLite overhead wasn't justified
- **3-process architecture** provides clean separation: renderer holds UI state only, main handles persistence and HTTP, JVM helper handles Java parsing and JDBC
- **Postman v2.1 format** serves as a solid foundation with extension fields for chains

## Deferred Items (to v2)

| Category | Item | Reason |
|----------|------|--------|
| Imports | OpenAPI 3.x spec import | v2 feature; not core MVP |
| Spring | WebFlux (Mono/Flux) support | v2 enhancement |
| Spring | Kotlin controller support | v2 enhancement |
| Spring | File watching for auto-rescan | v2 feature; manual rescan sufficient for v1 |
| Auth | OAuth 2.0 flows | v2 feature; Basic/Bearer/API key cover v1 needs |
| Database | SQL Server support | v2 enhancement |
| Response | Image preview, assertions, SSE | v2 features |
| Code Gen | Typed client generation | v2 feature |
| Mocking | Mock server from endpoints | v2 feature |
| Protocol | GraphQL, gRPC, WebSocket | v2 features |

## Next Steps

v2.1 is complete and ready for user testing. Potential next milestone candidates:

1. **v2.2: Spring Awareness Deepening** — WebFlux, Kotlin, file watching, multi-module Gradle
2. **v2.3: Auth & Database Deepening** — OAuth 2.0, mTLS, SQL Server, advanced pool settings  
3. **v2.4: Response & Code Gen** — Image preview, assertions, typed client generation
4. **v2.5: Protocol Expansion** — GraphQL, gRPC, WebSocket request modes

Recommend gathering user feedback on v2.1 before committing to next milestone scope.