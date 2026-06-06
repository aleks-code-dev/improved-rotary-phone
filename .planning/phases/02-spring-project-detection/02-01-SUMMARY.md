---
phase: 02-spring-project-detection
plan: 01
subsystem: helper + ipc
tags: [jvm, scanner, java, ipc, zod]
dependency_graph:
  requires: [01-01, 01-02, 01-03]
  provides: [SPRING-01, SPRING-02, SPRING-03]
  affects: [src/main/ipc, helper/src/main/java, src/preload]
tech_stack:
  added: []
  patterns: [java-parser, json-rpc, zod-validation, atomic-write]
key_files:
  created:
    - helper/src/main/java/com/postmanclone/helper/scanner/EndpointScanner.java
    - helper/src/main/java/com/postmanclone/helper/scanner/ClasspathResolver.java
    - helper/src/main/java/com/postmanclone/helper/scanner/MavenModuleDetector.java
    - helper/src/main/java/com/postmanclone/helper/scanner/GradleModuleDetector.java
    - helper/src/main/java/com/postmanclone/helper/scanner/Denylist.java
    - src/main/storage/project-cache.ts
  modified:
    - helper/src/main/java/com/postmanclone/helper/HelperJsonRpcServer.java
    - src/main/ipc/channels.ts
    - src/main/ipc/router.ts
    - src/main/storage/paths.ts
    - src/preload/index.ts
    - src/preload/index.d.ts
decisions:
  - "Annotation FQN string matching for Spring Boot 2.7+ and 3.x compatibility"
  - "SHA-256 endpoint IDs for stable references across rescans"
  - "Denylist skips build artifacts, IDE directories, and files > 1MB"
metrics:
  duration: 45min
  completed: "2026-06-06T19:45:00Z"
  tasks: 2
  files_created: 6
  files_modified: 6
---

# Phase 2 Plan 01: JVM Helper Scanner Module + IPC Pipeline Summary

**Scanner + IPC vertical slice: EndpointScanner detects @RestController/@Controller endpoints via JavaParser AST, full IPC pipeline from renderer through preload to JVM helper with Zod validation and project-cache persistence.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Java var parameter restriction**
- **Found during:** Task 1
- **Issue:** Java does not allow `var` in method parameters (only local variables)
- **Fix:** Changed `var param` to explicit `com.github.javaparser.ast.body.Parameter param` type
- **Files modified:** EndpointScanner.java
- **Commit:** f841803

**2. [Rule 2 - Missing critical] Added missing ObjectNode import**
- **Found during:** Task 1
- **Issue:** HelperJsonRpcServer.java needed `import com.fasterxml.jackson.databind.node.ObjectNode` for scanner result type
- **Fix:** Added import statement
- **Files modified:** HelperJsonRpcServer.java
- **Commit:** f841803

**3. [Rule 2 - Missing critical] Added missing history.append type**
- **Found during:** Task 2
- **Issue:** preload/index.ts WindowApi interface was missing `append` method for history namespace
- **Fix:** Added `append` method signature to inline WindowApi interface
- **Files modified:** preload/index.ts
- **Commit:** 24f2cad

## Auth Gates

None - all operations are local file access and IPC.

## Known Stubs

- ClasspathResolver walks Maven/Gradle cache dirs but does not yet add JARs to JarTypeSolver (commented out for safety — requires JarTypeSolver implementation)
- EndpointsTree click-to-prefill is a stub in 02-01; fully implemented in 02-03

## Threat Flags

None - all new code follows read-only access pattern for Spring projects.

## Self-Check: PASSED

All 6 created files verified present. All 6 modified files verified. Java helper compiles successfully. TypeScript compiles with only pre-existing errors.
