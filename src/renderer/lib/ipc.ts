import type { WindowApi } from '../../preload/index.ts';

// Re-export the WindowApi type for renderer consumption
export type { WindowApi };

// Typed wrapper around window.api for convenience
// All IPC calls go through the preload bridge (no direct ipcRenderer access)
export const api = {
  app: {
    bootstrap: () => window.api.app.bootstrap(),
    setDataDir: (args: { path: string }) => window.api.app.setDataDir(args),
    showOpenDialog: (args: { kind: 'folder' | 'file'; title?: string }) =>
      window.api.app.showOpenDialog(args),
  },
  helper: {
    getStatus: () => window.api.helper.getStatus(),
    restart: () => window.api.helper.restart(),
    onStatus: (cb: (status: unknown) => void) => window.api.helper.onStatus(cb),
  },
  request: {
    diagnose: () => window.api.request.diagnose(),
  },
};
