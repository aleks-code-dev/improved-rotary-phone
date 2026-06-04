import { create } from 'zustand';

interface CollectionsStore {
  collections: Map<string, { id: string; name: string }>;
  activeCollectionId: string | null;
  setActiveCollection: (id: string | null) => void;
  setCollections: (list: Array<{ id: string; name: string }>) => void;
}

export const useCollectionsStore = create<CollectionsStore>((set) => ({
  collections: new Map(),
  activeCollectionId: null,

  setActiveCollection: (id) => set({ activeCollectionId: id }),

  setCollections: (list) => {
    const map = new Map<string, { id: string; name: string }>();
    for (const item of list) map.set(item.id, item);
    set({ collections: map });
  },
}));
