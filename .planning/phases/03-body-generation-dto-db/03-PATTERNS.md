# Phase 03: Body Generation (DTO + DB) - Pattern Map

**Mapped:** 2026-06-05
**Files analyzed:** 33 new/modified files
**Analogs found:** 27 / 33 (82%)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| **JVM Helper (Java)** | | | | |
| `helper/…/dto/DtoWalker.java` | service | transform | `HelperJsonRpcServer.java` (Jackson output) | partial — logic is new |
| `helper/…/dto/CycleDetector.java` | utility | transform | No analog — novel algorithm | no-analog |
| `helper/…/dto/FieldDiscoveryStrategy.java` | interface | transform | No analog — Java interface pattern | no-analog |
| `helper/…/dto/SourceFieldDiscovery.java` | service | transform | No analog — JavaParser-specific | no-analog |
| `helper/…/dto/BytecodeFieldDiscovery.java` | service | transform | No analog — ASM-specific | no-analog |
| `helper/…/dto/PlaceholderFactory.java` | utility | transform | No analog — novel pattern | no-analog |
| `helper/…/dto/EnumCommentEmitter.java` | utility | transform | No analog — novel pattern | no-analog |
| `helper/…/db/DbConnectionManager.java` | service | CRUD | `supervisor.ts` (resource lifecycle) | role-match (diff lang) |
| `helper/…/db/ConnectionPoolFactory.java` | factory | transform | `build.gradle.kts` (HikariCP config) | partial — config pattern |
| `helper/…/db/TableEnumerator.java` | service | CRUD | No analog — JDBC metadata | no-analog |
| `helper/…/db/RowToJsonMapper.java` | service | transform | No analog — JDBC→Jackson | no-analog |
| `helper/…/db/ColumnFieldNameMatcher.java` | utility | transform | No analog — string transform | no-analog |
| `helper/…/db/type/TypeNormalizer.java` | interface | transform | No analog — strategy pattern | no-analog |
| `helper/…/db/type/PostgresTypeNormalizer.java` | service | transform | No analog — driver-specific | no-analog |
| `helper/…/db/type/MySqlTypeNormalizer.java` | service | transform | No analog — driver-specific | no-analog |
| `helper/…/db/type/OracleTypeNormalizer.java` | service | transform | No analog — driver-specific | no-analog |
| `helper/…/db/type/H2TypeNormalizer.java` | service | transform | No analog — driver-specific | no-analog |
| `helper/…/rpc/ClasspathRpcHandler.java` | controller | request-response | `HelperJsonRpcServer.java` lines 35-48 | **exact** |
| `helper/…/rpc/DbRpcHandler.java` | controller | request-response | `HelperJsonRpcServer.java` lines 35-48 | **exact** |
| `helper/…/config/ParserConfig.java` | config | — | `build.gradle.kts` lines 17-20 (Java toolchain) | partial |
| **Main Process (TypeScript)** | | | | |
| `src/main/ipc/safeStorage.ts` | utility | transform | `src/main/security/secretMask.ts` + `src/main/jvm/jdkDetect.ts` | **exact** |
| `src/main/storage/db-connections.ts` | service | CRUD | `src/main/storage/collections.ts` | **exact** |
| **Renderer (React)** | | | | |
| `src/renderer/components/DbConnectionPanel/` | component | request-response | `BodyTab.tsx` (mode switcher + inputs) | role-match |
| `src/renderer/components/ColumnFieldMapping/` | component | request-response | `BodyTab.tsx` `KeyValueTable` (lines 146-181) | **exact** |
| **Modified Files** | | | | |
| `src/main/ipc/channels.ts` | schema | — | Existing `channels.ts` schemas (lines 119-172) | **exact** |
| `src/main/ipc/router.ts` | controller | request-response | Existing `router.ts` handlers (lines 226-252) | **exact** |
| `src/renderer/components/RequestEditor/BodyTab.tsx` | component | request-response | `BodyTab.tsx` lines 57-71 (toolbar) | **exact** |
| `helper/…/HelperJsonRpcServer.java` | controller | request-response | `HelperJsonRpcServer.java` lines 35-48 | **exact** |
| `src/preload/index.ts` | bridge | request-response | Existing `preload/index.ts` (lines 37-41) | **exact** |
| `helper/build.gradle.kts` | config | — | Existing `build.gradle.kts` lines 11-14 | **exact** |
| **State/Tests** | | | | |
| `src/renderer/state/useBodyGeneration.ts` | store | request-response | `useHelperStatus.ts` (Zustand + subscription) | **exact** |
| `tests/helper/dto-walker.test.ts` | test | — | `tests/http-client.test.ts` (vitest structure) | **exact** |
| `tests/helper/db-connection.test.ts` | test | — | `tests/integration.test.ts` (beforeAll/afterAll/tmpdir) | **exact** |

---

## Pattern Assignments

### 1. `helper/…/rpc/ClasspathRpcHandler.java` (controller, request-response)

**Analog:** `helper/…/HelperJsonRpcServer.java` lines 30-54

**Imports pattern** (lines 1-9):
```java
package com.postmanclone.helper;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;

import java.io.*;
import java.util.Map;
import java.util.HashMap;
```

**Core dispatch pattern** (lines 35-53):
```java
if ("initialize".equals(method)) {
    response = mapper.writeValueAsString(
        Map.of("jsonrpc", "2.0", "id", id,
               "result", Map.of("version", "0.1.0", "capabilities", new String[]{"initialize", "helper.ping"}))
    );
} else if ("shutdown".equals(method)) {
    response = mapper.writeValueAsString(Map.of("jsonrpc", "2.0", "id", id, "result", "OK"));
    writer.println(response);
    writer.flush();
    break;
} else {
    response = mapper.writeValueAsString(Map.of(
        "jsonrpc", "2.0", "id", id,
        "error", Map.of("code", -32601, "message", "Method not found: " + method)
    ));
}
writer.println(response);
writer.flush();
```

**Error handling pattern** (lines 56-58):
```java
} catch (Exception e) {
    e.printStackTrace();
}
```

**Phase 3 extension pattern — new RPC methods follow this shape:**
```java
} else if ("classpath:walkDto".equals(method)) {
    JsonNode params = request.get("params");
    String fqn = params.get("fqn").asText();
    int depth = params.has("depth") ? params.get("depth").asInt() : 6;
    String bodyJson = classpathRpcHandler.walkDto(fqn, depth);
    response = mapper.writeValueAsString(Map.of(
        "jsonrpc", "2.0", "id", id,
        "result", bodyJson
    ));
} else if ("db:connect".equals(method)) {
    // ...pattern continues
```

---

### 2. `helper/…/rpc/DbRpcHandler.java` (controller, request-response)

**Analog:** Same as ClasspathRpcHandler — `HelperJsonRpcServer.java` lines 35-48

Use identical dispatch/response patterns. Key difference: DB RPC methods receive sensitive parameters (password). **Never log password** — sanitize before any log statement.

---

### 3. `helper/…/dto/DtoWalker.java` (service, transform)

**Analog:** No existing Java analog in codebase. The body generation logic is novel. Use the **Jackson JSON output pattern** from `HelperJsonRpcServer.java` and the **class structure** from `Main.java` (picocli entry point, callable pattern).

**Package/import pattern** (from `HelperJsonRpcServer.java` lines 1-9 + `Main.java` lines 1-17):
```java
package com.postmanclone.helper.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
// JavaParser imports (new)
import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.FieldDeclaration;
import com.github.javaparser.ast.body.VariableDeclarator;
import com.github.javaparser.resolution.types.ResolvedType;
```

**Jackson output pattern** (from `HelperJsonRpcServer.java` lines 36-38):
```java
// Build ObjectNode
ObjectNode root = mapper.createObjectNode();
// ... populate fields ...
String result = mapper.writeValueAsString(root);
```

**Structure:** Single-responsibility class with `public String walk(String fqn, List<Path> classpathRoots)` method. Injected dependencies: `CombinedTypeSolver`, `FieldDiscoveryStrategy`, `CycleDetector`, `PlaceholderFactory`.

---

### 4. `src/main/ipc/safeStorage.ts` (utility, transform)

**Analog:** `src/main/security/secretMask.ts` (security module pattern) + `src/main/jvm/jdkDetect.ts` (standalone utility with exported functions)

**Import pattern** (from `secretMask.ts` lines 1-6 + `jdkDetect.ts` lines 1-4):
```typescript
import { safeStorage } from 'electron';
import log from '../logging/log.js';
```

**Standalone utility pattern** (from `jdkDetect.ts` lines 36-124 — exported functions, no class):
```typescript
export function isAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

export async function encryptCredential(plainText: string): Promise<Buffer> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption not available on this platform');
  }
  return safeStorage.encryptStringAsync(plainText);
}

export async function decryptCredential(encrypted: Buffer): Promise<string> {
  const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(encrypted);
  if (shouldReEncrypt) {
    const reEncrypted = await safeStorage.encryptStringAsync(result);
    // Store re-encrypted value back (caller handles)
  }
  return result;
}
```

**Error handling pattern** (from `jdkDetect.ts` lines 12-24 — try/catch with null return):
```typescript
try {
  // ... operation ...
} catch {
  return null;
}
```

---

### 5. `src/main/storage/db-connections.ts` (service, CRUD)

**Analog:** `src/main/storage/collections.ts` — **exact** CRUD-json-file pattern

**Imports pattern** (from `collections.ts` lines 1-6):
```typescript
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { writeFileAtomic } from './atomicWrite.js';
import { getDataDir } from './settings.js';
import { encryptCredential, decryptCredential } from '../ipc/safeStorage.js';
// Zod schema for validation
import { DbConnectionSchema, type DbConnection } from '../../shared/schemas/db-connection.js';
```

**List pattern** (from `collections.ts` lines 16-40):
```typescript
export async function listConnections(): Promise<DbConnectionMeta[]> {
  const dir = path.join(getDataDir() || '', 'db-connections');
  const results: DbConnectionMeta[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const raw = await fs.readFile(path.join(dir, entry.name, 'connection.json'), 'utf-8');
        const parsed = JSON.parse(raw);
        results.push({
          id: entry.name,
          name: parsed.name ?? entry.name,
          dbType: parsed.dbType ?? 'unknown',
        });
      } catch { /* corrupt — skip */ }
    }
  } catch { /* dir doesn't exist */ }
  return results;
}
```

**Create + encrypt password pattern** (combining `collections.ts` lines 52-71 + `safeStorage.ts`):
```typescript
export async function createConnection(
  name: string,
  url: string,
  user: string,
  password: string,
  dbType: string,
): Promise<{ id: string }> {
  const id = randomUUID();
  const dir = path.join(getDataDir() || '', 'db-connections', id);
  await fs.mkdir(dir, { recursive: true });

  const encryptedPassword = await encryptCredential(password);
  const connection: DbConnection = {
    id,
    name,
    url,
    user,
    passwordEncrypted: encryptedPassword.toString('base64'),
    dbType,
    createdAt: Date.now(),
  };

  DbConnectionSchema.parse(connection);
  await writeFileAtomic(
    path.join(dir, 'connection.json'),
    JSON.stringify(connection, null, 2)
  );
  return { id };
}
```

**Read + decrypt pattern:**
```typescript
export async function readConnection(id: string): Promise<DbConnection> {
  const filePath = path.join(getDataDir() || '', 'db-connections', id, 'connection.json');
  const raw = await fs.readFile(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  const validated = DbConnectionSchema.parse(parsed);
  // Decrypt password for use
  const password = await decryptCredential(
    Buffer.from(validated.passwordEncrypted, 'base64')
  );
  return { ...validated, password };
}
```

**Delete pattern** (from `collections.ts` lines 83-86):
```typescript
export async function deleteConnection(id: string): Promise<void> {
  const dir = path.join(getDataDir() || '', 'db-connections', id);
  await fs.rm(dir, { recursive: true, force: true });
}
```

---

### 6. `src/main/ipc/channels.ts` — Phase 3 Additions (schema, config)

**Analog:** Existing `channels.ts` lines 119-172 (collections/environments/history schemas)

**New Phase 3 schemas follow exact same pattern:**

```typescript
// --- 03: Body Generation schemas ---
export const DtoGenerateArgsSchema = z.object({
  requestId: z.string().uuid(),
  dtoFqn: z.string().min(1),
  subtypeName: z.string().optional(),  // D-03: polymorphic subtype picker
});
export const DtoGenerateResultSchema = z.object({
  ok: z.boolean(),
  bodyJson: z.string(),
  warnings: z.array(z.object({
    code: z.string(),
    message: z.string(),
  })).default([]),
  cycleRefs: z.array(z.string()).default([]),
});

// --- 03: DB Connection schemas ---
export const DbConnectArgsSchema = z.object({
  connectionId: z.string().uuid(),
});
export const DbConnectResultSchema = z.object({
  ok: z.boolean(),
  status: z.enum(['connected', 'error']),
  error: z.string().optional(),
  tables: z.number().optional(),
});

export const DbDisconnectArgsSchema = z.object({
  connectionId: z.string().uuid(),
});

export const DbTestConnectionArgsSchema = z.object({
  url: z.string().min(1),
  user: z.string(),
  password: z.string(), // plaintext for first test (never persisted plain)
  dbType: z.enum(['postgresql', 'mysql', 'oracle', 'h2']),
});

export const DbListTablesArgsSchema = z.object({
  connectionId: z.string().uuid(),
});
export const DbTableInfoSchema = z.object({
  name: z.string(),
  schema: z.string().nullable(),
  columnCount: z.number(),
  rowCountEstimate: z.number(),
});
export const DbListTablesResultSchema = z.array(DbTableInfoSchema);

export const DbFetchRowsArgsSchema = z.object({
  connectionId: z.string().uuid(),
  tableName: z.string(),
  schema: z.string().nullable(),
  mode: z.enum(['firstN', 'byId', 'byWhere']),
  idValue: z.string().optional(),
  whereClause: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(100),
});
export const DbFetchRowsResultSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
  columns: z.array(z.object({
    name: z.string(),
    typeName: z.string(),
    nullable: z.boolean(),
  })),
  truncated: z.boolean(),
  totalCount: z.number(),
});

export const DbMapRowToDtoArgsSchema = z.object({
  connectionId: z.string().uuid(),
  tableName: z.string(),
  rowId: z.record(z.string(), z.unknown()), // primary key values
  dtoFqn: z.string(),
  columnMapping: z.record(z.string(), z.string()).default({}),
});
export const DbMapRowToDtoResultSchema = z.object({
  ok: z.boolean(),
  bodyJson: z.string(),
  mapping: z.array(z.object({
    column: z.string(),
    field: z.string(),
    compatibility: z.enum(['exact', 'compatible', 'incompatible']),
  })),
  coverage: z.object({
    mapped: z.number(),
    required: z.number(),
    total: z.number(),
  }),
  warnings: z.array(z.object({
    code: z.string(),
    message: z.string(),
  })).default([]),
});

// --- DB Connection CRUD schemas (mirror collections pattern) ---
export const DbConnectionListResultSchema = z.array(z.object({
  id: z.string().uuid(),
  name: z.string(),
  dbType: z.string(),
  connected: z.boolean().default(false),
}));
export const DbConnectionCreateArgsSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().min(1),
  user: z.string(),
  password: z.string(),
  dbType: z.enum(['postgresql', 'mysql', 'oracle', 'h2']),
});
export const DbConnectionDeleteArgsSchema = z.object({
  id: z.string().uuid(),
});

// Inferred types
export type DtoGenerateArgs = z.infer<typeof DtoGenerateArgsSchema>;
export type DtoGenerateResult = z.infer<typeof DtoGenerateResultSchema>;
// ... (all types exported)
```

---

### 7. `src/main/ipc/router.ts` — Phase 3 Additions (controller, request-response)

**Analog:** Existing `router.ts` lines 226-252 (collections:create handler pattern)

**New handler registration pattern** (follows existing exactly):
```typescript
import * as dbConnectionsService from '../storage/db-connections.js';
import { supervisor } from '../jvm/supervisor.js';
import { encryptCredential } from './safeStorage.js';

// Inside registerIpcRouter():
// --- 03: Body Generation ---
ipcMain.handle('body:generateDto', async (_, args) => {
  const parsed = DtoGenerateArgsSchema.parse(args);
  const client = (supervisor as any)._client; // Access helper client
  if (!client) return { ok: false, error: 'Helper offline' };
  try {
    const bodyJson = await client.request('classpath:walkDto', {
      fqn: parsed.dtoFqn,
      subtypeName: parsed.subtypeName,
    });
    return DtoGenerateResultSchema.parse({
      ok: true,
      bodyJson,
      warnings: [],
      cycleRefs: [],
    });
  } catch (err: any) {
    log.error('body:generateDto failed', { dtoFqn: parsed.dtoFqn, error: err.message });
    return { ok: false, error: err.message };
  }
});

// --- 03: DB Connections ---
ipcMain.handle('db:connections:list', async () => {
  const list = await dbConnectionsService.listConnections();
  return DbConnectionListResultSchema.parse(list);
});

ipcMain.handle('db:connections:create', async (_, args) => {
  const parsed = DbConnectionCreateArgsSchema.parse(args);
  const result = await dbConnectionsService.createConnection(
    parsed.name, parsed.url, parsed.user, parsed.password, parsed.dbType
  );
  return result;
});

ipcMain.handle('db:connections:delete', async (_, args) => {
  const parsed = DbConnectionDeleteArgsSchema.parse(args);
  await dbConnectionsService.deleteConnection(parsed.id);
  return { ok: true };
});

// --- 03: DB Operations (helper relay) ---
ipcMain.handle('db:connect', async (_, args) => {
  const parsed = DbConnectArgsSchema.parse(args);
  const client = (supervisor as any)._client;
  if (!client) return { ok: false, error: 'Helper offline' };
  const connData = await dbConnectionsService.readConnection(parsed.connectionId);
  const result = await client.request('db:connect', {
    connId: connData.id,
    url: connData.url,
    user: connData.user,
    password: connData.password, // decrypted by service
  });
  return DbConnectResultSchema.parse({ ok: true, status: result.status });
});

ipcMain.handle('db:fetchRows', async (_, args) => {
  const parsed = DbFetchRowsArgsSchema.parse(args);
  const client = (supervisor as any)._client;
  if (!client) return { ok: false, error: 'Helper offline' };
  const result = await client.request('db:fetchRows', parsed);
  return DbFetchRowsResultSchema.parse(result);
});

ipcMain.handle('db:mapRowToDto', async (_, args) => {
  const parsed = DbMapRowToDtoArgsSchema.parse(args);
  const client = (supervisor as any)._client;
  if (!client) return { ok: false, error: 'Helper offline' };
  const result = await client.request('db:mapRowToDto', parsed);
  return DbMapRowToDtoResultSchema.parse(result);
});
```

**Testing relay availability pattern** (from `router.ts` lines 171-191 — request:send error handling):
```typescript
} catch (err) {
  log.error('db:connect failed', { connectionId: parsed.connectionId, error: err.message });
  // NEVER include connectionId or error in user-facing errors that might leak
  return { ok: false, error: 'Connection failed' };
}
```

---

### 8. `src/preload/index.ts` — Phase 3 Additions (bridge, request-response)

**Analog:** Existing `preload/index.ts` lines 27-41 (collections API shape)

**Add to `WindowApi` interface** (lines 27-33 pattern):
```typescript
body: {
  generateDto: (args: { requestId: string; dtoFqn: string; subtypeName?: string }) => Promise<any>;
},
db: {
  connections: {
    list: () => Promise<any>;
    create: (args: { name: string; url: string; user: string; password: string; dbType: string }) => Promise<any>;
    delete: (args: { id: string }) => Promise<any>;
  };
  connect: (args: { connectionId: string }) => Promise<any>;
  disconnect: (args: { connectionId: string }) => Promise<any>;
  testConnection: (args: { url: string; user: string; password: string; dbType: string }) => Promise<any>;
  listTables: (args: { connectionId: string }) => Promise<any>;
  fetchRows: (args: { connectionId: string; tableName: string; schema?: string | null; mode: string; idValue?: string; whereClause?: string; limit?: number }) => Promise<any>;
  mapRowToDto: (args: { connectionId: string; tableName: string; rowId: Record<string, unknown>; dtoFqn: string; columnMapping?: Record<string, string> }) => Promise<any>;
},
```

**Add to `api` object implementation** (lines 101-106 pattern):
```typescript
body: {
  generateDto: (args) => ipcRenderer.invoke('body:generateDto', args),
},
db: {
  connections: {
    list: () => ipcRenderer.invoke('db:connections:list'),
    create: (args) => ipcRenderer.invoke('db:connections:create', args),
    delete: (args) => ipcRenderer.invoke('db:connections:delete', args),
  },
  connect: (args) => ipcRenderer.invoke('db:connect', args),
  disconnect: (args) => ipcRenderer.invoke('db:disconnect', args),
  testConnection: (args) => ipcRenderer.invoke('db:testConnection', args),
  listTables: (args) => ipcRenderer.invoke('db:listTables', args),
  fetchRows: (args) => ipcRenderer.invoke('db:fetchRows', args),
  mapRowToDto: (args) => ipcRenderer.invoke('db:mapRowToDto', args),
},
```

---

### 9. `src/renderer/components/RequestEditor/BodyTab.tsx` — Phase 3 Modifications (component, request-response)

**Analog:** `BodyTab.tsx` lines 57-71 (toolbar pattern: Content-Type dropdown + Format button)

**Add "Generate" button to toolbar** (extends lines 58-71 pattern):
```tsx
{/* DTO Generate button — visible when DTO detected */}
{spec?.detectedDto && body.mode === 'raw' && body.contentType === 'application/json' && (
  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
    <button
      onClick={handleGenerateDto}
      disabled={helperStatus.state !== 'healthy'}
      title={helperStatus.state !== 'healthy' ? 'Helper offline — body generation unavailable' : 'Generate JSON body from DTO schema'}
      style={{
        ...formatBtnStyle, // reuse existing style
        color: 'var(--color-primary)',
        borderColor: 'var(--color-primary)',
      }}
    >
      Generate
    </button>
    {/* D-03: Subtype dropdown for polymorphic DTOs */}
    {(detectedSubtypes?.length ?? 0) > 1 && (
      <select
        value={selectedSubtype ?? detectedSubtypes![0]}
        onChange={(e) => setSelectedSubtype(e.target.value)}
        style={selectStyle}
      >
        {detectedSubtypes!.map((st) => (
          <option key={st} value={st}>{st}</option>
        ))}
      </select>
    )}
  </div>
)}
```

**Generate handler pattern** (from `BodyTab.tsx` lines 32-38 — function callbacks):
```tsx
const handleGenerateDto = useCallback(async () => {
  if (!spec?.detectedDto) return;
  try {
    const result = await window.api.body.generateDto({
      requestId: spec.requestId,
      dtoFqn: spec.detectedDto.fqn,
      subtypeName: selectedSubtype ?? undefined,
    });
    if (result.ok) {
      setBody(tabId, { mode: 'raw', contentType: 'application/json', text: result.bodyJson });
    }
  } catch (err) {
    // Show error toast or inline warning
  }
}, [spec, tabId, selectedSubtype, setBody]);
```

---

### 10. `src/renderer/components/DbConnectionPanel/` (component, request-response)

**Analog:** `BodyTab.tsx` lines 40-141 (mode switcher + mode-specific content) — **role-match** — same pattern of conditional rendering based on state. Also `ParamsTab.tsx` for table-based input pattern.

**Component structure pattern** (from `BodyTab.tsx` lines 1-16):
```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface DbConnectionPanelProps {
  requestId: string;
}

export function DbConnectionPanel({ requestId }: DbConnectionPanelProps) {
  // Zustand state
  const connections = useDbConnectionsStore((s) => s.connections);
  // TanStack Query for server data
  const { data: tables } = useQuery({
    queryKey: ['db', 'tables', activeConnectionId],
    queryFn: () => window.api.db.listTables({ connectionId: activeConnectionId! }),
    enabled: !!activeConnectionId,
  });

  return (
    <div style={{ padding: 'var(--space-3)', overflow: 'auto', fontSize: 12 }}>
      {/* Connection selector + JDBC URL auto-parse (sketch 006-B) */}
      {/* Table/row tree (sketch 007-D) */}
    </div>
  );
}
```

**CSS pattern** (from `BodyTab.tsx` lines 270-321 — CSS-in-JS style objects):
```typescript
const selectStyle: React.CSSProperties = {
  padding: 'var(--space-1) var(--space-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-1)',
  background: 'var(--color-bg-elevated)',
  color: 'var(--color-fg)',
  fontSize: 12,
};
```

---

### 11. `src/renderer/components/ColumnFieldMapping/` (component, request-response)

**Analog:** `BodyTab.tsx` `KeyValueTable` (lines 146-181) — **exact** — two-column editable table with onUpdate/onRemove callbacks

**Core pattern** (from `BodyTab.tsx` lines 146-181):
```tsx
function ColumnFieldMappingTable({ mappings, onUpdate, compatibilityColors }: {
  mappings: Array<{ column: string; field: string; compatibility: 'exact' | 'compatible' | 'incompatible' }>;
  onUpdate: (index: number, partial: Partial<{ field: string }>) => void;
  compatibilityColors: Record<string, string>;
}) {
  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 'var(--space-2)' }}>
        <thead>
          <tr style={{ color: 'var(--color-fg-muted)', fontSize: 11 }}>
            <th style={{ ...cellStyle, textAlign: 'left' }}>DB Column</th>
            <th style={{ ...cellStyle, textAlign: 'left' }}>DTO Field</th>
            <th style={{ ...cellStyle, width: 30 }}>Match</th>
          </tr>
        </thead>
        <tbody>
          {mappings.map((m, i) => (
            <tr key={i}>
              <td style={cellStyle}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{m.column}</span>
              </td>
              <td style={cellStyle}>
                <input
                  value={m.field}
                  onChange={(e) => onUpdate(i, { field: e.target.value })}
                  style={{
                    ...inputStyle,
                    borderColor: compatibilityColors[m.compatibility] ?? 'var(--color-border)',
                  }}
                />
              </td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>
                <span style={{
                  width: 12, height: 12, borderRadius: '50%', display: 'inline-block',
                  background: compatibilityColors[m.compatibility] ?? 'var(--color-border)',
                }} title={m.compatibility} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Style reuse** (from `BodyTab.tsx` lines 277-312):
Reuse `cellStyle`, `inputStyle`, `selectStyle` from BodyTab.tsx. Import as module or copy inline.

---

### 12. `src/renderer/state/useBodyGeneration.ts` (store, request-response)

**Analog:** `useHelperStatus.ts` lines 1-50 — **exact** — Zustand store + subscription pattern

```typescript
import { create } from 'zustand';

interface BodyGenerationState {
  generatedBodies: Record<string, {
    dtoFqn: string;
    bodyJson: string;
    generatedAt: number;
    helperVersion: string;
  }>;
  isGenerating: boolean;
  error: string | null;

  cacheGeneratedBody: (requestId: string, dtoFqn: string, bodyJson: string, helperVersion: string) => void;
  getCachedBody: (requestId: string) => string | null;
  clearCache: () => void;
}

export const useBodyGeneration = create<BodyGenerationState>((set, get) => ({
  generatedBodies: {},
  isGenerating: false,
  error: null,

  cacheGeneratedBody: (requestId, dtoFqn, bodyJson, helperVersion) => {
    set((s) => ({
      generatedBodies: {
        ...s.generatedBodies,
        [requestId]: { dtoFqn, bodyJson, generatedAt: Date.now(), helperVersion },
      },
    }));
  },

  getCachedBody: (requestId) => {
    const cached = get().generatedBodies[requestId];
    return cached?.bodyJson ?? null;
  },

  clearCache: () => set({ generatedBodies: {} }),
}));
```

**TanStack Query hook pattern** (from `useCollections.ts` lines 4-16):
```typescript
import { useQuery, useMutation } from '@tanstack/react-query';

export function useGenerateDtoBody() {
  return useMutation({
    mutationFn: (args: { requestId: string; dtoFqn: string; subtypeName?: string }) =>
      window.api.body.generateDto(args),
    onSuccess: (data, vars) => {
      if (data.ok) {
        useBodyGeneration.getState().cacheGeneratedBody(
          vars.requestId, vars.dtoFqn, data.bodyJson, '0.1.0'
        );
      }
    },
  });
}
```

---

### 13. `helper/build.gradle.kts` — Phase 3 Additions (config)

**Analog:** Existing `build.gradle.kts` lines 11-14 (dependencies block)

**Phase 3 dependency additions** (insert after line 13):
```kotlin
dependencies {
    // Existing
    implementation("com.fasterxml.jackson.core:jackson-databind:2.21.2")
    implementation("info.picocli:picocli:4.7.6")

    // Phase 3: DTO parsing
    implementation("com.github.javaparser:javaparser-core:3.28.1")
    implementation("com.github.javaparser:javaparser-symbol-solver-core:3.28.1")

    // Phase 3: Bytecode (Lombok fallback)
    implementation("org.ow2.asm:asm:9.7")

    // Phase 3: Database
    implementation("com.zaxxer:HikariCP:6.2.1")
    implementation("org.postgresql:postgresql:42.7.11")
    implementation("com.mysql:mysql-connector-j:9.1.0")
    implementation("com.oracle.database.jdbc:ojdbc11:23.7.0.25.01")
    implementation("com.h2database:h2:2.3.232")
}
```

---

### 14. `helper/…/config/ParserConfig.java` (config)

**Analog:** `build.gradle.kts` lines 17-20 (Java toolchain config) + `Main.java` line 1 (package declaration pattern)

```java
package com.postmanclone.helper.config;

import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ParserConfiguration;
import com.github.javaparser.symbolsolver.JavaSymbolSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.CombinedTypeSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.ReflectionTypeSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.JavaParserTypeSolver;

public class ParserConfig {
    public static CombinedTypeSolver createSolver(java.util.List<java.nio.file.Path> sourceRoots) {
        CombinedTypeSolver solver = new CombinedTypeSolver();
        solver.add(new ReflectionTypeSolver());
        for (var root : sourceRoots) {
            solver.add(new JavaParserTypeSolver(root));
        }
        return solver;
    }

    public static void configure() {
        StaticJavaParser.getParserConfiguration()
            .setLanguageLevel(ParserConfiguration.LanguageLevel.JAVA_21);
    }
}
```

---

### 15. Tests — `tests/helper/dto-walker.test.ts` (test)

**Analog:** `tests/http-client.test.ts` lines 1-14 + `tests/integration.test.ts` lines 1-18 — **exact** vitest pattern

**Test structure pattern** (from `http-client.test.ts` lines 1-14):
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let testDir: string;

beforeAll(() => {
  testDir = join(tmpdir(), `pmclone-dto-${randomUUID().slice(0, 8)}`);
  mkdirSync(testDir, { recursive: true });
  // Write test DTO source files
});

afterAll(() => {
  try { rmSync(testDir, { recursive: true, force: true }); } catch {}
});

describe('DtoWalker', () => {
  it('generates body for simple DTO', async () => {
    // ...
  });
});
```

---

### 16. `src/main/jvm/supervisor.ts` — Phase 3 Modifications (helper lifecycle)

**Analog:** Existing `supervisor.ts` lines 32-50 (init/spawnHelper pattern)

**Phase 3 adds:** DB connection state tracking to `HelperStatus`. Extend the discriminated union in `channels.ts`:
```typescript
// Add to HelperStatusSchema discriminated union:
z.object({
  state: z.literal('healthy'),
  pid: z.number(),
  version: z.string(),
  dbConnections: z.number().optional(), // Phase 3 addition
}),
```

**Add method to `Supervisor` class** for accessing the client (needed by IPC router):
```typescript
getClient(): JsonRpcClientImpl | null {
  return this.client;
}
```

---

## Shared Patterns

### Authentication / Security
**Source:** `src/main/security/secretMask.ts` (lines 8-30)
**Apply to:** `safeStorage.ts`, `db-connections.ts`, any handler that touches passwords
**Pattern:** Redact secrets before logging. Never log plaintext passwords or tokens. Use `safeStorage` async API exclusively.

### Error Handling
**Source:** `src/main/ipc/router.ts` lines 78-86 (try/catch + log + structured return)
**Apply to:** All IPC handlers, all RPC handlers in Java
**Pattern:**
```typescript
try {
  // ... operation ...
} catch (err) {
  log.error('operation:failed', { error: err instanceof Error ? err.message : String(err) });
  return { ok: false, error: 'Operation failed' };
}
```
**In Java** (from `HelperJsonRpcServer.java` lines 56-58):
```java
} catch (Exception e) {
    response = mapper.writeValueAsString(Map.of(
        "jsonrpc", "2.0", "id", id,
        "error", Map.of("code", -32603, "message", "Internal error: " + e.getMessage())
    ));
}
```

### Validation
**Source:** `src/main/ipc/channels.ts` lines 1-2 (Zod import + parse pattern)
**Apply to:** All IPC boundaries (preload → main → helper)
**Pattern:** `.parse(args)` at handler entry, `.parse(result)` before return. Never pass unvalidated data across process boundaries.

### Storage CRUD
**Source:** `src/main/storage/collections.ts` (full file — lines 1-114)
**Apply to:** `db-connections.ts`, all future storage modules
**Pattern:** `list` (metadata without full objects), `read` (Zod-validated full object), `create` (mkdirs + atomicWrite), `delete` (fs.rm recursive)

### Atomic Write
**Source:** `src/main/storage/atomicWrite.ts` (lines 1-25)
**Apply to:** All JSON storage writes
**Pattern:** Write to `.tmp` → fsync → rename. Windows long-path prefix support.

### Zustand Store
**Source:** `useRequest.ts` lines 1-2, 97-116 (create + interface + selector pattern)
**Apply to:** All renderer state stores
**Pattern:**
```typescript
import { create } from 'zustand';

interface MyStore {
  data: SomeType;
  setData: (data: SomeType) => void;
}
export const useMyStore = create<MyStore>((set, get) => ({ ... }));
```

### TanStack Query Hook
**Source:** `useCollections.ts` lines 1-55
**Apply to:** All server-state hooks
**Pattern:** `useQuery` for fetches with `queryKey`, `queryFn`, `staleTime`; `useMutation` for writes with `onSuccess` invalidation.

### Monaco Editor Integration
**Source:** `BodyTab.tsx` lines 81-101
**Apply to:** Any JSON editor component
**Pattern:** `Editor` from `@monaco-editor/react` with `theme="vs-dark"`, `minimap: { enabled: false }`, `scrollBeyondLastLine: false`, `wordWrap: 'on'`.

### CSS Variable Tokens (Theme)
**Source:** `BodyTab.tsx` lines 270-312 (all CSSProperties)
**Apply to:** All new UI components
**Token palette:**
- `--color-fg` / `--color-fg-muted` — text colors
- `--color-bg-elevated` — input/select background
- `--color-border` — borders
- `--color-accent` — accent color (reused for actions)
- `--color-primary` — primary (#f08c00)
- `--space-1`/`--space-2`/`--space-3`/`--space-6` — spacing (4/6/10/14px scale)
- `--radius-1` — border radius
- `--font-mono` — JetBrains Mono

### JSON-RPC Client Call
**Source:** `src/main/jvm/client.ts` lines 43-49
**Apply to:** All helper RPC invocations from main process
**Pattern:**
```typescript
const result = await client.request('method:name', { param: 'value' });
```

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `helper/…/dto/DtoWalker.java` | service | transform | Entirely novel logic — no Java service classes exist yet. Use RESEARCH.md §Code Examples for JavaParser + Jackson patterns. |
| `helper/…/dto/CycleDetector.java` | utility | transform | Novel algorithm. Use RESEARCH.md §Pitfall 1 (Cycle Detection Algorithm) code example. |
| `helper/…/dto/FieldDiscoveryStrategy.java` | interface | transform | No Java interfaces exist in the helper yet. Standard Java interface pattern. |
| `helper/…/dto/SourceFieldDiscovery.java` | service | transform | JavaParser-specific — use RESEARCH.md §DTOSchemaWalker patterns. |
| `helper/…/dto/BytecodeFieldDiscovery.java` | service | transform | ASM-specific — no existing analog. |
| `helper/…/dto/PlaceholderFactory.java` | utility | transform | Novel. Use RESEARCH.md D-05 (type-indicative placeholders list). |
| `helper/…/dto/EnumCommentEmitter.java` | utility | transform | Novel. Use RESEARCH.md D-06. |
| `helper/…/db/ConnectionPoolFactory.java` | factory | transform | HikariCP-specific. Use RESEARCH.md §HikariCP Desktop Configuration code example. |
| `helper/…/db/TableEnumerator.java` | service | CRUD | JDBC metadata — no existing analog. |
| `helper/…/db/RowToJsonMapper.java` | service | transform | JDBC→Jackson — no existing analog. |
| `helper/…/db/ColumnFieldNameMatcher.java` | utility | transform | String transforms — no existing analog. |
| `helper/…/db/type/TypeNormalizer.java` | interface | transform | Strategy pattern — no existing Java interfaces. |
| `helper/…/db/type/*TypeNormalizer.java` (4 files) | service | transform | Driver-specific — use RESEARCH.md §Per-Driver Type Normalizer code example. |

---

## Metadata

**Analog search scope:** `src/main/`, `src/renderer/`, `helper/src/main/java/`, `tests/`, `helper/build.gradle.kts`
**Files scanned:** 35+ TypeScript files, 2 Java files, 5 test files
**Pattern extraction date:** 2026-06-05
**Key insight:** The TypeScript side (main process, renderer, preload) has excellent precedent patterns from Phase 1. The Java side has only two classes (`Main.java` and `HelperJsonRpcServer.java`) — all new Java files are novel logic. The planner should use RESEARCH.md code examples as the primary Java pattern source and the TypeScript analogs identified here for the main/renderer/preload layers.
