import { useState, useEffect } from 'react';

export function DataLocation() {
  const [dataDir, setDataDir] = useState('');
  const [cloudSync, setCloudSync] = useState<string | null>(null);

  useEffect(() => {
    window.api.app.bootstrap().then((b: any) => {
      setDataDir(b.dataDir ?? '');
    });
  }, []);

  const handleChangeLocation = async () => {
    const result = await window.api.app.showOpenDialog({ kind: 'folder', title: 'Choose data location' });
    if (result.path) {
      const setResult = await window.api.app.setDataDir({ path: result.path });
      setDataDir(result.path);
      setCloudSync(setResult.cloudSync);
      window.location.reload();
    }
  };

  const handleOpenFolder = () => {
    window.api.app.openDataFolder();
  };

  return (
    <div>
      <h3 style={{ color: 'var(--color-fg)', margin: '0 0 var(--space-3)' }}>Data Location</h3>

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--color-fg-muted)', marginBottom: 4 }}>
          Current data directory
        </label>
        <code style={{
          display: 'block', padding: 'var(--space-2)', fontSize: 12,
          background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-1)',
          fontFamily: 'var(--font-mono)', wordBreak: 'break-all',
        }}>
          {dataDir || 'Not set'}
        </code>
      </div>

      {cloudSync && (
        <div style={{
          padding: 'var(--space-2) var(--space-3)', marginBottom: 'var(--space-4)',
          background: 'var(--color-warning, #fbbf24)', color: '#000',
          borderRadius: 'var(--radius-1)', fontSize: 12,
        }}>
          Warning: this folder is inside {cloudSync} and may corrupt on multi-machine sync.
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button onClick={handleChangeLocation} style={btnStyle}>Change location</button>
        <button onClick={handleOpenFolder} style={{ ...btnStyle, background: 'transparent', color: 'var(--color-fg-muted)', border: '1px solid var(--color-border)' }}>
          Open data folder
        </button>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  background: 'var(--color-accent)', color: 'white',
  border: 'none', borderRadius: 'var(--radius-1)',
  cursor: 'pointer', fontSize: 13, fontWeight: 600,
};
