import { useState } from 'react';
import { useCollectionsList, useUpdateCollection } from '../../hooks/useCollections';

interface SaveAsModalProps {
  open: boolean;
  requestName: string;
  onClose: () => void;
  onSaved: () => void;
}

export function SaveAsModal({ open, requestName, onClose, onSaved }: SaveAsModalProps) {
  const { data: collections } = useCollectionsList();
  const updateCollection = useUpdateCollection();
  const [selectedId, setSelectedId] = useState<string>('');
  const [name, setName] = useState(requestName || 'Untitled Request');

  const handleSave = async () => {
    if (!selectedId) return;
    try {
      const coll = await window.api.collections.read({ id: selectedId });
      coll.item.push({ name: name || 'Untitled Request', request: {}, response: [], event: [] });
      await updateCollection.mutateAsync({ id: selectedId, collection: coll });
      onSaved();
      onClose();
    } catch {
      // Error — keep modal open
    }
  };

  if (!open) return null;

  const list = collections ?? [];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)',
    }}>
      <div style={{
        background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-2)',
        padding: 'var(--space-6)', maxWidth: 400, width: '90%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <h3 style={{ margin: '0 0 var(--space-4)', color: 'var(--color-fg)', fontSize: 16 }}>
          Save Request
        </h3>

        <div style={{ marginBottom: 'var(--space-3)' }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--color-fg-muted)', marginBottom: 4 }}>
            Collection
          </label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={selectStyle}
          >
            <option value="">Select a collection...</option>
            {list.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--color-fg-muted)', marginBottom: 4 }}>
            Request name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
            autoFocus
          />
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={!selectedId}
            style={{ ...saveBtnStyle, opacity: selectedId ? 1 : 0.5 }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: 'var(--space-1) var(--space-2)',
  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-1)',
  background: 'var(--color-bg-elevated)', color: 'var(--color-fg)', fontSize: 12,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: 'var(--space-1) var(--space-2)',
  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-1)',
  background: 'var(--color-bg-elevated)', color: 'var(--color-fg)', fontSize: 12,
};
const cancelBtnStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  background: 'transparent', color: 'var(--color-fg-muted)',
  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-1)',
  cursor: 'pointer', fontSize: 13,
};
const saveBtnStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  background: 'var(--color-accent)', color: 'white',
  border: 'none', borderRadius: 'var(--radius-1)',
  cursor: 'pointer', fontSize: 13, fontWeight: 600,
};
