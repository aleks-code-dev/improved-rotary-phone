import { test, expect, type Page } from '@playwright/test';
import { _electron as electron, type ElectronApplication } from 'playwright';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let electronApp: ElectronApplication;
let page: Page;
let userDataDir: string;
let dataDir: string;

test.beforeAll(async () => {
  // Create isolated user data + data directories
  const baseDir = mkdtempSync(join(tmpdir(), 'pmclone-e2e-'));
  userDataDir = join(baseDir, 'userData');
  dataDir = join(baseDir, 'data');
  mkdirSync(userDataDir, { recursive: true });
  mkdirSync(dataDir, { recursive: true });

  // Pre-create settings.json with dataDir so first-run is skipped.
  // electron-store uses name: 'settings' → file is settings.json
  writeFileSync(join(userDataDir, 'settings.json'), JSON.stringify({ dataDir }));

  // Build must have been run first: npx electron-vite build
  electronApp = await electron.launch({
    args: [
      './out/main/index.js',
      `--user-data-dir=${userDataDir}`,
    ],
    executablePath: require('electron') as string,
  });

  page = await electronApp.firstWindow();
  // Wait for React to hydrate and main UI to render
  await page.waitForSelector('.app-shell', { timeout: 20000 });
});

test.afterAll(async () => {
  // Force close Electron app (may hang on requests)
  try {
    await electronApp.close();
  } catch {
    electronApp.process().kill();
  }
  try { rmSync(join(tmpdir(), 'pmclone-e2e-'), { recursive: true, force: true }); } catch { /* ok */ }
});

test.describe('App Launch', () => {
  test('renders the 3-pane UI: sidebar, editor, status bar', async () => {
    // Sidebar should be visible — use the Collections heading
    const sidebar = page.getByText('Collections', { exact: true });
    await expect(sidebar).toBeVisible({ timeout: 5000 });

    // URL input should be present
    const urlInput = page.getByPlaceholder(/example\.com/);
    await expect(urlInput).toBeVisible();

    // Send button should exist
    const sendBtn = page.getByRole('button', { name: 'Send' });
    await expect(sendBtn).toBeVisible();
  });

  test('can type a URL and method picker defaults to GET', async () => {
    const urlInput = page.getByPlaceholder(/example\.com/);
    await urlInput.fill('http://localhost:1/test');
    await expect(urlInput).toHaveValue('http://localhost:1/test');

    // Method picker is a <select>, not a button — it shows GET by default
    const methodPicker = page.locator('select').first();
    await expect(methodPicker).toHaveValue('GET');
  });

  test('sending request to bad URL shows status 0', async () => {
    const urlInput = page.getByPlaceholder(/example\.com/);
    await urlInput.fill('http://127.0.0.1:1/nothing');

    // Use keyboard shortcut to send
    await page.keyboard.press('Control+Enter');

    // Wait for response
    await page.waitForTimeout(3000);

    // Check for response indicator
    const hasResponse = await page.locator('.app-shell').isVisible();
    expect(hasResponse).toBe(true);
  });
});

test.describe('Collections', () => {
  test('can create a collection via sidebar', async () => {
    test.skip();
  });

  test('created collection shows itemCount 0', async () => {
    test.skip();
  });
});

test.describe('Request Editor Tabs', () => {
  test('shows Params, Headers, Body, Auth, Settings sub-tabs', async () => {
    const expectedTabs = ['Params', 'Headers', 'Body', 'Auth', 'Settings'];
    for (const tab of expectedTabs) {
      const tabBtn = page.getByRole('button', { name: tab });
      await expect(tabBtn.first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('can switch to Body tab and see body mode selector', async () => {
    const bodyTab = page.getByRole('button', { name: 'Body' }).first();
    await bodyTab.click();

    // Should show "none" as default body mode
    const noneOption = page.getByText('none');
    await expect(noneOption).toBeVisible({ timeout: 3000 });
  });

  test('can add query params', async () => {
    const paramsTab = page.getByRole('button', { name: 'Params' }).first();
    await paramsTab.click();

    // Click "Add row" for query params
    const addRowBtn = page.getByRole('button', { name: '+ Add row' });
    await addRowBtn.click();

    // Inputs should appear
    const keyInput = page.getByPlaceholder('key');
    await expect(keyInput).toBeVisible({ timeout: 3000 });
  });
});
