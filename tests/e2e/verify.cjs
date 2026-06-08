const { _electron: electron } = require('playwright');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');

(async () => {
  const baseDir = mkdtempSync(join(tmpdir(), 'pmcheck-'));
  const userDataDir = join(baseDir, 'userData');
  const dataDir = join(baseDir, 'data');
  mkdirSync(userDataDir, { recursive: true });
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(userDataDir, 'settings.json'), JSON.stringify({ dataDir }));

  const app = await electron.launch({
    args: ['./out/main/index.js', `--user-data-dir=${userDataDir}`],
    executablePath: require('electron'),
  });

  const page = await app.firstWindow();
  await page.waitForSelector('.app-shell', { timeout: 20000 });
  console.log('✓ APP LOADED');

  // 1. Sidebar groups
  const text = await page.textContent('.app-shell');
  console.log('1. Sidebar groups visible:', {
    collections: text.includes('Collections'),
    environments: text.includes('environments'),
    history: text.includes('history'),
    variables: text.includes('variables'),
  });

  // 2. URL input
  const urlInput = page.getByPlaceholder(/example\.com/);
  console.log('2. URL input visible:', await urlInput.isVisible().catch(() => false));

  // 3. Send button
  const sendBtn = page.getByRole('button', { name: 'Send' });
  console.log('3. Send button visible:', await sendBtn.isVisible().catch(() => false));

  // 4. Method picker
  const methodPicker = page.locator('select').first();
  console.log('4. Method picker:', await methodPicker.inputValue().catch(() => 'error'));

  // 5. Sub-tabs
  for (const tab of ['Params', 'Headers', 'Body', 'Auth', 'Settings']) {
    const btn = page.getByRole('button', { name: tab }).first();
    const v = await btn.isVisible().catch(() => false);
    console.log(`5. Sub-tab ${tab}:`, v);
  }

  // 6. Send request — check ResponseViewer specifically
  await urlInput.fill('http://httpbin.org/get');
  await page.keyboard.press('Control+Enter');
  await page.waitForTimeout(4000);
  const fullText = await page.evaluate(() => document.body.innerText);
  // Response area shows status code or the response body
  const hasStatus = fullText.includes('200') && fullText.includes('httpbin');
  const hasError = fullText.includes('0') || fullText.includes('error');
  console.log('6. Send result:', { hasStatus, hasError, snippet: fullText.substring(0, 500) });

  // 7. Create collection via IPC
  const createResult = await page.evaluate(async () => {
    return await window.api.collections.create({ name: 'Verification Test' });
  });
  console.log('7. Collection created:', createResult.id ? 'OK' : 'FAILED');

  // Wait a bit for TanStack to refetch
  await page.waitForTimeout(1500);
  console.log('8. Collection in sidebar:', (await page.textContent('.app-shell')).includes('Verification Test'));

  // 9. Save request to collection with full spec
  const saveResult = await page.evaluate(async () => {
    const list = await window.api.collections.list();
    if (list.length === 0) return { error: 'no collections' };
    const coll = await window.api.collections.read({ id: list[0].id });
    coll.item.push({
      name: 'Login POST',
      request: {
        method: 'POST',
        url: 'http://localhost:8080/auth/login',
        header: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'X-API-Key', value: 'sk-test-123' },
        ],
        body: { mode: 'raw', raw: '{"username":"admin","password":"s3cret"}' },
      },
      response: [],
      event: [],
    });
    await window.api.collections.update({ id: list[0].id, collection: coll });
    const updated = await window.api.collections.read({ id: list[0].id });
    const item = updated.item?.[0];
    return {
      itemCount: updated.item?.length,
      name: item?.name,
      method: item?.request?.method,
      url: item?.request?.url?.raw || item?.request?.url,
      headers: item?.request?.header?.length,
      hasBody: !!item?.request?.body?.raw,
    };
  });
  console.log('9. Saved request:', JSON.stringify(saveResult));

  // 10. ItemCount in list
  const listCheck = await page.evaluate(async () => {
    const list = await window.api.collections.list();
    return list.map((c) => ({ name: c.name, itemCount: c.itemCount }));
  });
  console.log('10. Collections list with itemCount:', JSON.stringify(listCheck));

  // 11. History: append + list
  await page.evaluate(async () => {
    await window.api.history.append({
      collectionId: '__global__',
      timestamp: Date.now(),
      request: { method: 'GET', url: 'http://httpbin.org/health', headers: [] },
      response: { status: 200, statusText: 'OK', durationMs: 45 },
    });
  });
  const hist = await page.evaluate(async () => {
    return await window.api.history.list({ collectionId: '__global__' });
  });
  console.log('11. History entries persisted:', hist?.length ?? 0);

  // 12. History auth masking
  await page.evaluate(async () => {
    await window.api.history.append({
      collectionId: '__global__',
      timestamp: Date.now(),
      request: {
        method: 'POST',
        url: 'http://localhost/api',
        headers: [
          { key: 'Authorization', value: 'Bearer super-secret-token-12345' },
          { key: 'Content-Type', value: 'application/json' },
        ],
      },
      response: { status: 201, statusText: 'Created', durationMs: 80 },
    });
  });
  const hist2 = await page.evaluate(async () => {
    const entries = await window.api.history.list({ collectionId: '__global__' });
    const last = entries[0];
    const authHeader = last?.request?.headers?.find((h) => h.key === 'Authorization');
    return {
      totalEntries: entries.length,
      authValue: authHeader?.value,
    };
  });
  console.log('12. History auth masking:', JSON.stringify(hist2));

  // 13. Environments create
  const envResult = await page.evaluate(async () => {
    try {
      const r = await window.api.environments.create({
        name: 'Development',
        values: [],
      });
      const list = await window.api.environments.list();
      return { created: !!r.id, listLength: list.length };
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log('13. Environment created:', JSON.stringify(envResult));

  // 14. Variable resolution — pass with url as z.string() now
  const varResult = await page.evaluate(async () => {
    try {
      const r = await window.api.variables.resolve({
        spec: {
          requestId: '550e8400-e29b-41d4-a716-446655440000',
          method: 'GET',
          url: '{{host}}/api/users',
          headers: [{ key: 'X-Token', value: '{{token}}', enabled: true }],
          queryParams: [],
          pathParams: [],
          body: { mode: 'none' },
          auth: { type: 'none' },
          settings: { timeoutMs: 30000, followRedirects: true, maxRedirects: 10, sslVerify: true, saveCookiesToJar: false },
        },
        activeEnvId: null,
        activeCollectionId: null,
        globals: [
          { key: 'host', value: 'http://localhost:8080' },
          { key: 'token', value: 'abc123' },
        ],
      });
      return {
        resolvedUrl: r.resolved.url,
        resolvedHeader: r.resolved.headers[0]?.value,
        unresolved: r.unresolved,
      };
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log('14. Variable resolution:', JSON.stringify(varResult));

  // 15. cURL generate
  const curlResult = await page.evaluate(async () => {
    try {
      const r = await window.api.curl.generate({
        spec: {
          requestId: '550e8400-e29b-41d4-a716-446655440000',
          method: 'POST',
          url: 'http://example.com/api',
          headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
          queryParams: [{ key: 'sort', value: 'desc', enabled: true }],
          pathParams: [],
          body: { mode: 'raw', contentType: 'application/json', text: '{"key":"val"}' },
          auth: { type: 'basic', username: 'admin', password: 'pass' },
          settings: { timeoutMs: 30000, followRedirects: true, maxRedirects: 10, sslVerify: true, saveCookiesToJar: false },
        },
        resolvedUrl: 'http://example.com/api?sort=desc',
      });
      return r.curl.substring(0, 200);
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log('15. cURL generated:', curlResult);

  // Screenshot
  await page.screenshot({ path: 'test-results/verification.png' });
  console.log('Screenshot: test-results/verification.png');

  await app.close();
  try { rmSync(baseDir, { recursive: true, force: true }); } catch(e) {}
  console.log('\n=== VERIFICATION COMPLETE ===');
})();
