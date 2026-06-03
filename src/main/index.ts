import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'node:path';
import log from 'electron-log/main.js';
import { registerIpcRouter } from './ipc/router.js';
import { Supervisor } from './jvm/supervisor.js';
import { ensureDirs, getLogsDir, getBundledHelperJarPath, getHelperJarPath } from './storage/paths.js';
import { atomicWrite } from './storage/atomicWrite.js';

log.initialize();
log.transports.file.level = 'info';
log.transports.file.maxSize = 10 * 1024 * 1024;

const supervisor = new Supervisor();

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return win;
}

app.whenReady().then(async () => {
  try {
    ensureDirs();
    log.info('app ready, starting supervisor');
  } catch (err) {
    log.error('failed to setup', err);
  }

  registerIpcRouter(supervisor);
  mainWindow = createMainWindow();

  supervisor.on('status', (status) => {
    mainWindow?.webContents.send('helper:status', status);
  });

  supervisor.init().catch((err) => {
    log.error('supervisor init failed', err);
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', async () => {
  log.info('app quitting, shutting down helper');
  supervisor.shutdown();
});