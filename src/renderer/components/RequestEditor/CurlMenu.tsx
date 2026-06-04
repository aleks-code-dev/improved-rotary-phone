import { useState, useCallback } from 'react';

export function CurlMenu() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = useCallback(async () => {
    setError(null);
    // Handled by parent via Copy as cURL button
    setOpen(false);
  }, []);

  const handleImportClipboard = useCallback(async () => {
    setError(null);
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const result = await window.api.curl.import({ text });
        if (result.ok) {
          // Dispatch event for parent to handle
          window.dispatchEvent(new CustomEvent('curl:imported', { detail: { spec: result.spec } }));
          setOpen(false);
        } else {
          setError(result.error);
        }
      }
    } catch (err: any) {
      setError('Could not read clipboard');
    }
  }, []);

  const handleImportFile = useCallback(async () => {
    setError(null);
    try {
      const dialog = await window.api.app.showOpenDialog({ kind: 'file', title: 'Import cURL from file' });
      if (dialog.path) {
        const file = await window.api.app.readFile({ path: dialog.path });
        if (file.ok && file.text) {
          const result = await window.api.curl.import({ text: file.text });
          if (result.ok) {
            window.dispatchEvent(new CustomEvent('curl:imported', { detail: { spec: result.spec } }));
            setOpen(false);
          } else {
            setError(result.error);
          }
        }
      }
    } catch (err: any) {
      setError('Could not read file');
    }
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={dropdownBtnStyle} title="cURL options">▼</button>
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          zIndex: 100,
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-1)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          minWidth: 200,
        }}>
          <div onClick={handleCopy} style={dropdownItemStyle}>Copy as cURL</div>
          <div onClick={handleImportClipboard} style={dropdownItemStyle}>Import cURL from clipboard</div>
          <div onClick={handleImportFile} style={dropdownItemStyle}>Import cURL from file</div>
          {error && (
            <div style={{ padding: 'var(--space-1) var(--space-2)', color: 'var(--color-method-delete)', fontSize: 11 }}>
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const dropdownBtnStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-2)',
  background: 'transparent',
  color: 'var(--color-fg-muted)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-1)',
  cursor: 'pointer',
  fontSize: 10,
};

const dropdownItemStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  cursor: 'pointer',
  fontSize: 12,
  color: 'var(--color-fg)',
  borderBottom: '1px solid var(--color-border)',
};
