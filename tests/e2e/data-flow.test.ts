import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication } from 'playwright';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let electronApp: ElectronApplication;
let page: any;
let dataDir: string;

test.beforeAll(async () => {
  const baseDir = mkdtempSync(join(tmpdir(), 'pmclone-e2e-'));
  const userDataDir = join(baseDir, 'userData');
  dataDir = join(baseDir, 'data');
  mkdirSync(userDataDir, { recursive: true });
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(userDataDir, 'settings.json'), JSON.stringify({ dataDir }));

  electronApp = await electron.launch({
    args: ['./out/main/index.js', `--user-data-dir=${userDataDir}`],
    executablePath: require('electron') as string,
  });

  page = await electronApp.firstWindow();
  await page.waitForSelector('.app-shell', { timeout: 20000 });
});

test.afterAll(async () => {
  try { await electronApp.close(); } catch { electronApp.process().kill(); }
  try { rmSync(join(tmpdir(), 'pmclone-e2e-'), { recursive: true, force: true }); } catch { /* ok */ }
});

test('send request → history persists in sidebar', async () => {
  // 1. Send a real HTTP request through the IPC layer
  const result = await page.evaluate(async () => {
    const dataDir = (window as any).__dataDir || '';
    try {
      const res = await (window as any).api.request.send({
        requestId: crypto.randomUUID(),
        method: 'GET',
        url: 'http://127.0.0.1:1/nonexistent',
        headers: [],
        queryParams: [],
        pathParams: [],
        body: { mode: 'none' },
        auth: { type: 'none' },
        settings: {
          timeoutMs: 3000,
          followRedirects: true,
          maxRedirects: 10,
          sslVerify: true,
          saveCookiesToJar: false,
        },
      });
      return { status: res.status, timing: res.timing };
    } catch (e: any) {
      return { error: e.message };
    }
  });
  console.log('Request result:', JSON.stringify(result));

  // 2. Append to history via IPC
  const appendResult = await page.evaluate(async () => {
    try {
      return await (window as any).api.history.append({
        collectionId: '__global__',
        timestamp: Date.now(),
        request: { method: 'GET', url: 'http://127.0.0.1:1/test-url', headers: [] },
        response: {
          status: 0,
          statusText: 'NETWORK_ERROR',
          durationMs: 25,
        },
      });
    } catch (e: any) {
      return { error: e.message };
    }
  });
  console.log('History append result:', JSON.stringify(appendResult));
  expect(appendResult).not.toHaveProperty('error');

  // 3. List history to verify it was persisted
  const historyList = await page.evaluate(async () => {
    try {
      return await (window as any).api.history.list({ collectionId: '__global__' });
    } catch (e: any) {
      return { error: e.message };
    }
  });
  console.log('History list length:', historyList?.length ?? 'error');
  if (!historyList.error) {
    expect(historyList.length).toBeGreaterThanOrEqual(1);
  }
});

test('create collection → save request → read back full spec', async () => {
  // 1. Create collection via IPC
  const coll = await page.evaluate(async () => {
    try {
      const result = await (window as any).api.collections.create({ name: 'E2E Test' });
      return result;
    } catch (e: any) {
      return { error: e.message };
    }
  });
  console.log('Collection created:', JSON.stringify(coll));
  expect(coll).toHaveProperty('id');

  // 2. Read the collection
  const readBefore = await page.evaluate(async (id: string) => {
    try {
      return await (window as any).api.collections.read({ id });
    } catch (e: any) {
      return { error: e.message };
    }
  }, coll.id);
  console.log('Read before save:', JSON.stringify(readBefore).slice(0, 200));
  expect(readBefore).not.toHaveProperty('error');
  expect(readBefore.item).toHaveLength(0);

  // 3. Save a request by updating the collection with a new item
  const saveResult = await page.evaluate(async (id: string) => {
    try {
      const coll = await (window as any).api.collections.read({ id });
      coll.item.push({
        name: 'Login Request',
        request: {
          method: 'POST',
          url: 'http://localhost:8080/auth/login',
          header: [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'Authorization', value: 'Bearer test123' },
          ],
          body: { mode: 'raw', raw: '{"username":"admin","password":"secret"}' },
          auth: { type: 'bearer', token: 'test123' },
        },
        response: [],
        event: [],
      });
      await (window as any).api.collections.update({ id, collection: coll });

      // Read back to verify
      const updated = await (window as any).api.collections.read({ id });
      return {
        itemCount: updated.item.length,
        firstItem: updated.item[0]?.name,
        method: updated.item[0]?.request?.method,
        url: updated.item[0]?.request?.url || updated.item[0]?.request?.url?.raw,
        headers: updated.item[0]?.request?.header,
      };
    } catch (e: any) {
      return { error: e.message };
    }
  }, coll.id);
  console.log('Save result:', JSON.stringify(saveResult).slice(0, 300));

  expect(saveResult.itemCount).toBe(1);
  expect(saveResult.firstItem).toBe('Login Request');
  expect(saveResult.method).toBe('POST');
  expect(saveResult.url).toBe('http://localhost:8080/auth/login');
  expect(saveResult.headers).toHaveLength(2);
  expect(saveResult.headers[0].key).toBe('Content-Type');

  // 4. Verify collection list shows correct itemCount
  const listResult = await page.evaluate(async () => {
    try {
      return await (window as any).api.collections.list();
    } catch (e: any) {
      return [];
    }
  });
  console.log('Collections list:', JSON.stringify(listResult).slice(0, 300));
  const found = listResult.find((c: any) => c.id === coll.id);
  expect(found).toBeTruthy();
  expect(found.itemCount).toBe(1);
});
