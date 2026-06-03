import { app, ipcMain, dialog } from 'electron';
import log from 'electron-log/main.js';
import { getDataDir, setDataDir, getSettings } from '../storage/settings.js';
import { detectCloudSync } from '../cloudSync.js';
import { getUserDataPath } from '../storage/paths.js';
import { findJava } from '../jvm/jdkDetect.js';
import { getHelperStatus, restartHelper } from '../jvm/supervisor.js';
import { sendRequest } from '../http/undiciClient.js';
import {
  AppBootstrapResultSchema, SetDataDirArgsSchema, SetDataDirResultSchema,
  ShowOpenDialogArgsSchema, ShowOpenDialogResultSchema,
  HelperGetStatusResultSchema, HelperRestartResultSchema,
  RequestDiagnoseArgsSchema, RequestDiagnoseResultSchema,
  RequestSpecSchema, ResponseResultSchema,
  CancelRequestArgsSchema, ParseCurlArgsSchema, ParseCurlResultSchema,
  ShowSaveDialogArgsSchema, ShowSaveDialogResultSchema
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
      const result = await sendRequest(
        { url: 'http://127.0.0.1:65535/.well-known/postmanclone-probe', timeoutMs: 3000 },
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
      return ResponseResultSchema.parse({ ...result, requestId: spec.requestId });
    } catch (err) {
      pendingRequests.delete(spec.requestId);
      throw err;
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

  ipcMain.handle('app:showSaveDialog', async (_, args) => {
    const parsed = ShowSaveDialogArgsSchema.parse(args);
    const result = await dialog.showSaveDialog({
      title: parsed.title,
      defaultPath: parsed.defaultPath,
      filters: parsed.filters,
    });
    return ShowSaveDialogResultSchema.parse({ path: result.canceled ? null : result.filePath });
  });
}