import { contextBridge, ipcRenderer } from 'electron';

export interface WindowApi {
  app: {
    bootstrap: () => Promise<any>;
    setDataDir: (args: { path: string }) => Promise<any>;
    showOpenDialog: (args: { kind: 'folder' | 'file'; title?: string }) => Promise<any>;
    showSaveDialog: (args: { title?: string; defaultPath?: string; filters?: Array<{name: string; extensions: string[]}> }) => Promise<any>;
    writeFile: (args: { path: string; dataBase64: string }) => Promise<any>;
  };
  helper: {
    getStatus: () => Promise<any>;
    restart: () => Promise<any>;
    onStatus: (cb: (status: any) => void) => () => void;
  };
  request: {
    diagnose: () => Promise<any>;
    send: (spec: any) => Promise<any>;
    cancel: (args: { requestId: string }) => Promise<any>;
    parseCurl: (text: string) => Promise<any>;
    generateCurl: (spec: any) => Promise<any>;
  };
}

const api: WindowApi = {
  app: {
    bootstrap: () => ipcRenderer.invoke('app:bootstrap'),
    setDataDir: (args) => ipcRenderer.invoke('app:setDataDir', args),
    showOpenDialog: (args) => ipcRenderer.invoke('app:showOpenDialog', args),
    showSaveDialog: (args) => ipcRenderer.invoke('app:showSaveDialog', args),
    writeFile: (args) => ipcRenderer.invoke('app:writeFile', args),
  },
  helper: {
    getStatus: () => ipcRenderer.invoke('helper:getStatus'),
    restart: () => ipcRenderer.invoke('helper:restart'),
    onStatus: (cb) => {
      const listener = (_: any, s: any) => cb(s);
      ipcRenderer.on('helper:status', listener);
      return () => ipcRenderer.off('helper:status', listener);
    },
  },
  request: {
    diagnose: () => ipcRenderer.invoke('request:diagnose'),
    send: (spec) => ipcRenderer.invoke('request:send', spec),
    cancel: (args) => ipcRenderer.invoke('request:cancel', args),
    parseCurl: (text) => ipcRenderer.invoke('request:parseCurl', text),
    generateCurl: (spec) => ipcRenderer.invoke('request:generateCurl', spec),
  },
};

contextBridge.exposeInMainWorld('api', api);