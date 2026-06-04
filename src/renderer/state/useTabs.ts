import { create } from 'zustand';

export interface Tab {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  url: string;
  body: { mode: 'none' } | { mode: 'raw'; contentType: string; text: string };
  isDirty?: boolean;
  sourceCollectionId?: string;
  sourceItemIndex?: number;
  sourceItemName?: string;
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
  reorderTabs: (sourceId: string, targetIndex: number) => void;
  hydrate: (savedTabs: Tab[], activeTabId: string | null) => void;
  markDirty: (id: string) => void;
  markClean: (id: string) => void;
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

  reorderTabs: (sourceId: string, targetIndex: number) => {
    set((state) => {
      const sourceIdx = state.openTabs.findIndex((t) => t.id === sourceId);
      if (sourceIdx === -1) return state;
      const tabs = [...state.openTabs];
      const [sourceTab] = tabs.splice(sourceIdx, 1);
      // targetIndex is the desired destination index
      const insertAt = Math.min(targetIndex, tabs.length);
      tabs.splice(insertAt, 0, sourceTab);
      return { openTabs: tabs };
    });
  },

  hydrate: (savedTabs: Tab[], activeTabId: string | null) => {
    if (savedTabs.length > 0) {
      set({ openTabs: savedTabs, activeTabId: activeTabId ?? savedTabs[0].id });
    }
  },

  markDirty: (id: string) => {
    set((state) => ({
      openTabs: state.openTabs.map((t) => (t.id === id ? { ...t, isDirty: true } : t)),
    }));
  },

  markClean: (id: string) => {
    set((state) => ({
      openTabs: state.openTabs.map((t) => (t.id === id ? { ...t, isDirty: false } : t)),
    }));
  },
}));

// Initialize activeTabId after mount
useTabs.subscribe((state) => {
  if (state.openTabs.length > 0 && state.activeTabId === null) {
    useTabs.setState({ activeTabId: state.openTabs[0].id });
  }
});

// D-21: Debounced persistence to state.json
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let isFlushing = false;

function persistTabs() {
  if (isFlushing) return;
  const state = useTabs.getState();
  if (!state.openTabs || state.openTabs.length === 0) return;
  window.api.state.save({
    openTabs: state.openTabs.map((t) => ({ id: t.id, method: t.method, url: t.url, isDirty: t.isDirty ?? false })),
    activeTabId: state.activeTabId,
  }).catch(() => { /* ignore persistence errors */ });
}

useTabs.subscribe(() => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(persistTabs, 300); // 300ms debounce
});

// Flush on beforeunload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      isFlushing = true;
      persistTabs();
    }
  });
}
