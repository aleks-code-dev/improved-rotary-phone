import { useState } from 'react';
import { useCollectionsList, useCreateCollection } from '../../hooks/useCollections';
import { useTabs } from '../../state/useTabs';
import { useCollectionsStore } from '../../store/collections';

export function CollectionsTree() {
  const { data: collections, isLoading } = useCollectionsList();
  const createCollection = useCreateCollection();
  const addTab = useTabs((s) => s.addTab);
  const activeCollectionId = useCollectionsStore((s) => s.activeCollectionId);
  const setActiveCollection = useCollectionsStore((s) => s.setActiveCollection);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = () => {
    if (newName.trim()) {
      createCollection.mutate(newName.trim());
      setNewName('');
      setShowNewModal(false);
    }
  };

  if (isLoading) return <div style={mutedStyle}>Loading collections...</div>;

  const list = collections ?? [];

  return (
    <div>
      <div style={headerStyle}>
        <span>Collections</span>
        <button onClick={() => setShowNewModal(true)} style={plusBtnStyle} title="New collection">+</button>
      </div>

      {showNewModal && (
        <div style={{ padding: 'var(--space-2)' }}>
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNewModal(false); }}
            placeholder="Collection name"
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: 'var(--space-1)', marginTop: 'var(--space-1)' }}>
            <button onClick={handleCreate} style={smallBtnStyle}>Create</button>
            <button onClick={() => setShowNewModal(false)} style={{ ...smallBtnStyle, background: 'transparent', color: 'var(--color-fg-muted)' }}>Cancel</button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div style={mutedStyle}>No collections yet</div>
      ) : (
        list.map((col: any) => (
          <div
            key={col.id}
            onClick={() => setActiveCollection(col.id)}
            style={{
              ...treeItemStyle,
              fontWeight: activeCollectionId === col.id ? 600 : 400,
              color: activeCollectionId === col.id ? 'var(--color-fg)' : 'var(--color-fg-muted)',
              background: activeCollectionId === col.id ? 'var(--color-bg-hover)' : 'transparent',
            }}
          >
            <span style={{ marginRight: 'var(--space-1)' }}>📁</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{col.name}</span>
          </div>
        ))
      )}
    </div>
  );
}

// Shared styles
export const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontWeight: 600,
  fontSize: 11,
  textTransform: 'uppercase',
  color: 'var(--color-fg-muted)',
  letterSpacing: '0.05em',
  marginBottom: 'var(--space-1)',
};

export const plusBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-1)',
  color: 'var(--color-fg-muted)',
  cursor: 'pointer',
  fontSize: 14,
  padding: '0 6px',
  lineHeight: '18px',
};

export const treeItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: 'var(--space-1) var(--space-2)',
  cursor: 'pointer',
  fontSize: 12,
  borderRadius: 'var(--radius-1)',
  marginBottom: 2,
};

export const mutedStyle: React.CSSProperties = {
  color: 'var(--color-fg-muted)',
  fontSize: 12,
  padding: 'var(--space-2) 0',
};

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--space-1) var(--space-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-1)',
  background: 'var(--color-bg-elevated)',
  color: 'var(--color-fg)',
  fontSize: 12,
};

export const smallBtnStyle: React.CSSProperties = {
  padding: '2px var(--space-2)',
  background: 'var(--color-accent)',
  color: 'white',
  border: 'none',
  borderRadius: 'var(--radius-1)',
  cursor: 'pointer',
  fontSize: 11,
};
