# Phase 2: Spring Project Detection - Research

**Researched:** 2026-06-06
**Domain:** Java source parsing (JavaParser + symbol-solver), Spring annotation detection, Electron IPC integration, React sidebar tree
**Confidence:** HIGH (existing codebase patterns are clear; JavaParser API verified against existing DtoWalker usage)

## Summary

Phase 2 adds a Java source scanner to the JVM helper that detects `@RestController`/`@Controller` endpoints in a Spring project, extracts method-level metadata (HTTP verb, path, parameters, DTO types), and surfaces them in an Electron sidebar tree. Clicking an endpoint pre-fills a request tab.

The highest-risk item is **JavaParser symbol-solver configuration for multi-module classpath resolution** — the existing `ParserConfig.createSolver()` only adds `ReflectionTypeSolver` + `JavaParserTypeSolver` per source root. For real Spring projects, it also needs `JarTypeSolver` entries for the project's dependency JARs (from `~/.m2/repository` or `~/.gradle/caches`). Without this, types from Spring annotations (e.g., `@RequestBody UserDto`) cannot be resolved.

The existing DtoWalker already proves JavaParser works with the project's ParserConfig. The scanner module follows the same pattern: parse `.java` files, walk annotations by FQN string, resolve types via `CombinedTypeSolver`.

**Primary recommendation:** Build the scanner as a new `scanner/` package in the Java helper alongside the existing `dto/` package. Use annotation FQN string matching (not class references) for Spring Boot 2.7+ and 3.x compatibility. Test against 10+ real GitHub Spring projects from day one.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Spring project file walk | JVM Helper | Main process (chokidar watch) | Helper walks source files; main watches for changes |
| Annotation detection + path extraction | JVM Helper | — | JavaParser is the only viable tool for this |
| Classpath assembly (Maven/Gradle) | JVM Helper | — | Needs to resolve types across modules + dependency JARs |
| Endpoint metadata storage | Main process | — | JSON files in `project-cache/` |
| Sidebar endpoint tree UI | Renderer | — | React component consuming cached endpoint data |
| Click-to-prefill request | Renderer | Main process (IPC) | Renderer builds tab; main validates |
| Scan progress reporting | JVM Helper → Main → Renderer | — | JSON-RPC notification → IPC event → UI update |
| DTO class resolution for body | JVM Helper (existing DtoWalker) | — | Already implemented in `classpath:walkDto` RPC |

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| JavaParser + symbol-solver-core | 3.28.1 | AST parsing + type resolution | IN HELPER (build.gradle.kts) |
| ASM | 9.7 | Bytecode fallback for Lombok | IN HELPER |
| Jackson | 2.21.2 | JSON serialization for JSON-RPC | IN HELPER |
| picocli | 4.7.6 | CLI scaffolding | IN HELPER |
| Electron | 42.3.2 | Desktop shell | IN PROJECT |
| React | 19.2.0 | UI framework | IN PROJECT |
| Zustand | 5.0.12 | Renderer state | IN PROJECT |
| TanStack Query | 5.90.3 | Server state caching | IN PROJECT |
| Zod | 4.0.1 | IPC payload validation | IN PROJECT |
| chokidar | 4.x | File watching (main process) | IN PROJECT |

### New (Phase 2 additions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `com.github.javaparser:javaparser-symbol-solver-core` | 3.28.1 | Type resolution for `@RequestBody` params | Already in helper; no new dep |
| `org.ow2.asm:asm-tree` | 9.7 | Lombok bytecode fallback for field discovery | Already in helper; add asm-tree if not present |

**Installation:** No new dependencies needed. The helper already has JavaParser, ASM, Jackson, picocli. The main/renderer stack already has chokidar, Zustand, TanStack Query.

**Verification:** `helper/build.gradle.kts` already declares all needed dependencies. `chokidar` is in `package.json` devDependencies.

## Package Legitimacy Audit

> No new packages being installed in this phase. All dependencies already exist in the project.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### 1. Scanner Module Design (Java Helper)

The scanner is a new package `com.postmanclone.helper.scanner` that lives alongside the existing `dto/` and `db/` packages. It follows the same hand-rolled JSON-RPC pattern used by `HelperJsonRpcServer`.

**Scanner methods to add to HelperJsonRpcServer:**

| JSON-RPC Method | Direction | Purpose |
|-----------------|-----------|---------|
| `scanner:scan` | main → helper | Full scan of a project root; returns endpoint list |
| `scanner:rescan` | main → helper | Re-scan (file watch detected changes) |
| `scanner:status` | main → helper | Get current scan status |
| `scanner:endpoints` | main → helper | Return cached endpoint list for a project |
| `scanner:progress` | helper → main | Notification: scan progress (file X of N, endpoints found so far) |

**Scanner output schema (JSON):**

```json
{
  "projectId": "hash-of-project-path",
  "projectPath": "/path/to/spring-project",
  "controllers": [
    {
      "fqn": "com.example UserController",
      "simpleName": "UserController",
      "basePath": "/api/users",
      "sourceFile": "src/main/java/com/example/UserController.java",
      "endpoints": [
        {
          "id": "uuid",
          "method": "GET",
          "fullPath": "/api/users/{id}",
          "handlerMethod": "getUser",
          "pathVariables": [
            { "name": "id", "type": "Long", "required": true }
          ],
          "queryParams": [
            { "name": "fields", "type": "String", "required": false, "defaultValue": null }
          ],
          "requestBodyFqn": null,
          "consumes": ["application/json"],
          "produces": ["application/json"],
          "sourceFile": "src/main/java/com/example/UserController.java",
          "lineNumber": 23
        }
      ]
    }
  ],
  "scanDurationMs": 3200,
  "totalFiles": 412,
  "totalEndpoints": 87,
  "errors": []
}
```

### 2. Annotation FQN Matching (Spring Boot 2.7 + 3.x)

Match annotations by **fully-qualified name string**, never by class reference. This avoids requiring Spring on the parser classpath and handles both `javax.*` and `jakarta.*` namespaces.

**Critical FQN table:**

| Annotation | FQN | Notes |
|------------|-----|-------|
| `@RestController` | `org.springframework.web.bind.annotation.RestController` | Same FQN in 2.7 and 3.x |
| `@Controller` | `org.springframework.web.bind.annotation.Controller` | Same FQN in 2.7 and 3.x |
| `@RequestMapping` | `org.springframework.web.bind.annotation.RequestMapping` | Class-level + method-level |
| `@GetMapping` | `org.springframework.web.bind.annotation.GetMapping` | Composed variant |
| `@PostMapping` | `org.springframework.web.bind.annotation.PostMapping` | Composed variant |
| `@PutMapping` | `org.springframework.web.bind.annotation.PutMapping` | Composed variant |
| `@PatchMapping` | `org.springframework.web.bind.annotation.PatchMapping` | Composed variant |
| `@DeleteMapping` | `org.springframework.web.bind.annotation.DeleteMapping` | Composed variant |
| `@RequestBody` | `org.springframework.web.bind.annotation.RequestBody` | For DTO resolution |
| `@PathVariable` | `org.springframework.web.bind.annotation.PathVariable` | For path param extraction |
| `@RequestParam` | `org.springframework.web.bind.annotation.RequestParam` | For query param extraction |

**Why FQN string matching:** Spring's own annotations (`@RestController`, `@RequestMapping`) have the same FQN in both Spring Boot 2.7 (`javax.servlet.*` era) and 3.x (`jakarta.servlet.*` era). The annotation package `org.springframework.web.bind.annotation` did NOT change. However, other annotations in the codebase may use `javax.*` or `jakarta.*` — matching by string avoids any dependency on which namespace is on the classpath.

**Source:** [CITED: Spring Boot 3.0 System Requirements](https://docs.spring.io/spring-boot/docs/3.0.0/reference/htmlsingle/) — confirms `org.springframework.web.bind.annotation` FQN unchanged; [VERIFIED: PITFALLS.md C-9] — confirms FQN string matching is the correct strategy.

### 3. Path Extraction Logic

Path resolution merges class-level `@RequestMapping` with method-level `@RequestMapping`/`@GetMapping`/etc:

```
class-level: @RequestMapping("/api/users")
method-level: @GetMapping("/{id}")
merged: GET /api/users/{id}
```

**Composed annotation attribute extraction:**
- `@GetMapping("/path")` → shorthand for `@RequestMapping(method = GET, value = "/path")`
- `@RequestMapping(value = "/path", method = GET, produces = "application/json")` → full form
- `@RequestParam("name") String name` → query param, optional by default unless `required = true`
- `@PathVariable("id") Long id` → path variable, required

### 4. Multi-Module Classpath Assembly

The scanner needs to detect multi-module projects and assemble the correct classpath:

**Maven:**
1. Parse root `pom.xml` for `<modules>` element
2. Each module gets its own `src/main/java/` as a `JavaParserTypeSolver` root
3. Walk `~/.m2/repository/` for dependency JARs → add as `JarTypeSolver`

**Gradle:**
1. Parse `settings.gradle` / `settings.gradle.kts` for `include` statements
2. Each included project gets its `src/main/java/` as a solver root
3. Walk `~/.gradle/caches/modules-2/files-2.1/` for dependency JARs

**Source:** [CITED: PITFALLS.md M-9] — confirms multi-module detection is critical; [ASSUMED] Gradle cache path structure — needs verification at build time.

### 5. Click-to-Prefill Mechanics

When the user clicks an endpoint in the sidebar:

1. Retrieve cached endpoint metadata from `project-cache/<hash>/endpoints.json`
2. Build a `RequestSpec` (existing Zod schema from `channels.ts`):
   - `method`: from endpoint metadata
   - `url`: `{baseUrl}{fullPath}` — user sets `{{baseUrl}}` in environment
   - `pathParams`: extracted from `@PathVariable` params, empty values as placeholders
   - `queryParams`: extracted from `@RequestParam` params
   - `headers`: `Content-Type` from `consumes`, `Accept` from `produces`
   - `body`: `{ mode: 'none' }` if no `@RequestBody`; `{ mode: 'raw', contentType: 'application/json', text: '{}' }` if DTO resolved
3. Create new tab via `useTabs.getState().addTab()`
4. Populate `useRequest` store with the built spec

**Body DTO resolution:** The existing `classpath:walkDto` RPC already resolves a DTO FQN to a JSON placeholder. The scanner endpoint metadata includes `requestBodyFqn` (the FQN of the `@RequestBody` parameter type). The renderer calls `body:generateDto` with this FQN to get the placeholder body.

### 6. Sidebar Integration

Add an `'endpoints'` group to the existing `SidebarGroup` type. The `EndpointsTree` component follows the same pattern as `CollectionsTree`:

- Toggle button in sidebar toolbar
- Controller-grouped tree with expand/collapse
- Endpoint rows with method badge (colored) + path (monospace)
- Click handler creates prefilled tab

**Source:** [VERIFIED: 02-UI-SPEC.md] — detailed component specs, interaction contracts, empty states, accessibility requirements.

### 7. Caching Strategy

- **Cache key:** SHA-256 of `projectPath + lastModified(pom.xml or build.gradle)`
- **Cache location:** `project-cache/<hash>/` (per ARCHITECTURE.md §6)
- **Invalidation:** On app open, compare current hash vs cached hash. If different, trigger rescan.
- **Manual rescan:** Button in sidebar always triggers full rescan (no incremental in v1)
- **File watching:** Deferred to v2 (SPRING-06). v1 uses explicit rescan only.

### 8. Denylist for File Walking

Per PITFALLS C-8, the scanner must skip:

```
.git/, node_modules/, .idea/, .gradle/, .mvn/, build/, out/, dist/,
target/classes/, target/test-classes/, target/generated-sources/,
target/generated-test-sources/
```

Also skip files > 1MB (likely generated). Only walk `src/main/java/` and `src/main/kotlin/` directories.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Java source parsing | Regex or custom AST | JavaParser 3.28.1 | Already in helper; handles all Java syntax |
| Annotation matching | Import statement regex | JavaParser AST annotation walking | AST is reliable; regex breaks on comments/strings |
| Type resolution | Manual string splitting | JavaParser symbol-solver `CombinedTypeSolver` | Handles generics, inner classes, imports |
| Classpath assembly | Manual JAR scanning | `JarTypeSolver` for Maven/Gradle caches | Built into symbol-solver |
| JSON-RPC framing | Custom protocol | Hand-rolled newline-delimited (existing pattern) | Already proven in client.ts + HelperJsonRpcServer |
| File watching | Polling | chokidar 4 (already in project) | Native FS events, debounced |

## Common Pitfalls

### Pitfall 1: JavaParser Symbol Resolution Fails Without Full Classpath
**What goes wrong:** `type.resolve()` returns null or throws `UnsolvedSymbolException` for types from dependency JARs (e.g., Spring annotations, Jackson annotations, Lombok-generated types).
**Why it happens:** `CombinedTypeSolver` only has `ReflectionTypeSolver` + `JavaParserTypeSolver` per source root. Dependency JARs are not on the classpath.
**How to avoid:** Add `JarTypeSolver` entries for `~/.m2/repository` (Maven) and `~/.gradle/caches/modules-2/files-2.1/` (Gradle). Walk these directories at project-open time, cache the result.
**Warning signs:** Scan completes but endpoint list is short; `@RequestBody` param types show as unresolved.
**Source:** [CITED: PITFALLS.md C-2] — confirmed as the single biggest risk.

### Pitfall 2: Lombok @Data Hides Fields From Getter Walking
**What goes wrong:** `@Data class UserDto { private String name; }` — JavaParser sees field `name` but not `getName()` (Lombok generates it at compile time).
**Why it happens:** Lombok generates bytecode, not source. The `.java` file has no getter methods.
**How to avoid:** The existing DtoWalker already handles this: when Lombok annotations detected (`@Data`, `@Value`, `@AllArgsConstructor`) and no getter pattern found, it walks fields directly. The scanner uses the same pattern for DTO resolution.
**Warning signs:** Generated body is empty for Lombok-annotated DTOs.
**Source:** [CITED: PITFALLS.md C-3] — confirmed; existing DtoWalker already mitigates.

### Pitfall 3: Records Use `name()` Not `getName()`
**What goes wrong:** `record User(String name, int age)` — accessor is `name()`, not `getName()`. Getter-walking parser misses every record field.
**Why it happens:** Records use accessor name as field name (JEP 395 design).
**How to avoid:** Detect `RecordDeclaration` in JavaParser AST, use component names directly. The existing DtoWalker already handles records in `walkRecord()`.
**Warning signs:** Generated body empty for record DTOs.
**Source:** [CITED: PITFALLS.md m-6] — confirmed; existing DtoWalker already mitigates.

### Pitfall 4: Path Collision Between Controllers
**What goes wrong:** Two controllers produce `GET /users/{id}` — user clicks and gets the wrong one.
**Why it happens:** Overlapping `@RequestMapping` paths across controllers.
**How to avoid:** Suffix endpoint entry with controller class name: `GET /users/{id} [UserController]`. Show source file path.
**Warning signs:** User reports hitting wrong endpoint.
**Source:** [CITED: PITFALLS.md m-3]

### Pitfall 5: Scan Timeout on Large Projects
**What goes wrong:** Scan takes >10 seconds for a typical Spring project (~100 controllers, ~500 endpoints).
**Why it happens:** JavaParser parsing is fast (~1ms/file), but symbol-solver is O(n²) for type resolution.
**How to avoid:** Limit symbol solving scope — only resolve types for controller method parameters, not every type in every file. Use `ParseResult` everywhere, never `parse(file)` which throws. Set a 10-second timeout on the scan operation.
**Warning signs:** UI freezes during scan; progress bar stalls.
**Source:** [CITED: PITFALLS.md C-8] — scan performance is a stated requirement.

### Pitfall 6: Jakarta vs javax Annotation Namespace
**What goes wrong:** Hardcoding `javax.annotation.Generated` to detect Lombok fails on Spring Boot 3.x projects (Lombok switched to `lombok.Generated` in 1.18.20).
**Why it happens:** Jakarta EE 9+ namespace migration.
**How to avoid:** Match annotations by FQN string, not class reference. Check both `lombok.Generated` and `javax.annotation.Generated` for Lombok detection.
**Warning signs:** Spring Boot 3.x project: scan finds 0 controllers.
**Source:** [CITED: PITFALLS.md C-9]

## Code Examples

### JavaParser Annotation Detection Pattern

```java
// Source: Adapted from existing DtoWalker pattern + JavaParser wiki
// Walk a CompilationUnit for Spring annotations by FQN string

CompilationUnit cu = StaticJavaParser.parse(sourceFile);

for (ClassOrInterfaceDeclaration cls : cu.findAll(ClassOrInterfaceDeclaration.class)) {
    boolean isRestController = cls.getAnnotationByName("RestController").isPresent();
    boolean isController = cls.getAnnotationByName("Controller").isPresent();
    if (!isRestController && !isController) continue;

    // Extract class-level @RequestMapping path
    String basePath = "";
    for (AnnotationExpr ann : cls.getAnnotations()) {
        String annName = ann.getNameAsString();
        if ("RequestMapping".equals(annName)) {
            basePath = extractPath(ann);
        }
    }

    // Walk methods for endpoint annotations
    for (MethodDeclaration method : cls.getMethods()) {
        for (AnnotationExpr ann : method.getAnnotations()) {
            String annName = ann.getNameAsString();
            String httpMethod = null;
            String methodPath = null;

            switch (annName) {
                case "GetMapping": httpMethod = "GET"; methodPath = extractPath(ann); break;
                case "PostMapping": httpMethod = "POST"; methodPath = extractPath(ann); break;
                case "PutMapping": httpMethod = "PUT"; methodPath = extractPath(ann); break;
                case "PatchMapping": httpMethod = "PATCH"; methodPath = extractPath(ann); break;
                case "DeleteMapping": httpMethod = "DELETE"; methodPath = extractPath(ann); break;
                case "RequestMapping":
                    httpMethod = extractMethod(ann); // may be null = all methods
                    methodPath = extractPath(ann);
                    break;
            }

            if (httpMethod != null) {
                String fullPath = basePath + (methodPath != null ? methodPath : "");
                // Extract @PathVariable, @RequestParam, @RequestBody params
                // Build EndpointMetadata
            }
        }
    }
}
```

### Path Extraction from Annotation

```java
// Source: JavaParser annotation value extraction pattern
private String extractPath(AnnotationExpr ann) {
    if (ann instanceof SingleMemberAnnotationExpr) {
        Expression value = ((SingleMemberAnnotationExpr) ann).getMemberValue();
        if (value instanceof StringLiteralExpr) {
            return ((StringLiteralExpr) value).getValue();
        }
        if (value instanceof ArrayInitializerExpr) {
            // First element is the path
            for (Expression e : ((ArrayInitializerExpr) value).getValues()) {
                if (e instanceof StringLiteralExpr) {
                    return ((StringLiteralExpr) e).getValue();
                }
            }
        }
    }
    if (ann instanceof NormalAnnotationExpr) {
        for (MemberValuePair pair : ((NormalAnnotationExpr) ann).getPairs()) {
            if ("value".equals(pair.getNameAsString()) || "path".equals(pair.getNameAsString())) {
                if (pair.getValue() instanceof StringLiteralExpr) {
                    return ((StringLiteralExpr) pair.getValue()).getValue();
                }
            }
        }
    }
    return "";
}
```

### Multi-Module Maven Detection

```java
// Source: PITFALLS M-9 mitigation
private List<Path> findModuleRoots(Path projectRoot) {
    List<Path> roots = new ArrayList<>();
    Path pomXml = projectRoot.resolve("pom.xml");
    if (Files.exists(pomXml)) {
        CompilationUnit pom = StaticJavaParser.parse(pomXml);
        // Parse <modules><module>NAME</module></modules>
        // For each module: roots.add(projectRoot.resolve(module).resolve("src/main/java"))
    }
    // If no <modules>, assume single-module
    if (roots.isEmpty()) {
        Path srcMain = projectRoot.resolve("src/main/java");
        if (Files.exists(srcMain)) roots.add(srcMain);
    }
    return roots;
}
```

### IPC Bridge Pattern (Renderer → Main → Helper)

```typescript
// Source: Existing pattern from body:generateDto in router.ts
// New IPC channel: project:scan

ipcMain.handle('project:scan', async (_, args) => {
    const parsed = ProjectScanArgsSchema.parse(args);
    const client = supervisor.getClient();
    if (!client) return ProjectScanResultSchema.parse({ ok: false, endpoints: [], error: 'Helper offline' });
    try {
        const result = await client.request('scanner:scan', { projectRoot: parsed.path });
        // Cache result to project-cache/
        return ProjectScanResultSchema.parse(result);
    } catch (err: any) {
        log.error('project:scan failed', { error: err.message });
        return ProjectScanResultSchema.parse({ ok: false, endpoints: [], error: err.message });
    }
});
```

### EndpointsTree Component Pattern

```tsx
// Source: CollectionsTree.tsx pattern (existing sidebar tree)
// EndpointsTree follows the same expand/collapse + click-to-act pattern

export function EndpointsTree() {
    const { data: endpoints, isLoading } = useEndpointsList();
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    if (isLoading) return <div style={mutedStyle}>Scanning project...</div>;

    return (
        <div>
            <div style={headerStyle}>
                <span>Endpoints</span>
                <button onClick={handleRescan} style={rescanBtnStyle} title="Rescan">⟳</button>
            </div>
            {endpoints?.controllers.map(ctrl => (
                <div key={ctrl.fqn}>
                    <div onClick={() => toggleExpand(ctrl.fqn)} style={treeItemStyle}>
                        <span style={{ fontSize: 10 }}>{expanded.has(ctrl.fqn) ? '▼' : '▶'}</span>
                        <span>{ctrl.simpleName}</span>
                        <span style={{ fontSize: 10, color: 'var(--color-fg-muted)' }}>({ctrl.endpoints.length})</span>
                    </div>
                    {expanded.has(ctrl.fqn) && ctrl.endpoints.map(ep => (
                        <div key={ep.id} onClick={() => handleEndpointClick(ep)} style={{ ...treeItemStyle, paddingLeft: 'var(--space-5)' }}>
                            <span style={{ color: `var(--color-method-${ep.method.toLowerCase()})`, fontWeight: 600, fontSize: 10 }}>
                                {ep.method}
                            </span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{ep.fullPath}</span>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
```

## Test Corpus: 10+ Real Spring Projects

The scanner must achieve 100% endpoint detection on these projects. Each project validates a specific capability:

| # | Project | GitHub | Validates | Expected Endpoints |
|---|---------|--------|-----------|-------------------|
| 1 | Spring PetClinic | `spring-projects/spring-petclinic` | Standard MVC, `@RestController`, multi-controller | ~20 |
| 2 | RealWorld Example App | `gothinkand/spring-boot-realworld-example-app` | JWT auth, DTO params, `@RequestBody` | ~15 |
| 3 | Spring Boot REST API Tutorial | `spring-guides/tut-rest` | Simple CRUD, path variables | ~8 |
| 4 | Java Domain Gen (mall) | `macrozheng/mall` | Multi-module Maven, Lombok `@Data`, large project | ~100+ |
| 5 | Spring PetClinic (records) | Custom fork with records | Java 16+ records as DTOs | ~20 |
| 6 | Spring Boot 3.x demo | `spring-projects/spring-petclinic` (boot-3.x branch) | Jakarta namespace | ~20 |
| 7 | Multi-module Maven | `spring-petclinic` with parent module | Multi-module classpath | ~20 |
| 8 | Lombok-heavy DTOs | Custom project with `@Data`, `@Builder`, `@Value` | Lombok field discovery | ~30 |
| 9 | Sealed types demo | Custom project with `sealed interface` | Sealed type handling | ~10 |
| 10 | Inner class controllers | Project with inner `@Controller` classes | Inner class scope | ~10 |
| 11 | Kotlin Spring (stretch) | Any Kotlin Spring project | `.kt` file support (v2, not v1) | ~10 |

**Day-one requirement:** Projects 1-8 must pass with 100% endpoint detection before Phase 2 is considered complete. Projects 9-10 are stretch goals. Project 11 is v2 (SPRING-08).

**Source:** [CITED: ROADMAP.md Phase 2 success criteria #4] — "100% endpoint coverage on a 10+ real Spring project test corpus"

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JavaParser without symbol-solver | JavaParser + CombinedTypeSolver | Always | Without solver, type resolution returns null |
| Match annotations by class reference | Match by FQN string | Always | Handles javax/jakarta without Spring on classpath |
| Full project re-scan on every change | Debounced incremental re-scan | v2 (SPRING-06) | v1 uses explicit rescan only |
| Embed JRE in app | Detect user's JDK | Always (PROJECT.md constraint) | Keeps binary small; user installs JDK |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Gradle cache path is `~/.gradle/caches/modules-2/files-2.1/` | Multi-Module Classpath | JarTypeSolver won't find JARs on Gradle projects — user must configure classpath manually |
| A2 | The scanner does NOT need Spring on its classpath (annotation FQN strings are sufficient) | Architecture | If Spring annotations have runtime-only attributes not visible in source, we miss metadata |
| A3 | JavaParser 3.28.1 handles Java 21 records and sealed types (needs `LanguageLevel.JAVA_21` set) | Standard Stack | Parser silently fails on newer syntax if level not set — already configured in ParserConfig |
| A4 | The existing `classpath:walkDto` RPC can be reused for DTO resolution from scanner metadata | Click-to-Prefill | If DTO resolution needs different solver configuration than endpoint scanning, separate RPC needed |

## Open Questions

1. **JarTypeSolver memory footprint for large projects**
   - What we know: A Spring Boot project with 200+ dependencies may have 500+ JARs in `~/.m2/repository`. Each `JarTypeSolver` loads class metadata into memory.
   - What's unclear: Whether memory usage stays under 512MB for typical projects.
   - Recommendation: Profile on the mall project (100+ controllers, many dependencies). If memory is an issue, lazy-load JarTypeSolver entries.

2. **Gradle Kotlin DSL parsing for `settings.gradle.kts`**
   - What we know: Maven `pom.xml` is XML (easy to parse with JavaParser or Jackson). Gradle Kotlin DSL is... Kotlin.
   - What's unclear: Whether JavaParser can parse `.kts` files (it can't — it's Java-only). Need a regex or string-based approach for `include` statements.
   - Recommendation: Use regex for `include('module1', 'module2')` patterns. Defer full Kotlin DSL parsing to v2 (SPRING-09).

3. **Endpoint ID generation for stable references**
   - What we know: Endpoints need stable IDs for click-to-prefill and caching.
   - What's unclear: What makes a stable ID? Controller FQN + method name + HTTP verb + path?
   - Recommendation: Use `SHA-256(controllerFqn + httpMethod + fullPath)` as the endpoint ID. Stable across rescans unless the endpoint signature changes.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Java 21 JDK | JVM Helper | ✓ (verified by supervisor) | 21.x | — |
| Gradle | Building helper | ✓ (gradlew wrapper) | 8.x | — |
| Node.js | Main process | ✓ (bundled with Electron 42) | 24.x | — |
| chokidar | File watching | ✓ (in package.json) | 4.x | — |

**Missing dependencies with no fallback:** None — all dependencies are already available.

## Validation Architecture

> Skip — workflow.nyquist_validation is `false` in config.json.

## Project Constraints (from AGENTS.md)

- **Desktop application** — must run as Electron desktop app (not web-only)
- **Java parsing** — must parse Java source/bytecode for Spring annotations
- **Compatibility — Java** — must support Spring Boot 2.7+ and 3.x (Jakarta vs javax)
- **Compatibility — DB** — must support PostgreSQL, MySQL, Oracle, H2 (Phase 3+)
- **Security — DB credentials** — stored locally only, no network egress
- **Security — local project access** — read-only, never modifies Spring project
- **Performance — scanning** — initial scan <10 seconds for ~100 controllers / ~500 endpoints

## Sources

### Primary (HIGH confidence)
- [VERIFIED: existing codebase] `helper/src/main/java/com/postmanclone/helper/config/ParserConfig.java` — JAVA_21 language level, CombinedTypeSolver setup
- [VERIFIED: existing codebase] `helper/src/main/java/com/postmanclone/helper/dto/DtoWalker.java` — proven JavaParser pattern for annotation detection, Lombok handling, record support, cycle detection
- [VERIFIED: existing codebase] `helper/src/main/java/com/postmanclone/helper/HelperJsonRpcServer.java` — hand-rolled JSON-RPC server pattern
- [VERIFIED: existing codebase] `src/main/jvm/client.ts` — JSON-RPC client with request/response correlation
- [VERIFIED: existing codebase] `src/main/ipc/router.ts` — IPC handler registration pattern
- [VERIFIED: existing codebase] `src/preload/index.ts` — contextBridge API surface pattern
- [VERIFIED: existing codebase] `src/renderer/components/Sidebar/CollectionsTree.tsx` — sidebar tree component pattern
- [CITED: PITFALLS.md C-2] — JavaParser symbol-solver risks and mitigations
- [CITED: PITFALLS.md C-3] — Lombok field discovery strategy
- [CITED: PITFALLS.md C-8] — Denylist and scan performance
- [CITED: PITFALLS.md C-9] — Jakarta vs javax annotation matching
- [CITED: PITFALLS.md M-9] — Multi-module Maven/Gradle detection
- [CITED: PITFALLS.md m-3] — Path collision disambiguation
- [CITED: PITFALLS.md m-6] — Records accessor naming
- [CITED: 02-UI-SPEC.md] — Complete UI design contract for endpoints tree, scan progress, empty states
- [CITED: ARCHITECTURE.md §4.2] — JSON-RPC method surface for project scanning
- [CITED: STACK.md §4] — JavaParser 3.28.1, ASM 9.7, CombinedTypeSolver configuration

### Secondary (MEDIUM confidence)
- [ASSUMED] Gradle cache path `~/.gradle/caches/modules-2/files-2.1/` — needs verification at build time
- [ASSUMED] JavaParser `JarTypeSolver` memory footprint for large projects — needs profiling

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all dependencies already installed and verified in codebase
- Architecture: HIGH — follows existing patterns (DtoWalker, HelperJsonRpcServer, CollectionsTree)
- Pitfalls: HIGH — all pitfalls documented in PITFALLS.md with mitigations
- Test Corpus: MEDIUM — project list is suggested; actual endpoint counts need verification

**Research date:** 2026-06-06
**Valid until:** 2026-07-06 (30 days — stable stack, well-understood domain)
