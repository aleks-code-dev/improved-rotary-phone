import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let testDataDir: string;

beforeAll(async () => {
  testDataDir = join(tmpdir(), `pmclone-int-${randomUUID().slice(0, 8)}`);
  mkdirSync(testDataDir, { recursive: true });
  const { setDataDir } = await import('../src/main/storage/paths.js');
  setDataDir(testDataDir);
});

afterAll(() => {
  try { rmSync(testDataDir, { recursive: true, force: true }); } catch { /* ok */ }
});

// ─── Collections CRUD ─────────────────────────────────

describe('Collections CRUD', () => {
  it('create → list (itemCount=0) → read → delete', async () => {
    const { createCollection, listCollections, readCollection, deleteCollection } = await import('../src/main/storage/collections.js');
    
    const { id } = await createCollection('Test API');
    
    const list1 = await listCollections();
    const c = list1.find(x => x.id === id);
    expect(c).toBeTruthy();
    expect(c!.name).toBe('Test API');
    expect(c!.itemCount).toBe(0);
    
    const full = await readCollection(id);
    expect(full.item).toEqual([]);
    
    await deleteCollection(id);
    const list2 = await listCollections();
    expect(list2.find(x => x.id === id)).toBeUndefined();
  });

  it('addRequestToCollection → itemCount updates correctly', async () => {
    const { createCollection, listCollections, readCollection, addRequestToCollection } = await import('../src/main/storage/collections.js');
    
    const { id } = await createCollection('API v2');
    
    await addRequestToCollection(id, { name: 'Get Users', spec: { method: 'GET', url: 'http://localhost/users' } });
    await addRequestToCollection(id, { name: 'Create User', spec: { method: 'POST', url: 'http://localhost/users' } });
    
    const list = await listCollections();
    const c = list.find(x => x.id === id);
    expect(c!.itemCount).toBe(2);
    
    const full = await readCollection(id);
    expect(full.item.length).toBe(2);
    expect(full.item[0].name).toBe('Get Users');
    expect((full.item[0] as any).request?.method).toBe('GET');
    expect(full.item[1].name).toBe('Create User');
  });
});

// ─── History ──────────────────────────────────────────

describe('History', () => {
  it('append → list → persists globally (__global__)', async () => {
    const { appendHistoryEntry, listHistory } = await import('../src/main/storage/history.js');
    
    await appendHistoryEntry('__global__', {
      timestamp: Date.now(),
      collectionId: '__global__',
      request: { method: 'GET', url: 'http://localhost/test', headers: [] },
      response: {
        status: 200, statusText: 'OK', headers: [],
        bodyBase64: Buffer.from('{"ok":true}').toString('base64'),
        durationMs: 42, startedAt: Date.now() - 100, completedAt: Date.now(),
      },
    });
    
    const entries = await listHistory('__global__');
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0].request.method).toBe('GET');
    expect(entries[0].response?.status).toBe(200);
  });

  it('masks Authorization headers in stored history', async () => {
    const { appendHistoryEntry, listHistory } = await import('../src/main/storage/history.js');
    const cid = randomUUID();
    
    await appendHistoryEntry(cid, {
      timestamp: Date.now(), collectionId: cid,
      request: {
        method: 'POST', url: 'http://localhost/api',
        headers: [
          { key: 'Authorization', value: 'Bearer sk-secret-token-12345' },
          { key: 'Content-Type', value: 'application/json' },
        ],
      },
      response: {
        status: 201, statusText: 'Created', headers: [],
        bodyBase64: Buffer.from('{}').toString('base64'),
        durationMs: 10, startedAt: Date.now() - 100, completedAt: Date.now(),
      },
    });
    
    const entries = await listHistory(cid);
    const auth = (entries[0].request as any).headers.find((h: any) => h.key === 'Authorization');
    expect(auth?.value).toContain('***');
    expect(auth?.value).not.toContain('sk-secret');
    
    const ct = (entries[0].request as any).headers.find((h: any) => h.key === 'Content-Type');
    expect(ct?.value).toBe('application/json');
  });
});

// ─── cURL ─────────────────────────────────────────────

describe('cURL Generate + Parse round-trip', () => {
  it('generates and parses back correctly', async () => {
    const { generateCurl, parseCurl } = await import('../src/main/http/curlGen.js');

    const spec = {
      requestId: randomUUID(),
      method: 'POST' as const,
      url: 'http://example.com/api',
      headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
      queryParams: [],
      pathParams: [],
      body: { mode: 'raw' as const, contentType: 'application/json' as const, text: '{"hello":"world"}' },
      auth: { type: 'bearer' as const, token: 'tkn' },
      settings: { timeoutMs: 30000, followRedirects: true, maxRedirects: 10, sslVerify: true, saveCookiesToJar: false },
    };

    const curl = generateCurl(spec as any);
    expect(curl).toContain('-X POST');
    expect(curl).toContain('Content-Type: application/json');

    const parsed = parseCurl(curl);
    expect('url' in parsed).toBe(true);
    if ('url' in parsed) {
      expect(parsed.method).toBe('POST');
      expect(parsed.url).toBe('http://example.com/api');
    }
  });
});

// ─── Variable Resolution ──────────────────────────────

describe('Variables', () => {
  function emptyScopes() {
    return {
      local: new Map<string, string>(),
      data: new Map<string, string>(),
      env: new Map<string, string>(),
      collection: new Map<string, string>(),
      global: new Map<string, string>(),
    };
  }

  it('resolves {{var}} in URL and headers', async () => {
    const { resolveVariables } = await import('../src/main/storage/variable-resolver.js');

    const scopes = emptyScopes();
    scopes.global.set('base', 'http://localhost:8080');
    scopes.global.set('token', 'abc123');

    const spec: any = {
      requestId: randomUUID(), method: 'GET',
      url: '{{base}}/api/users',
      headers: [{ key: 'X-Token', value: '{{token}}', enabled: true }],
      queryParams: [], pathParams: [],
      body: { mode: 'none' },
      auth: { type: 'none' },
      settings: { timeoutMs: 30000, followRedirects: true, maxRedirects: 10, sslVerify: true, saveCookiesToJar: false },
    };

    const result = resolveVariables(spec, scopes);
    expect(result.resolved.url).toBe('http://localhost:8080/api/users');
    expect(result.resolved.headers[0].value).toBe('abc123');
    expect(result.unresolved).toEqual([]);
  });

  it('reports unresolved variables', async () => {
    const { resolveVariables } = await import('../src/main/storage/variable-resolver.js');

    const scopes = emptyScopes();
    scopes.global.set('base', 'http://localhost:8080');

    const spec: any = {
      requestId: randomUUID(), method: 'GET',
      url: '{{base}}/{{endpoint}}',
      headers: [], queryParams: [], pathParams: [],
      body: { mode: 'none' }, auth: { type: 'none' },
      settings: { timeoutMs: 30000, followRedirects: true, maxRedirects: 10, sslVerify: true, saveCookiesToJar: false },
    };

    const result = resolveVariables(spec, scopes);
    expect(result.unresolved).toContain('endpoint');
    expect(result.resolved.url).toContain('http://localhost:8080');
  });
});

// ─── Postman Import ───────────────────────────────────

describe('Postman Import', () => {
  it('imports v2.1 collection → shows in list with correct itemCount', async () => {
    const { importPostmanCollection } = await import('../src/main/storage/import-export.js');
    const { createCollection, listCollections, readCollection, updateCollection, deleteCollection } = await import('../src/main/storage/collections.js');

    const fixture = JSON.stringify({
      info: {
        name: 'Imported API',
        _postman_id: randomUUID(),
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: [
        { name: 'Health', request: { method: 'GET', url: 'http://localhost/health' }, response: [], event: [] },
        { name: 'Metrics', request: { method: 'GET', url: 'http://localhost/metrics' }, response: [], event: [] },
      ],
    });

    const importResult = importPostmanCollection(fixture);
    expect(importResult.ok).toBe(true);
    if (!importResult.ok) return;

    // Write to disk (as the IPC handler does)
    const { id } = await createCollection(importResult.collection.info.name);
    await updateCollection(id, importResult.collection);

    expect(importResult.preview.itemCount).toBe(2);

    const list = await listCollections();
    const imported = list.find(c => c.id === id);
    expect(imported).toBeTruthy();
    expect(imported!.name).toBe('Imported API');
    expect(imported!.itemCount).toBe(2);

    const full = await readCollection(id);
    expect(full.item.length).toBe(2);

    await deleteCollection(id);
  });
});

// ─── Full Flow: Create → Save → Verify → History ──────

describe('End-to-end flow', () => {
  it('create collection → save request → verify count → log history', async () => {
    const { createCollection, listCollections, readCollection, addRequestToCollection } = await import('../src/main/storage/collections.js');
    const { appendHistoryEntry, listHistory } = await import('../src/main/storage/history.js');
    
    // Create
    const { id: collId } = await createCollection('E2E Flow');
    
    // Save request
    await addRequestToCollection(collId, { name: 'Login', spec: { method: 'POST', url: 'http://localhost/login' } });
    
    // Verify itemCount
    const list = await listCollections();
    expect(list.find(c => c.id === collId)!.itemCount).toBe(1);
    
    // Verify full read
    const full = await readCollection(collId);
    expect(full.item.length).toBe(1);
    expect(full.item[0].name).toBe('Login');
    
    // Log history
    await appendHistoryEntry(collId, {
      timestamp: Date.now(), collectionId: collId,
      request: { method: 'POST', url: 'http://localhost/login', headers: [] },
      response: {
        status: 200, statusText: 'OK', headers: [],
        bodyBase64: Buffer.from('{"token":"abc"}').toString('base64'),
        durationMs: 120, startedAt: Date.now() - 200, completedAt: Date.now(),
      },
    });
    
    // Verify history
    const history = await listHistory(collId);
    expect(history.length).toBe(1);
    expect(history[0].request.method).toBe('POST');
    expect(history[0].response?.status).toBe(200);
  });
});
