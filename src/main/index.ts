import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import log from './logging/log.js';
import { registerIpcRouter } from './ipc/router.js';
import { supervisor } from './jvm/supervisor.js';
import { ensureDirs } from './storage/paths.js';
import { createMainWindow } from './window.js';

let mainWindow: BrowserWindow | null = null;

app.whenReady().then(async () => {
  try {
    ensureDirs();
    log.info('app ready, starting supervisor');
  } catch (err) {
    log.error('failed to setup', err);
  }

  registerIpcRouter();
  mainWindow = createMainWindow();

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

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