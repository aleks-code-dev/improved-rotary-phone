import { useState } from 'react';
import { useImportPostman } from '../hooks/useImportExport';

interface ImportPostmanModalProps {
  open: boolean;
  onClose: () => void;
}

export function ImportPostmanModal({ open, onClose }: ImportPostmanModalProps) {
  const importMutation = useImportPostman();
  const [filePath, setFilePath] = useState('');
  const [preview, setPreview] = useState<{ id?: string; itemCount: number; folderCount: number; name?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePickFile = async () => {
    setError(null);
    const result = await window.api.app.showOpenDialog({ kind: 'file', title: 'Import Postman collection' });
    if (result.path) {
      setFilePath(result.path);
      try {
        const file = await window.api.app.readFile({ path: result.path });
        if (file.ok && file.text) {
          const importResult = await window.api.importExport.importPostman({ jsonText: file.text });
          if (importResult.id) {
            setPreview({
              id: importResult.id,
              itemCount: importResult.preview?.itemCount ?? 0,
              folderCount: importResult.preview?.folderCount ?? 0,
              name: result.path.split(/[\\/]/).pop(),
            });
          }
        }
      } catch (err: any) {
        setError(err.message ?? 'Import failed');
      }
    }
  };

  const handleImport = () => {
    if (preview) {
      importMutation.mutate(filePath);
      onClose();
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
          Import Postman Collection
        </h3>

        <button onClick={handlePickFile} style={{
          padding: 'var(--space-2) var(--space-4)',
          background: 'var(--color-accent)', color: 'white',
          border: 'none', borderRadius: 'var(--radius-1)',
          cursor: 'pointer', fontSize: 13, fontWeight: 600,
          marginBottom: 'var(--space-3)',
        }}>
          Choose file...
        </button>

        {filePath && (
          <div style={{ fontSize: 12, color: 'var(--color-fg-muted)', marginBottom: 'var(--space-3)', fontFamily: 'var(--font-mono)' }}>
            {filePath}
          </div>
        )}

        {preview && (
          <div style={{
            padding: 'var(--space-3)', marginBottom: 'var(--space-4)',
            background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-1)',
            fontSize: 13, color: 'var(--color-fg)',
          }}>
            <div><strong>Name:</strong> {preview.name}</div>
            <div><strong>Requests:</strong> {preview.itemCount}</div>
            <div><strong>Folders:</strong> {preview.folderCount}</div>
            <div style={{ marginTop: 'var(--space-1)', color: 'var(--color-method-get)', fontSize: 11 }}>
              ✓ Auth preserved
            </div>
          </div>
        )}

        {error && (
          <div style={{ color: 'var(--color-method-delete)', fontSize: 12, marginBottom: 'var(--space-3)' }}>
            Error: {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
          <button onClick={handleImport} disabled={!preview} style={{
            ...importBtnStyle,
            opacity: preview ? 1 : 0.5,
            cursor: preview ? 'pointer' : 'not-allowed',
          }}>
            Import
          </button>
        </div>
      </div>
    </div>
  );
}

const cancelBtnStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  background: 'transparent', color: 'var(--color-fg-muted)',
  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-1)',
  cursor: 'pointer', fontSize: 13,
};
const importBtnStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  background: 'var(--color-accent)', color: 'white',
  border: 'none', borderRadius: 'var(--radius-1)',
  fontWeight: 600, fontSize: 13,
};
