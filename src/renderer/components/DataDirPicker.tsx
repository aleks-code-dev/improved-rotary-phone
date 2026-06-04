import { useState } from 'react';

interface DataDirPickerProps {
  initialPath: string;
  onConfirm: (path: string) => void;
  onCancel: () => void;
}

export function DataDirPicker({ initialPath, onConfirm, onCancel }: DataDirPickerProps) {
  const [path, setPath] = useState(initialPath);
  const [warning, setWarning] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleBrowse() {
    const result = await window.api.app.showOpenDialog({
      kind: 'folder',
      title: 'Choose data folder',
    });
    if (result.path) {
      setPath(result.path);
      // Check for cloud sync warning
      setChecking(true);
      try {
        const syncResult = await window.api.app.setDataDir({ path: result.path });
        if (syncResult.cloudSync) {
          setWarning(
            `Warning: this folder is inside ${syncResult.cloudSync} and may corrupt on multi-machine sync.`,
          );
        } else {
          setWarning(null);
        }
      } catch {
        // setDataDir may fail if path is on a cloud-synced mount; surface as warning
        setWarning('Could not verify cloud-sync status for this path.');
      }
      setChecking(false);
    }
  }

  function handlePathChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newPath = e.target.value;
    setPath(newPath);
    setWarning(null);
  }

  const providerLabel = (provider: string) => {
    switch (provider) {
      case 'dropbox':
        return 'Dropbox';
      case 'onedrive':
        return 'OneDrive';
      case 'icloud':
        return 'iCloud Drive';
      case 'googledrive':
        return 'Google Drive';
      default:
        return provider;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <p style={{ color: 'var(--color-fg-muted)', fontSize: 14 }}>
        Welcome to PostmanClone. Where should we store your data?
      </p>

      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <input
          type="text"
          value={path}
          onChange={handlePathChange}
          placeholder="Path to data directory"
          style={{
            flex: 1,
            padding: 'var(--space-2) var(--space-3)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-1)',
            background: 'var(--color-bg)',
            color: 'var(--color-fg)',
            fontSize: 14,
            fontFamily: 'var(--font-mono)',
          }}
        />
        <button
          onClick={handleBrowse}
          disabled={checking}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            background: 'var(--color-border)',
            color: 'var(--color-fg)',
            border: 'none',
            borderRadius: 'var(--radius-1)',
            cursor: checking ? 'not-allowed' : 'pointer',
            fontSize: 14,
          }}
        >
          {checking ? 'Checking...' : 'Browse'}
        </button>
      </div>

      {warning && (
        <div
          style={{
            background: 'oklch(0.75 0.15 50 / 0.1)',
            border: '1px solid oklch(0.75 0.15 50)',
            borderRadius: 'var(--radius-1)',
            padding: 'var(--space-2) var(--space-3)',
            fontSize: 13,
            color: 'oklch(0.75 0.15 50)',
          }}
        >
          {warning}
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{
            padding: 'var(--space-2) var(--space-5)',
            background: 'transparent',
            color: 'var(--color-fg-muted)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-1)',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => onConfirm(path)}
          disabled={!path.trim()}
          style={{
            padding: 'var(--space-2) var(--space-5)',
            background: path.trim() ? 'var(--color-accent)' : 'var(--color-border)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-1)',
            cursor: path.trim() ? 'pointer' : 'not-allowed',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
