import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import log from './logging/log.js';
import { registerIpcRouter } from './ipc/router.js';
import { supervisor } from './jvm/supervisor.js';
import { ensureDirs } from './storage/paths.js';

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
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

  registerIpcRouter();
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