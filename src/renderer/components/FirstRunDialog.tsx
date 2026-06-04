import { useState } from 'react';

interface Props {
  onConfirm: (path: string) => void;
}

export function FirstRunDialog({ onConfirm }: Props) {
  const [path, setPath] = useState('');
  const [warning, setWarning] = useState<string | null>(null);

  async function handleBrowse() {
    const result = await window.api.app.showOpenDialog({ kind: 'folder', title: 'Choose data folder' });
    if (result.path) {
      setPath(result.path);
      const syncResult = await window.api.app.setDataDir({ path: result.path });
      if (syncResult.cloudSync) {
        setWarning(`Warning: this folder is inside ${syncResult.cloudSync} and may corrupt on multi-machine sync.`);
      } else {
        setWarning(null);
      }
    }
  }

  function handleContinue() {
    if (path) {
      onConfirm(path);
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--color-bg-elevated)',
        borderRadius: 'var(--radius-2)',
        padding: 'var(--space-6)',
        maxWidth: 480,
        width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 'var(--space-2)' }}>Welcome to PostmanClone</h1>
        <p style={{ color: 'var(--color-fg-muted)', marginBottom: 'var(--space-5)', fontSize: 14 }}>
          Where should we store your data?
        </p>

        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <input
            type="text"
            value={path}
            onChange={e => setPath(e.target.value)}
            placeholder="Path to data directory"
            style={{
              flex: 1,
              padding: 'var(--space-2) var(--space-3)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-1)',
              background: 'var(--color-bg)',
              color: 'var(--color-fg)',
              fontSize: 14,
            }}
          />
          <button
            onClick={handleBrowse}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              background: 'var(--color-border)',
              color: 'var(--color-fg)',
              border: 'none',
              borderRadius: 'var(--radius-1)',
              cursor: 'pointer',
            }}
          >
            Browse
          </button>
        </div>

        {warning && (
          <div style={{
            background: 'oklch(0.75 0.15 50 / 0.1)',
            border: '1px solid oklch(0.75 0.15 50)',
            borderRadius: 'var(--radius-1)',
            padding: 'var(--space-2) var(--space-3)',
            marginBottom: 'var(--space-3)',
            fontSize: 13,
            color: 'oklch(0.75 0.15 50)',
          }}>
            {warning}
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
          <button
            onClick={handleContinue}
            disabled={!path}
            style={{
              padding: 'var(--space-2) var(--space-5)',
              background: path ? 'var(--color-accent)' : 'var(--color-border)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-1)',
              cursor: path ? 'pointer' : 'not-allowed',
              fontWeight: 600,
            }}
          >
            Continue
          </button>
        </div>

        <div style={{ marginTop: 'var(--space-4)', textAlign: 'center' }}>
          <span
            onClick={() => onConfirm(path)}
            style={{
              color: 'var(--color-accent)',
              cursor: 'pointer',
              fontSize: 12,
              textDecoration: 'underline',
            }}
          >
            Import a Postman collection to get started
          </span>
        </div>
      </div>
    </div>
  );
}