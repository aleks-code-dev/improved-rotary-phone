import { useState } from 'react';
import { useExportPostman } from '../hooks/useImportExport';

interface ExportPostmanModalProps {
  open: boolean;
  onClose: () => void;
}

export function ExportPostmanModal({ open, onClose }: ExportPostmanModalProps) {
  const exportMutation = useExportPostman();
  const [collectionId, setCollectionId] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const [collections, setCollections] = useState<Array<{ id: string; name: string }>>([]);
  const [loaded, setLoaded] = useState(false);

  // Load collections on open
  if (open && !loaded) {
    setLoaded(true);
    window.api.collections.list().then((list: any) => setCollections(list));
  }
  if (!open && loaded) {
    // Reset on close
    setTimeout(() => { setLoaded(false); setCollectionId(''); setTargetPath(''); }, 200);
  }

  const handleBrowse = async () => {
    const result = await window.api.app.showSaveDialog({
      title: 'Export Collection',
      defaultPath: 'collection.postman_collection.json',
      filters: [{ name: 'Postman Collection', extensions: ['json'] }],
    });
    if (result.path) setTargetPath(result.path);
  };

  const handleExport = async () => {
    if (!collectionId || !targetPath) return;
    try {
      const result = await window.api.importExport.exportPostman({ id: collectionId });
      if (result.json) {
        await window.api.app.writeFile({
          path: targetPath,
          dataBase64: btoa(result.json),
        });
        onClose();
      }
    } catch {
      // Error
    }
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)',
    }}>
      <div style={{
        background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-2)',
        padding: 'var(--space-6)', maxWidth: 420, width: '90%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <h3 style={{ margin: '0 0 var(--space-4)', color: 'var(--color-fg)', fontSize: 16 }}>
          Export Collection
        </h3>

        <div style={{ marginBottom: 'var(--space-3)' }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--color-fg-muted)', marginBottom: 4 }}>
            Collection
          </label>
          <select value={collectionId} onChange={(e) => setCollectionId(e.target.value)} style={selectStyle}>
            <option value="">Select a collection...</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--color-fg-muted)', marginBottom: 4 }}>
            Target path
          </label>
          <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
            <input type="text" value={targetPath} readOnly style={{ ...selectStyle, flex: 1 }} />
            <button onClick={handleBrowse} style={{
              padding: 'var(--space-1) var(--space-2)',
              background: 'var(--color-bg-elevated)', color: 'var(--color-fg)',
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-1)',
              cursor: 'pointer', fontSize: 12,
            }}>Browse</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
          <button onClick={handleExport} disabled={!collectionId || !targetPath} style={{
            padding: 'var(--space-2) var(--space-4)',
            background: 'var(--color-accent)', color: 'white',
            border: 'none', borderRadius: 'var(--radius-1)',
            fontWeight: 600, fontSize: 13,
            opacity: (collectionId && targetPath) ? 1 : 0.5,
            cursor: (collectionId && targetPath) ? 'pointer' : 'not-allowed',
          }}>
            Export
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
const cancelBtnStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  background: 'transparent', color: 'var(--color-fg-muted)',
  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-1)',
  cursor: 'pointer', fontSize: 13,
};
