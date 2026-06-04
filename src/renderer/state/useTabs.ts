import { create } from 'zustand';

export interface Tab {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  url: string;
  body: { mode: 'none' } | { mode: 'raw'; contentType: string; text: string };
}

let nextTabId = 1;
function newTabId(): string {
  return `tab-${nextTabId++}`;
}

interface TabsState {
  openTabs: Tab[];
  activeTabId: string | null;
  addTab: (partial?: Partial<Tab>) => string;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, partial: Partial<Tab>) => void;
}

const defaultTab: Tab = {
  id: newTabId(),
  method: 'GET',
  url: '',
  body: { mode: 'none' },
};

export const useTabs = create<TabsState>((set, get) => ({
  openTabs: [{ ...defaultTab, id: newTabId() }],
  activeTabId: null,

  addTab: (partial?: Partial<Tab>) => {
    const id = newTabId();
    const tab: Tab = { ...defaultTab, id, ...partial };
    set((state) => ({
      openTabs: [...state.openTabs, tab],
      activeTabId: id,
    }));
    return id;
  },

  closeTab: (id: string) => {
    set((state) => {
      const idx = state.openTabs.findIndex((t) => t.id === id);
      const openTabs = state.openTabs.filter((t) => t.id !== id);
      let activeTabId = state.activeTabId;
      if (state.activeTabId === id) {
        if (openTabs.length > 0) {
          // Activate the adjacent tab
          const newIdx = Math.min(idx, openTabs.length - 1);
          activeTabId = openTabs[newIdx].id;
        } else {
          activeTabId = null;
        }
      }
      return { openTabs, activeTabId };
    });
  },

  setActiveTab: (id: string) => set({ activeTabId: id }),

  updateTab: (id: string, partial: Partial<Tab>) => {
    set((state) => ({
      openTabs: state.openTabs.map((t) => (t.id === id ? { ...t, ...partial } : t)),
    }));
  },
}));

// Initialize activeTabId after mount
useTabs.subscribe((state) => {
  if (state.openTabs.length > 0 && state.activeTabId === null) {
    useTabs.setState({ activeTabId: state.openTabs[0].id });
  }
});
