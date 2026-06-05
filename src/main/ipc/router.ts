import { app, ipcMain, dialog, shell } from 'electron';
import { writeFile as fsWriteFile, readFile as fsReadFile, mkdir as fsMkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import log from 'electron-log/main.js';
import { getDataDir, setDataDir, getSettings, setSetting } from '../storage/settings.js';
import { detectCloudSync } from '../cloudSync.js';
import { getUserDataPath, getGlobalsPath } from '../storage/paths.js';
import { findJava } from '../jvm/jdkDetect.js';
import { getHelperStatus, restartHelper } from '../jvm/supervisor.js';
import { sendRequest, probeRequest } from '../http/undiciClient.js';
import { generateCurl, parseCurl } from '../http/curlGen.js';
import * as collectionsService from '../storage/collections.js';
import * as environmentsService from '../storage/environments.js';
import * as historyService from '../storage/history.js';
import { resolveVariables } from '../storage/variable-resolver.js';
import { importPostmanCollection, exportPostmanCollection } from '../storage/import-export.js';
import { generateCurl as storageGenerateCurl, parseCurl as storageParseCurl } from '../storage/curl.js';
import { approveQuit } from './quitState.js';
import { writeFileAtomic } from '../storage/atomicWrite.js';
import { supervisor } from '../jvm/supervisor.js';
import {
  AppBootstrapResultSchema, SetDataDirArgsSchema, SetDataDirResultSchema,
  ShowOpenDialogArgsSchema, ShowOpenDialogResultSchema,
  HelperGetStatusResultSchema, HelperRestartResultSchema,
  RequestDiagnoseArgsSchema, RequestDiagnoseResultSchema,
  RequestSpecSchema, ResponseResultSchema,
  CancelRequestArgsSchema, ParseCurlArgsSchema, ParseCurlResultSchema,
  ShowSaveDialogArgsSchema, ShowSaveDialogResultSchema,
  WriteFileArgsSchema, WriteFileResultSchema,
  CollectionsListResultSchema,
  CollectionReadArgsSchema, CollectionCreateArgsSchema, CollectionCreateResultSchema,
  CollectionUpdateArgsSchema, CollectionDeleteArgsSchema,
  EnvironmentsListResultSchema,
  EnvironmentReadArgsSchema, EnvironmentCreateArgsSchema, EnvironmentCreateResultSchema,
  EnvironmentUpdateArgsSchema, EnvironmentDeleteArgsSchema, EnvironmentSetActiveArgsSchema,
  HistoryListArgsSchema, HistoryAppendArgsSchema, HistoryDeleteArgsSchema,
  VariablesResolveArgsSchema, VariablesResolveResultSchema,
  ImportPostmanArgsSchema, ImportPostmanResultSchema,
  ExportPostmanArgsSchema, ExportPostmanResultSchema,
  CurlImportArgsSchema, CurlImportResultSchema,
  CurlGenerateArgsSchema, CurlGenerateResultSchema,
  NetworkDiagnoseResultSchema,
  StateSaveArgsSchema, ConfirmQuitArgsSchema,
  GlobalsUpdateArgsSchema,
  ReadFileArgsSchema,
  DtoGenerateArgsSchema, DtoGenerateResultSchema,
} from './channels.js';

const pendingRequests = new Map<string, AbortController>();

export function registerIpcRouter() {
  // --- 01-01: Bootstrap ---
  ipcMain.handle('app:bootstrap', async () => {
    const jdk = findJava();
    const settings = getSettings();
    const dataDir = getDataDir();
    const helperStatus = getHelperStatus();
    return AppBootstrapResultSchema.parse({
      firstRun: !settings.dataDir,
      userDataPath: getUserDataPath(),
      dataDir: dataDir || getUserDataPath(),
      theme: settings.theme || 'system',
      helper: helperStatus,
      jdkFound: jdk !== null,
      jdkPath: jdk?.path ?? null,
      savedTabs: (settings.savedTabs as any[]) ?? [],
      activeTabId: (settings.activeTabId as string) ?? null,
    });
  });

  // --- 01-01: Settings ---
  ipcMain.handle('app:setDataDir', async (_, args) => {
    const parsed = SetDataDirArgsSchema.parse(args);
    const cloudSync = detectCloudSync(parsed.path);
    setDataDir(parsed.path);
    return SetDataDirResultSchema.parse({ ok: true, cloudSync });
  });

  ipcMain.handle('app:showOpenDialog', async (_, args) => {
    const parsed = ShowOpenDialogArgsSchema.parse(args);
    const result = await dialog.showOpenDialog({
      properties: [parsed.kind === 'folder' ? 'openDirectory' : 'openFile'],
      title: parsed.title,
    });
    return ShowOpenDialogResultSchema.parse({ path: result.canceled ? null : result.filePaths[0] });
  });

  ipcMain.handle('app:showSaveDialog', async (_, args) => {
    const parsed = ShowSaveDialogArgsSchema.parse(args);
    const result = await dialog.showSaveDialog({
      title: parsed.title,
      defaultPath: parsed.defaultPath,
      filters: parsed.filters,
    });
    return ShowSaveDialogResultSchema.parse({ path: result.canceled ? null : result.filePath });
  });

  ipcMain.handle('app:writeFile', async (_, args) => {
    const parsed = WriteFileArgsSchema.parse(args);
    const dataDir = getDataDir();
    const downloadsDir = app.getPath('downloads');
    const resolved = path.resolve(parsed.path);
    const allowedRoots: string[] = [downloadsDir];
    if (dataDir) allowedRoots.push(dataDir);
    const isAllowed = allowedRoots.some(
      (root) => resolved.startsWith(path.resolve(root) + path.sep) || resolved === path.resolve(root)
    );
    if (!isAllowed) {
      log.warn('app:writeFile path rejected', { path: parsed.path, resolved });
      return WriteFileResultSchema.parse({ ok: false });
    }
    try {
      await fsWriteFile(resolved, Buffer.from(parsed.dataBase64, 'base64'));
      return WriteFileResultSchema.parse({ ok: true });
    } catch (err) {
      log.error('app:writeFile failed', { path: resolved, error: err instanceof Error ? err.message : String(err) });
      return WriteFileResultSchema.parse({ ok: false });
    }
  });

  // --- 01-03: Read file ---
  ipcMain.handle('app:readFile', async (_, args) => {
    const parsed = ReadFileArgsSchema.parse(args);
    try {
      const text = await fsReadFile(parsed.path, 'utf-8');
      return { ok: true, text };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });

  // --- 01-03: Open data folder ---
  ipcMain.handle('app:openDataFolder', async () => {
    const dataDir = getDataDir() || getUserDataPath();
    await shell.openPath(dataDir);
    return { ok: true };
  });

  // --- 01-01: Helper ---
  ipcMain.handle('helper:getStatus', async () => {
    return HelperGetStatusResultSchema.parse(getHelperStatus());
  });

  ipcMain.handle('helper:restart', async () => {
    const status = await restartHelper();
    return HelperRestartResultSchema.parse(status);
  });

  // --- 01-01/01-02: Request ---
  ipcMain.handle('request:diagnose', async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const result = await probeRequest(
        'http://127.0.0.1:65535/.well-known/postmanclone-probe',
        3000,
        controller.signal
      );
      clearTimeout(timeout);
      return RequestDiagnoseResultSchema.parse(result);
    } catch (err) {
      clearTimeout(timeout);
      return RequestDiagnoseResultSchema.parse({
        ok: false,
        error: { code: 'TIMEOUT', message: 'Connection timed out' },
        timing: { dns: 0, connect: 0, tls: 0, request: 0, wait: 0, response: 0, total: 3000 },
        target: { url: 'http://127.0.0.1:65535/.well-known/postmanclone-probe', host: '127.0.0.1', port: 65535 },
      });
    }
  });

  ipcMain.handle('request:send', async (_, args) => {
    const spec = RequestSpecSchema.parse(args);
    const controller = new AbortController();
    pendingRequests.set(spec.requestId, controller);
    try {
      const result = await sendRequest(spec, controller.signal);
      pendingRequests.delete(spec.requestId);
      return ResponseResultSchema.parse(result);
    } catch (err) {
      pendingRequests.delete(spec.requestId);
      const message = err instanceof Error ? err.message : 'Unknown error';
      log.error('request:send unhandled error', { requestId: spec.requestId, error: message });
      return ResponseResultSchema.parse({
        requestId: spec.requestId,
        status: 0, statusText: 'INTERNAL_ERROR', httpVersion: '',
        headers: [], bodyBase64: '', bodyTruncated: false, bodySizeBytes: 0,
        timing: { dns: 0, connect: 0, tls: 0, request: 0, wait: 0, response: 0, total: 0 },
        cookies: [], startedAt: Date.now(), completedAt: Date.now(),
      });
    }
  });

  ipcMain.handle('request:cancel', async (_, args) => {
    const parsed = CancelRequestArgsSchema.parse(args);
    const controller = pendingRequests.get(parsed.requestId);
    if (controller) {
      controller.abort('user-cancelled');
      pendingRequests.delete(parsed.requestId);
    }
    return { ok: true };
  });

  ipcMain.handle('request:parseCurl', async (_, args) => {
    const parsed = ParseCurlArgsSchema.parse(args);
    const result = parseCurl(parsed.text);
    if ('error' in result) {
      return ParseCurlResultSchema.parse({ ok: false as const, error: result.error });
    }
    const validated = RequestSpecSchema.safeParse(result);
    if (!validated.success) {
      return ParseCurlResultSchema.parse({
        ok: false as const,
        error: `Could not parse cURL: ${validated.error.issues.map(i => i.message).join(', ')}`,
      });
    }
    return ParseCurlResultSchema.parse({ ok: true as const, spec: validated.data });
  });

  ipcMain.handle('request:generateCurl', async (_, args) => {
    const spec = RequestSpecSchema.parse(args);
    const curl = generateCurl(spec);
    return { ok: true, curl };
  });

  // --- 01-03: Collections ---
  ipcMain.handle('collections:list', async () => {
    const list = await collectionsService.listCollections();
    return CollectionsListResultSchema.parse(list);
  });

  ipcMain.handle('collections:read', async (_, args) => {
    const parsed = CollectionReadArgsSchema.parse(args);
    return collectionsService.readCollection(parsed.id);
  });

  ipcMain.handle('collections:create', async (_, args) => {
    const parsed = CollectionCreateArgsSchema.parse(args);
    const result = await collectionsService.createCollection(parsed.name);
    return CollectionCreateResultSchema.parse(result);
  });

  ipcMain.handle('collections:update', async (_, args) => {
    const parsed = CollectionUpdateArgsSchema.parse(args);
    await collectionsService.updateCollection(parsed.id, parsed.collection);
    return { ok: true };
  });

  ipcMain.handle('collections:delete', async (_, args) => {
    const parsed = CollectionDeleteArgsSchema.parse(args);
    await collectionsService.deleteCollection(parsed.id);
    return { ok: true };
  });

  // --- 01-03: Environments ---
  ipcMain.handle('environments:list', async () => {
    const list = await environmentsService.listEnvironments();
    return EnvironmentsListResultSchema.parse(list);
  });

  ipcMain.handle('environments:read', async (_, args) => {
    const parsed = EnvironmentReadArgsSchema.parse(args);
    return environmentsService.readEnvironment(parsed.id);
  });

  ipcMain.handle('environments:create', async (_, args) => {
    const parsed = EnvironmentCreateArgsSchema.parse(args);
    const env = {
      id: randomUUID(),
      name: parsed.name,
      values: parsed.values,
      proxy: parsed.proxy,
      _postman_variable_scope: 'environment' as const,
    };
    await environmentsService.writeEnvironment(env);
    return EnvironmentCreateResultSchema.parse({ id: env.id });
  });

  ipcMain.handle('environments:update', async (_, args) => {
    const parsed = EnvironmentUpdateArgsSchema.parse(args);
    await environmentsService.writeEnvironment(parsed.env);
    return { ok: true };
  });

  ipcMain.handle('environments:delete', async (_, args) => {
    const parsed = EnvironmentDeleteArgsSchema.parse(args);
    await environmentsService.deleteEnvironment(parsed.id);
    return { ok: true };
  });

  ipcMain.handle('environments:setActive', async (_, args) => {
    const parsed = EnvironmentSetActiveArgsSchema.parse(args);
    await environmentsService.setActiveEnvironment(parsed.id);
    return { ok: true };
  });

  // --- 01-03: History ---
  ipcMain.handle('history:list', async (_, args) => {
    const parsed = HistoryListArgsSchema.parse(args);
    return historyService.listHistory(parsed.collectionId, parsed.search);
  });

  ipcMain.handle('history:append', async (_, args) => {
    const parsed = HistoryAppendArgsSchema.parse(args);
    return historyService.appendHistoryEntry(parsed.collectionId, {
      timestamp: parsed.timestamp,
      collectionId: parsed.collectionId,
      request: parsed.request as any,
      response: parsed.response as any,
    });
  });

  ipcMain.handle('history:delete', async (_, args) => {
    const parsed = HistoryDeleteArgsSchema.parse(args);
    await historyService.deleteHistoryEntry(parsed.collectionId, parsed.entryId);
    return { ok: true };
  });

  // --- 01-03: Variables ---
  ipcMain.handle('variables:resolve', async (_, args) => {
    const parsed = VariablesResolveArgsSchema.parse(args);

    // Build scopes from active env + active collection + globals
    const scopes: { local: Map<string, string>; data: Map<string, string>; env: Map<string, string>; collection: Map<string, string>; global: Map<string, string>; proxy?: string } = {
      local: new Map<string, string>(),
      data: new Map<string, string>(),
      env: new Map<string, string>(),
      collection: new Map<string, string>(),
      global: new Map<string, string>(),
    };

    // Load env scope
    if (parsed.activeEnvId) {
      try {
        const env = await environmentsService.readEnvironment(parsed.activeEnvId);
        for (const v of env.values) {
          if (v.enabled !== false) scopes.env.set(v.key, v.value);
        }
        scopes.proxy = env.proxy;
      } catch { /* env not found — skip */ }
    }

    // Load collection scope
    if (parsed.activeCollectionId) {
      try {
        const coll = await collectionsService.readCollection(parsed.activeCollectionId);
        for (const v of (coll.variable || [])) {
          const val = typeof v.value === 'string' ? v.value : JSON.stringify(v.value);
          scopes.collection.set(v.key, val);
        }
      } catch { /* collection not found — skip */ }
    }

    // Load globals
    for (const g of parsed.globals) {
      scopes.global.set(g.key, g.value);
    }

    const result = resolveVariables(parsed.spec, scopes);
    return VariablesResolveResultSchema.parse(result);
  });

  // --- 01-03: Import/Export ---
  ipcMain.handle('importExport:importPostman', async (_, args) => {
    const parsed = ImportPostmanArgsSchema.parse(args);
    const importResult = importPostmanCollection(parsed.jsonText);
    if (!importResult.ok) {
      return { ok: false, error: importResult.error };
    }
    // Write to disk via collectionsService
    const id = randomUUID();
    await collectionsService.updateCollection(id, importResult.collection);
    return ImportPostmanResultSchema.parse({ id, preview: importResult.preview });
  });

  ipcMain.handle('importExport:exportPostman', async (_, args) => {
    const parsed = ExportPostmanArgsSchema.parse(args);
    const coll = await collectionsService.readCollection(parsed.id);
    const exportResult = exportPostmanCollection(coll);
    if (!exportResult.ok) {
      return { ok: false, error: exportResult.error };
    }
    return ExportPostmanResultSchema.parse({ json: exportResult.json });
  });

  // --- 01-03: cURL ---
  ipcMain.handle('curl:import', async (_, args) => {
    const parsed = CurlImportArgsSchema.parse(args);
    const result = storageParseCurl(parsed.text);
    if (!result.ok) {
      return CurlImportResultSchema.parse({ ok: false as const, error: result.error });
    }
    const validated = RequestSpecSchema.safeParse(result.spec);
    if (!validated.success) {
      return CurlImportResultSchema.parse({
        ok: false as const,
        error: `Could not parse cURL: ${validated.error.issues.map(i => i.message).join(', ')}`,
      });
    }
    return CurlImportResultSchema.parse({ ok: true as const, spec: validated.data });
  });

  ipcMain.handle('curl:generate', async (_, args) => {
    const parsed = CurlGenerateArgsSchema.parse(args);
    const curl = storageGenerateCurl(parsed.spec, parsed.resolvedUrl);
    return CurlGenerateResultSchema.parse({ curl });
  });

  // --- 01-03: Network diagnose (D-34) ---
  ipcMain.handle('network:diagnose', async () => {
    // Try active env's first http(s) var, fallback to httpbin
    let targetUrl = 'https://httpbin.org/get';
    try {
      const settings = getSettings();
      const activeEnvId = settings.activeEnvId as string | undefined;
      if (activeEnvId) {
        const env = await environmentsService.readEnvironment(activeEnvId);
        for (const v of env.values) {
          if (v.enabled !== false && (v.value.startsWith('http://') || v.value.startsWith('https://'))) {
            targetUrl = v.value;
            break;
          }
        }
      }
    } catch { /* fallback to default */ }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const result = await probeRequest(targetUrl, 5000, controller.signal);
      clearTimeout(timeout);
      return NetworkDiagnoseResultSchema.parse(result);
    } catch (err: any) {
      clearTimeout(timeout);
      return NetworkDiagnoseResultSchema.parse({
        ok: false,
        error: { code: 'NETWORK_ERROR', message: err.message },
        timing: { dns: 0, connect: 0, tls: 0, request: 0, wait: 0, response: 0, total: 5000 },
        target: { url: targetUrl, host: '', port: 0 },
      });
    }
  });

  // --- 01-03: State save/restore (D-21) ---
  ipcMain.handle('state:save', async (_, args) => {
    const parsed = StateSaveArgsSchema.parse(args);
    setSetting('savedTabs', parsed.openTabs);
    setSetting('activeTabId', parsed.activeTabId);
    return { ok: true };
  });

  ipcMain.handle('app:confirmQuit', async (_, args) => {
    const parsed = ConfirmQuitArgsSchema.parse(args);
    if (parsed.canQuit) {
      approveQuit();
      app.quit();
    }
    return { ok: true };
  });

  // --- 01-03: Globals ---
  ipcMain.handle('globals:update', async (_, args) => {
    const parsed = GlobalsUpdateArgsSchema.parse(args);
    const globalsPath = getGlobalsPath();
    const dir = path.dirname(globalsPath);
    await fsMkdir(dir, { recursive: true });
    await writeFileAtomic(globalsPath, JSON.stringify({ values: parsed.values }, null, 2));
    return { ok: true };
  });

  ipcMain.handle('globals:read', async () => {
    try {
      const raw = await fsReadFile(getGlobalsPath(), 'utf-8');
      const parsed = JSON.parse(raw);
      return GlobalsUpdateArgsSchema.parse(parsed);
    } catch {
      return { values: [] };
    }
  });

  // --- 03-01: Body generation ---
  ipcMain.handle('body:generateDto', async (_, args) => {
    const parsed = DtoGenerateArgsSchema.parse(args);
    const client = supervisor.getClient();
    if (!client) return { ok: false, bodyJson: '', warnings: [{ code: 'HELPER_OFFLINE', message: 'Helper is offline' }], cycleRefs: [] };
    try {
      const bodyJson = await client.request('classpath:walkDto', { fqn: parsed.dtoFqn });
      // Detect $ref markers in the response
      const cycleRefs: string[] = [];
      try {
        const parsed_ = JSON.parse(bodyJson);
        findCycleRefs(parsed_, cycleRefs);
      } catch { /* not valid JSON — skip cycle detection */ }
      return DtoGenerateResultSchema.parse({
        ok: true,
        bodyJson,
        warnings: [],
        cycleRefs,
      });
    } catch (err: any) {
      log.error('body:generateDto failed', { error: err.message });
      return { ok: false, bodyJson: '', warnings: [{ code: 'DTO_WALK_FAILED', message: err.message }], cycleRefs: [] };
    }
  });
}

function findCycleRefs(obj: any, refs: string[]): void {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (const item of obj) findCycleRefs(item, refs);
    return;
  }
  if (obj['$ref'] && typeof obj['$ref'] === 'string') {
    if (!refs.includes(obj['$ref'])) refs.push(obj['$ref']);
  }
  for (const key of Object.keys(obj)) {
    findCycleRefs(obj[key], refs);
  }
}
