import { create } from 'zustand';

interface SettingsState {
  theme: 'system' | 'dark' | 'light';
  dataDir: string;
  firstRun: boolean;
  setTheme: (theme: 'system' | 'dark' | 'light') => void;
  setDataDir: (dataDir: string) => void;
  setFirstRun: (firstRun: boolean) => void;
  hydrateFromBootstrap: (result: {
    theme: 'system' | 'dark' | 'light';
    dataDir: string;
    firstRun: boolean;
  }) => void;
}

export const useSettings = create<SettingsState>((set) => ({
  theme: 'system',
  dataDir: '',
  firstRun: true,

  setTheme: (theme) => set({ theme }),
  setDataDir: (dataDir) => set({ dataDir }),
  setFirstRun: (firstRun) => set({ firstRun }),

  hydrateFromBootstrap: (result) =>
    set({
      theme: result.theme,
      dataDir: result.dataDir,
      firstRun: result.firstRun,
    }),
}));
