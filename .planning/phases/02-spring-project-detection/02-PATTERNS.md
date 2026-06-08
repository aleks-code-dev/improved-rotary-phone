# Phase 2: Spring Project Detection - Pattern Map

**Mapped:** 2026-06-06
**Files analyzed:** 12 (8 new, 4 modified)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `helper/src/main/java/com/postmanclone/helper/scanner/EndpointScanner.java` | service | transform | `helper/src/main/java/com/postmanclone/helper/dto/DtoWalker.java` | exact |
| `helper/src/main/java/com/postmanclone/helper/scanner/ClasspathResolver.java` | service | transform | `helper/src/main/java/com/postmanclone/helper/config/ParserConfig.java` | role-match |
| `helper/src/main/java/com/postmanclone/helper/scanner/MavenModuleDetector.java` | utility | file-I/O | `helper/src/main/java/com/postmanclone/helper/config/ParserConfig.java` | role-match |
| `helper/src/main/java/com/postmanclone/helper/scanner/GradleModuleDetector.java` | utility | file-I/O | `helper/src/main/java/com/postmanclone/helper/config/ParserConfig.java` | role-match |
| `src/main/ipc/projectScanner.ts` | controller | request-response | `src/main/ipc/router.ts` | exact |
| `src/preload/index.ts` (modify) | provider | request-response | `src/preload/index.ts` (existing) | exact |
| `src/main/ipc/channels.ts` (modify) | config | transform | `src/main/ipc/channels.ts` (existing) | exact |
| `src/renderer/components/Sidebar/EndpointsTree.tsx` | component | request-response | `src/renderer/components/Sidebar/CollectionsTree.tsx` | exact |
| `src/renderer/store/endpoints.ts` | store | event-driven | `src/renderer/store/collections.ts` | role-match |
| `src/renderer/hooks/useEndpoints.ts` | hook | request-response | `src/renderer/hooks/useCollections.ts` | role-match |
| `src/main/storage/project-cache.ts` | service | file-I/O | `src/main/storage/collections.ts` | role-match |
| `src/renderer/components/StatusBar.tsx` (modify) | component | request-response | `src/renderer/components/StatusBar.tsx` (existing) | exact |

## Pattern Assignments

### `helper/src/main/java/com/postmanclone/helper/scanner/EndpointScanner.java` (service, transform)

**Analog:** `helper/src/main/java/com/postmanclone/helper/dto/DtoWalker.java`

**Imports pattern** (lines 1-26):
```java
package com.postmanclone.helper.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.github.javaparser.ParserConfiguration;
import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.FieldDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.body.Parameter;
import com.github.javaparser.ast.body.RecordDeclaration;
import com.github.javaparser.ast.body.TypeDeclaration;
import com.github.javaparser.ast.body.VariableDeclarator;
import com.github.javaparser.ast.type.Type;
import com.github.javaparser.resolution.types.ResolvedType;
import com.github.javaparser.symbolsolver.resolution.typesolvers.CombinedTypeSolver;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
```

**Core pattern** (lines 28-37, 44-89):
```java
public class DtoWalker {
    private final CombinedTypeSolver solver;
    private final CycleDetector cycleDetector;
    private final ObjectMapper mapper;

    public DtoWalker(CombinedTypeSolver solver) {
        this.solver = solver;
        this.cycleDetector = new CycleDetector();
        this.mapper = new ObjectMapper();
    }

    // Parse file, walk annotations, extract metadata
    private ObjectNode walkType(String fqn, List<Path> classpathRoots) throws IOException {
        // ... find source file, parse with StaticJavaParser.parse(sourceFile)
        CompilationUnit cu = StaticJavaParser.parse(sourceFile);
        Optional<TypeDeclaration> typeOpt = cu.findFirst(TypeDeclaration.class,
            t -> t.getNameAsString().equals(shortName(fqn)));
        // ... walk class/record/enum based on type
    }
}
```

**Key pattern for EndpointScanner:** Use same CombinedTypeSolver injection, same StaticJavaParser.parse() pattern, but walk `@RestController`/`@Controller` annotations instead of DTO fields. Match annotations by simple name string (`"RestController"`, `"RequestMapping"`) not by class reference.

**Annotation FQN matching** (from RESEARCH.md lines 126-141):
```java
// Match by annotation simple name, not class reference
boolean isRestController = cls.getAnnotationByName("RestController").isPresent();
boolean isController = cls.getAnnotationByName("Controller").isPresent();

// For method-level mappings
switch (annName) {
    case "GetMapping": httpMethod = "GET"; methodPath = extractPath(ann); break;
    case "PostMapping": httpMethod = "POST"; methodPath = extractPath(ann); break;
    // ... etc
}
```

---

### `helper/src/main/java/com/postmanclone/helper/scanner/ClasspathResolver.java` (service, transform)

**Analog:** `helper/src/main/java/com/postmanclone/helper/config/ParserConfig.java`

**Imports pattern** (lines 1-11):
```java
package com.postmanclone.helper.config;

import com.github.javaparser.ParserConfiguration;
import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.symbolsolver.JavaSymbolSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.CombinedTypeSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.JavaParserTypeSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.ReflectionTypeSolver;

import java.nio.file.Path;
import java.util.List;
```

**Core pattern** (lines 13-21):
```java
public class ParserConfig {
    public static CombinedTypeSolver createSolver(List<Path> sourceRoots) {
        CombinedTypeSolver solver = new CombinedTypeSolver();
        solver.add(new ReflectionTypeSolver());
        for (Path root : sourceRoots) {
            solver.add(new JavaParserTypeSolver(root));
        }
        return solver;
    }
}
```

**Extension pattern for ClasspathResolver:** Add `JarTypeSolver` entries for Maven/Gradle dependency caches:
```java
public class ClasspathResolver {
    public static CombinedTypeSolver createSolver(List<Path> sourceRoots, Path projectRoot) {
        CombinedTypeSolver solver = new CombinedTypeSolver();
        solver.add(new ReflectionTypeSolver());
        for (Path root : sourceRoots) {
            solver.add(new JavaParserTypeSolver(root));
        }
        // Add JarTypeSolver for dependency JARs
        // Walk ~/.m2/repository/ for Maven
        // Walk ~/.gradle/caches/modules-2/files-2.1/ for Gradle
        return solver;
    }
}
```

---

### `helper/src/main/java/com/postmanclone/helper/scanner/MavenModuleDetector.java` (utility, file-I/O)

**Analog:** `helper/src/main/java/com/postmanclone/helper/config/ParserConfig.java`

**Pattern:** Parse `pom.xml` for `<modules>` element, return list of module source roots:
```java
// Use Jackson XML or simple regex for pom.xml parsing
private List<Path> findModuleRoots(Path projectRoot) {
    List<Path> roots = new ArrayList<>();
    Path pomXml = projectRoot.resolve("pom.xml");
    if (Files.exists(pomXml)) {
        // Parse <modules><module>NAME</module></modules>
        // For each module: roots.add(projectRoot.resolve(module).resolve("src/main/java"))
    }
    if (roots.isEmpty()) {
        Path srcMain = projectRoot.resolve("src/main/java");
        if (Files.exists(srcMain)) roots.add(srcMain);
    }
    return roots;
}
```

---

### `helper/src/main/java/com/postmanclone/helper/scanner/GradleModuleDetector.java` (utility, file-I/O)

**Analog:** `helper/src/main/java/com/postmanclone/helper/config/ParserConfig.java`

**Pattern:** Parse `settings.gradle` or `settings.gradle.kts` for `include` statements using regex:
```java
// Regex for: include('module1', 'module2')
// Or: include "module1", "module2"
private List<Path> findModuleRoots(Path projectRoot) {
    List<Path> roots = new ArrayList<>();
    Path settingsGradle = projectRoot.resolve("settings.gradle.kts");
    if (!Files.exists(settingsGradle)) {
        settingsGradle = projectRoot.resolve("settings.gradle");
    }
    if (Files.exists(settingsGradle)) {
        // Regex: include\s*\(\s*['"]([^'"]+)['"]
        // For each module: roots.add(projectRoot.resolve(module).resolve("src/main/java"))
    }
    if (roots.isEmpty()) {
        Path srcMain = projectRoot.resolve("src/main/java");
        if (Files.exists(srcMain)) roots.add(srcMain);
    }
    return roots;
}
```

---

### `helper/src/main/java/com/postmanclone/helper/HelperJsonRpcServer.java` (modify)

**Analog:** `helper/src/main/java/com/postmanclone/helper/HelperJsonRpcServer.java` (existing)

**Add scanner methods** (lines 63-85 pattern):
```java
} else if ("scanner:scan".equals(method)) {
    try {
        JsonNode params = request.get("params");
        String projectRoot = params.get("projectRoot").asText();
        List<Path> sourceRoots = // resolve via MavenModuleDetector/GradleModuleDetector
        CombinedTypeSolver solver = ParserConfig.createSolver(sourceRoots);
        EndpointScanner scanner = new EndpointScanner(solver);
        ObjectNode result = scanner.scan(projectRoot);
        response = mapper.writeValueAsString(Map.of(
            "jsonrpc", "2.0", "id", id,
            "result", result
        ));
    } catch (Exception e) {
        response = mapper.writeValueAsString(Map.of(
            "jsonrpc", "2.0", "id", id,
            "error", Map.of("code", -32603, "message", "Scan failed: " + e.getMessage())
        ));
    }
}
```

**Update initializeResult** (lines 27-34):
```java
private final Map<String, Object> initializeResult = Map.of(
    "jsonrpc", "2.0",
    "id", 1,
    "result", Map.of(
        "version", "0.1.0",
        "capabilities", new String[]{"initialize", "helper.ping", "classpath:walkDto", "scanner:scan", "db:connect", ...}
    )
);
```

---

### `src/main/ipc/projectScanner.ts` (controller, request-response)

**Analog:** `src/main/ipc/router.ts`

**Imports pattern** (lines 1-22):
```typescript
import { app, ipcMain, dialog, shell } from 'electron';
import { writeFile as fsWriteFile, readFile as fsReadFile, mkdir as fsMkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import log from 'electron-log/main.js';
import { getDataDir, setDataDir, getSettings, setSetting } from '../storage/settings.js';
import { supervisor } from '../jvm/supervisor.js';
import { writeFileAtomic } from '../storage/atomicWrite.js';
import {
  ProjectScanArgsSchema, ProjectScanResultSchema,
  ProjectEndpointsArgsSchema, ProjectEndpointsResultSchema,
} from './channels.js';
```

**Core IPC handler pattern** (lines 496-518, `body:generateDto`):
```typescript
ipcMain.handle('body:generateDto', async (_, args) => {
    const parsed = DtoGenerateArgsSchema.parse(args);
    const client = supervisor.getClient();
    if (!client) return { ok: false, bodyJson: '', warnings: [{ code: 'HELPER_OFFLINE', message: 'Helper is offline' }], cycleRefs: [] };
    try {
      const bodyJson = await client.request('classpath:walkDto', { fqn: parsed.dtoFqn });
      // ... process result
      return DtoGenerateResultSchema.parse({ ok: true, bodyJson, warnings: [], cycleRefs });
    } catch (err: any) {
      log.error('body:generateDto failed', { error: err.message });
      return { ok: false, bodyJson: '', warnings: [{ code: 'DTO_WALK_FAILED', message: err.message }], cycleRefs: [] };
    }
});
```

**New handlers to add:**
```typescript
// --- 05-01: Spring project scanning ---
ipcMain.handle('project:scan', async (_, args) => {
    const parsed = ProjectScanArgsSchema.parse(args);
    const client = supervisor.getClient();
    if (!client) return ProjectScanResultSchema.parse({ ok: false, controllers: [], error: 'Helper offline' });
    try {
      const result = await client.request('scanner:scan', { projectRoot: parsed.path });
      // Cache to project-cache/<hash>/
      return ProjectScanResultSchema.parse(result);
    } catch (err: any) {
      log.error('project:scan failed', { error: err.message });
      return ProjectScanResultSchema.parse({ ok: false, controllers: [], error: err.message });
    }
});

ipcMain.handle('project:endpoints', async (_, args) => {
    const parsed = ProjectEndpointsArgsSchema.parse(args);
    // Read from project-cache/<hash>/endpoints.json
    // Return cached endpoint list
});
```

---

### `src/preload/index.ts` (modify)

**Analog:** `src/preload/index.ts` (existing)

**Add project namespace** (lines 3-97, WindowApi interface):
```typescript
export interface WindowApi {
  // ... existing namespaces
  project: {
    scan: (args: { path: string }) => Promise<any>;
    endpoints: (args: { projectId: string }) => Promise<any>;
    onScanProgress: (cb: (data: any) => void) => () => void;
  };
  // ...
}
```

**Add implementation** (lines 99-218, api object):
```typescript
const api: WindowApi = {
  // ... existing namespaces
  project: {
    scan: (args) => ipcRenderer.invoke('project:scan', args),
    endpoints: (args) => ipcRenderer.invoke('project:endpoints', args),
    onScanProgress: (cb) => {
      const listener = (_: any, data: any) => cb(data);
      ipcRenderer.on('project:scanProgress', listener);
      return () => ipcRenderer.off('project:scanProgress', listener);
    },
  },
  // ...
};
```

---

### `src/main/ipc/channels.ts` (modify)

**Analog:** `src/main/ipc/channels.ts` (existing)

**Add project scanning schemas** (lines 237-251 pattern):
```typescript
// --- 05-01: Project scanning schemas ---
export const ProjectScanArgsSchema = z.object({
  path: z.string().min(1),
});

export const EndpointSchema = z.object({
  id: z.string().uuid(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  fullPath: z.string(),
  handlerMethod: z.string(),
  pathVariables: z.array(z.object({
    name: z.string(),
    type: z.string(),
    required: z.boolean(),
  })),
  queryParams: z.array(z.object({
    name: z.string(),
    type: z.string(),
    required: z.boolean(),
    defaultValue: z.string().nullable(),
  })),
  requestBodyFqn: z.string().nullable(),
  consumes: z.array(z.string()),
  produces: z.array(z.string()),
  sourceFile: z.string(),
  lineNumber: z.number(),
});

export const ControllerSchema = z.object({
  fqn: z.string(),
  simpleName: z.string(),
  basePath: z.string(),
  sourceFile: z.string(),
  endpoints: z.array(EndpointSchema),
});

export const ProjectScanResultSchema = z.object({
  ok: z.boolean(),
  projectId: z.string(),
  projectPath: z.string(),
  controllers: z.array(ControllerSchema),
  scanDurationMs: z.number(),
  totalFiles: z.number(),
  totalEndpoints: z.number(),
  errors: z.array(z.string()),
  error: z.string().optional(),
});

export const ProjectEndpointsArgsSchema = z.object({
  projectId: z.string(),
});

export const ProjectEndpointsResultSchema = ProjectScanResultSchema;

// Inferred types
export type ProjectScanArgs = z.infer<typeof ProjectScanArgsSchema>;
export type ProjectScanResult = z.infer<typeof ProjectScanResultSchema>;
export type Endpoint = z.infer<typeof EndpointSchema>;
export type Controller = z.infer<typeof ControllerSchema>;
```

---

### `src/renderer/components/Sidebar/EndpointsTree.tsx` (component, request-response)

**Analog:** `src/renderer/components/Sidebar/CollectionsTree.tsx`

**Imports pattern** (lines 1-7):
```tsx
import { useState, useCallback } from 'react';
import { useEndpointsList, useEndpointsScan } from '../../hooks/useEndpoints';
import { useTabs } from '../../state/useTabs';
import { useRequest } from '../../state/useRequest';
```

**Core tree pattern** (lines 9-42, 71-210):
```tsx
export function EndpointsTree() {
  const { data: endpoints, isLoading } = useEndpointsList();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const addTab = useTabs((s) => s.addTab);

  const toggleExpand = useCallback((fqn: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(fqn)) next.delete(fqn);
      else next.add(fqn);
      return next;
    });
  }, []);

  if (isLoading) return <div style={mutedStyle}>Scanning project...</div>;

  return (
    <div>
      <div style={headerStyle}>
        <span>Endpoints</span>
        <button onClick={handleRescan} style={plusBtnStyle} title="Rescan">⟳</button>
      </div>
      {endpoints?.controllers.map(ctrl => (
        <div key={ctrl.fqn}>
          <div onClick={() => toggleExpand(ctrl.fqn)} style={treeItemStyle}>
            <span style={{ marginRight: 'var(--space-1)', fontSize: 10 }}>
              {expanded.has(ctrl.fqn) ? '▼' : '▶'}
            </span>
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

**Click-to-prefill pattern** (lines 122-163):
```tsx
const handleEndpointClick = (endpoint: Endpoint) => {
  const tabId = addTab({
    method: endpoint.method,
    url: `{{baseUrl}}${endpoint.fullPath}`,
    sourceItemName: `${endpoint.handlerMethod} [${endpoint.sourceFile}]`,
  });
  
  // Build path params from endpoint metadata
  const pathParams = endpoint.pathVariables.map(p => ({
    key: p.name,
    value: '', // placeholder for user to fill
  }));
  
  // Build query params
  const queryParams = endpoint.queryParams.map(p => ({
    key: p.name,
    value: p.defaultValue ?? '',
    enabled: true,
  }));
  
  // Build body if DTO exists
  const body = endpoint.requestBodyFqn
    ? { mode: 'raw' as const, contentType: 'application/json' as const, text: '{}' }
    : { mode: 'none' as const };
  
  useRequest.getState().setSpec(tabId, {
    requestId: crypto.randomUUID(),
    method: endpoint.method,
    url: `{{baseUrl}}${endpoint.fullPath}`,
    headers: [],
    queryParams,
    pathParams,
    body,
    auth: { type: 'none' },
    settings: { timeoutMs: 30000, followRedirects: true, maxRedirects: 10, sslVerify: true, saveCookiesToJar: false },
  });
};
```

**Exported styles** (lines 213-271):
```tsx
export const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontWeight: 600,
  fontSize: 11,
  textTransform: 'uppercase',
  color: 'var(--color-fg-muted)',
  letterSpacing: '0.05em',
  marginBottom: 'var(--space-1)',
};

export const treeItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: 'var(--space-1) var(--space-2)',
  cursor: 'pointer',
  fontSize: 12,
  borderRadius: 'var(--radius-1)',
  marginBottom: 2,
};

export const mutedStyle: React.CSSProperties = {
  color: 'var(--color-fg-muted)',
  fontSize: 12,
  padding: 'var(--space-2) 0',
};
```

---

### `src/renderer/store/endpoints.ts` (store, event-driven)

**Analog:** `src/renderer/store/collections.ts`

**Pattern:** Zustand store for endpoints state:
```typescript
import { create } from 'zustand';

interface EndpointsState {
  activeProjectId: string | null;
  scanStatus: 'idle' | 'scanning' | 'error';
  lastScanError: string | null;
  setActiveProject: (projectId: string | null) => void;
  setScanStatus: (status: 'idle' | 'scanning' | 'error', error?: string) => void;
}

export const useEndpointsStore = create<EndpointsState>((set) => ({
  activeProjectId: null,
  scanStatus: 'idle',
  lastScanError: null,
  setActiveProject: (projectId) => set({ activeProjectId: projectId }),
  setScanStatus: (status, error) => set({ scanStatus: status, lastScanError: error ?? null }),
}));
```

---

### `src/renderer/hooks/useEndpoints.ts` (hook, request-response)

**Analog:** `src/renderer/hooks/useCollections.ts`

**Pattern:** TanStack Query hook for endpoints data:
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/query-endpoints';
import { useEndpointsStore } from '../store/endpoints';

export function useEndpointsList() {
  const activeProjectId = useEndpointsStore((s) => s.activeProjectId);
  return useQuery({
    queryKey: ['endpoints', activeProjectId],
    queryFn: () => window.api.project.endpoints({ projectId: activeProjectId! }),
    enabled: !!activeProjectId,
  });
}

export function useEndpointsScan() {
  const queryClient = useQueryClient();
  const setScanStatus = useEndpointsStore((s) => s.setScanStatus);
  
  return useMutation({
    mutationFn: (path: string) => window.api.project.scan({ path }),
    onMutate: () => setScanStatus('scanning'),
    onSuccess: () => {
      setScanStatus('idle');
      queryClient.invalidateQueries({ queryKey: ['endpoints'] });
    },
    onError: (err) => {
      setScanStatus('error', err.message);
    },
  });
}
```

---

### `src/main/storage/project-cache.ts` (service, file-I/O)

**Analog:** `src/main/storage/collections.ts`

**Pattern:** JSON file storage with atomic writes:
```typescript
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import * as path from 'node:path';
import { getDataDir } from './settings.js';
import { writeFileAtomic } from './atomicWrite.js';
import { createHash } from 'node:crypto';

function getProjectCacheDir(projectId: string): string {
  const dataDir = getDataDir();
  return path.join(dataDir, 'project-cache', projectId);
}

export async function saveProjectScanResult(projectId: string, result: any): Promise<void> {
  const dir = getProjectCacheDir(projectId);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, 'endpoints.json');
  await writeFileAtomic(filePath, JSON.stringify(result, null, 2));
}

export async function readProjectScanResult(projectId: string): Promise<any | null> {
  try {
    const filePath = path.join(getProjectCacheDir(projectId), 'endpoints.json');
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function computeProjectId(projectPath: string, lastModified: number): string {
  return createHash('sha256').update(`${projectPath}:${lastModified}`).digest('hex').slice(0, 16);
}
```

---

### `src/renderer/components/StatusBar.tsx` (modify)

**Analog:** `src/renderer/components/StatusBar.tsx` (existing)

**Add scan progress indicator** (lines 26-55):
```tsx
// Add to StatusBar component
const [scanStatus, setScanStatus] = useState<any>(null);

useEffect(() => {
  const unsub = window.api.project.onScanProgress(setScanStatus);
  return unsub;
}, []);

// In render:
{scanStatus && (
  <>
    <span style={{ color: 'var(--color-fg-muted)' }}>·</span>
    <span style={{ color: 'var(--color-status-3xx)' }}>
      Scanning: {scanStatus.currentFile} ({scanStatus.endpointsFound} endpoints)
    </span>
  </>
)}
```

---

## Shared Patterns

### JSON-RPC Client Request Pattern
**Source:** `src/main/ipc/router.ts` lines 496-518
**Apply to:** All new IPC handlers calling helper
```typescript
const client = supervisor.getClient();
if (!client) return { ok: false, error: 'Helper offline' };
try {
  const result = await client.request('method:name', { params });
  return Schema.parse(result);
} catch (err: any) {
  log.error('method:name failed', { error: err.message });
  return { ok: false, error: err.message };
}
```

### Zod Schema Pattern
**Source:** `src/main/ipc/channels.ts` lines 237-251
**Apply to:** All new IPC channel schemas
```typescript
export const XxxArgsSchema = z.object({
  field: z.string().min(1),
});
export const XxxResultSchema = z.object({
  ok: z.boolean(),
  data: z.any(),
  error: z.string().optional(),
});
export type XxxArgs = z.infer<typeof XxxArgsSchema>;
export type XxxResult = z.infer<typeof XxxResultSchema>;
```

### Preload Bridge Pattern
**Source:** `src/preload/index.ts` lines 99-218
**Apply to:** All new IPC channels
```typescript
// Interface
namespace: {
  method: (args) => Promise<any>;
  onEvent: (cb) => () => void;
}

// Implementation
namespace: {
  method: (args) => ipcRenderer.invoke('namespace:method', args),
  onEvent: (cb) => {
    const listener = (_: any, data: any) => cb(data);
    ipcRenderer.on('namespace:event', listener);
    return () => ipcRenderer.off('namespace:event', listener);
  },
}
```

### JavaParser Annotation Walking
**Source:** `helper/src/main/java/com/postmanclone/helper/dto/DtoWalker.java` lines 65-89
**Apply to:** EndpointScanner.java
```java
CompilationUnit cu = StaticJavaParser.parse(sourceFile);
Optional<TypeDeclaration> typeOpt = cu.findFirst(TypeDeclaration.class,
    t -> t.getNameAsString().equals(shortName(fqn)));
// Walk class annotations, method annotations
```

### Sidebar Tree Component Pattern
**Source:** `src/renderer/components/Sidebar/CollectionsTree.tsx` lines 9-42, 213-271
**Apply to:** EndpointsTree.tsx
```tsx
// Header with action button
<div style={headerStyle}>
  <span>Title</span>
  <button onClick={handler} style={plusBtnStyle}>+</button>
</div>

// Expandable tree items
<div onClick={() => toggleExpand(id)} style={treeItemStyle}>
  <span>{expanded ? '▼' : '▶'}</span>
  <span>{name}</span>
  <span style={{ fontSize: 10 }}>{count}</span>
</div>

// Child items with click handler
{expanded && items.map(item => (
  <div key={item.id} onClick={() => handleClick(item)} style={{ ...treeItemStyle, paddingLeft: 'var(--space-5)' }}>
    <span style={{ color: methodColor }}>{method}</span>
    <span>{path}</span>
  </div>
))}
```

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `helper/src/main/java/com/postmanclone/helper/scanner/ClasspathResolver.java` | service | transform | No classpath assembly exists yet; use ParserConfig as base |
| `helper/src/main/java/com/postmanclone/helper/scanner/MavenModuleDetector.java` | utility | file-I/O | No XML parsing utility exists yet |
| `helper/src/main/java/com/postmanclone/helper/scanner/GradleModuleDetector.java` | utility | file-I/O | No Gradle parsing utility exists yet |

## Metadata

**Analog search scope:** `helper/src/main/java/`, `src/main/`, `src/preload/`, `src/renderer/`
**Files scanned:** 15
**Pattern extraction date:** 2026-06-06
