import { app, ipcMain, dialog } from 'electron';
import { writeFile as fsWriteFile } from 'node:fs/promises';
import * as path from 'node:path';
import log from 'electron-log/main.js';
import { getDataDir, setDataDir, getSettings } from '../storage/settings.js';
import { detectCloudSync } from '../cloudSync.js';
import { getUserDataPath } from '../storage/paths.js';
import { findJava } from '../jvm/jdkDetect.js';
import { getHelperStatus, restartHelper } from '../jvm/supervisor.js';
import { sendRequest, probeRequest } from '../http/undiciClient.js';
import { generateCurl, parseCurl } from '../http/curlGen.js';
import {
  AppBootstrapResultSchema, SetDataDirArgsSchema, SetDataDirResultSchema,
  ShowOpenDialogArgsSchema, ShowOpenDialogResultSchema,
  HelperGetStatusResultSchema, HelperRestartResultSchema,
  RequestDiagnoseArgsSchema, RequestDiagnoseResultSchema,
  RequestSpecSchema, ResponseResultSchema,
  CancelRequestArgsSchema, ParseCurlArgsSchema, ParseCurlResultSchema,
  ShowSaveDialogArgsSchema, ShowSaveDialogResultSchema,
  WriteFileArgsSchema, WriteFileResultSchema
} from './channels.js';

const pendingRequests = new Map<string, AbortController>();

export function registerIpcRouter() {
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
    });
  });

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

  ipcMain.handle('helper:getStatus', async () => {
    return HelperGetStatusResultSchema.parse(getHelperStatus());
  });

  ipcMain.handle('helper:restart', async () => {
    const status = await restartHelper();
    return HelperRestartResultSchema.parse(status);
  });

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
      // sendRequest never throws raw — but handle unexpected throws gracefully
      const message = err instanceof Error ? err.message : 'Unknown error';
      log.error('request:send unhandled error', { requestId: spec.requestId, error: message });
      return ResponseResultSchema.parse({
        requestId: spec.requestId,
        status: 0,
        statusText: 'INTERNAL_ERROR',
        httpVersion: '',
        headers: [],
        bodyBase64: '',
        bodyTruncated: false,
        bodySizeBytes: 0,
        timing: { dns: 0, connect: 0, tls: 0, request: 0, wait: 0, response: 0, total: 0 },
        cookies: [],
        startedAt: Date.now(),
        completedAt: Date.now(),
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
    // Re-validate the returned spec through Zod
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

    // Path traversal protection (T-02-08): only allow writes inside dataDir or downloads
    const resolved = path.resolve(parsed.path);
    const allowedRoots: string[] = [downloadsDir];
    if (dataDir) {
      allowedRoots.push(dataDir);
    }
    const isAllowed = allowedRoots.some(
      (root) => resolved.startsWith(path.resolve(root) + path.sep) || resolved === path.resolve(root)
    );

    if (!isAllowed) {
      log.warn('app:writeFile path rejected', { path: parsed.path, resolved });
      return WriteFileResultSchema.parse({ ok: false });
    }

    try {
      // Ensure parent directory exists
      const dir = path.dirname(resolved);
      await fsWriteFile(resolved, Buffer.from(parsed.dataBase64, 'base64'));
      return WriteFileResultSchema.parse({ ok: true });
    } catch (err) {
      log.error('app:writeFile failed', { path: resolved, error: err instanceof Error ? err.message : String(err) });
      return WriteFileResultSchema.parse({ ok: false });
    }
  });
}
