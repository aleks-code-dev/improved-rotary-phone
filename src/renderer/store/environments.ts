import { create } from 'zustand';

interface EnvironmentsStore {
  environments: Map<string, { id: string; name: string; active: boolean }>;
  activeEnvId: string | null;
  setActiveEnv: (id: string | null) => void;
  setEnvironments: (list: Array<{ id: string; name: string; active: boolean }>) => void;
}

export const useEnvironmentsStore = create<EnvironmentsStore>((set) => ({
  environments: new Map(),
  activeEnvId: null,

  setActiveEnv: (id) => {
    set({ activeEnvId: id });
    // Persist via IPC
    window.api.environments.setActive({ id });
  },

  setEnvironments: (list) => {
    const map = new Map<string, { id: string; name: string; active: boolean }>();
    for (const item of list) map.set(item.id, item);
    set({ environments: map });
  },
}));
