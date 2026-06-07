import { useState, useEffect, useCallback, useRef } from 'react';

interface FkLookupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRow: (row: Record<string, unknown>) => void;
  connectionId: string | null;
  searchTerm: string;
  tables: Array<{ name: string; schema: string | null; columnCount: number; rowCountEstimate: number }>;
  loadingTables?: boolean;
}

export function FkLookupDialog({
  isOpen,
  onClose,
  onSelectRow,
  connectionId,
  searchTerm,
  tables,
  loadingTables = false,
}: FkLookupDialogProps) {
  const [search, setSearch] = useState(searchTerm);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch(searchTerm);
      setSelectedTable(null);
      setRows([]);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, searchTerm]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const loadRows = useCallback(async (tableName: string) => {
    if (!connectionId) return;
    setLoadingRows(true);
    setError(null);
    setSelectedTable(tableName);
    try {
      const result = await window.api.db.fetchRows({
        connectionId,
        tableName,
        schema: null,
        mode: 'firstN',
        limit: 20,
      });
      setRows(result.rows);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load rows');
      setRows([]);
    } finally {
      setLoadingRows(false);
    }
  }, [connectionId]);

  const handleSelectRow = useCallback((row: Record<string, unknown>) => {
    onSelectRow(row);
    onClose();
  }, [onSelectRow, onClose]);

  if (!isOpen) return null;

  const filtered = tables.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--ds-space-3)' }}>
          <span style={{ fontSize: 'var(--ds-text-sm)', fontWeight: 600, color: 'var(--ds-text)' }}>
            FK Lookup
          </span>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {/* Search input */}
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tables…"
          style={searchInputStyle}
        />

        {/* Content area */}
        <div style={{ display: 'flex', gap: 'var(--ds-space-2)', marginTop: 'var(--ds-space-2)', maxHeight: 360, overflow: 'hidden' }}>
          {/* Table list */}
          <div style={tableListStyle}>
            {loadingTables && (
              <div style={emptyTextStyle}>Loading tables…</div>
            )}
            {!loadingTables && filtered.length === 0 && (
              <div style={emptyTextStyle}>No matching tables</div>
            )}
            {filtered.map((t) => (
              <div
                key={t.name}
                onClick={() => loadRows(t.name)}
                style={{
                  ...tableItemStyle,
                  background: selectedTable === t.name ? 'var(--ds-surface)' : undefined,
                  color: selectedTable === t.name ? 'var(--ds-primary)' : undefined,
                }}
                onMouseEnter={(e) => {
                  if (selectedTable !== t.name) e.currentTarget.style.background = 'var(--ds-surface)';
                }}
                onMouseLeave={(e) => {
                  if (selectedTable !== t.name) e.currentTarget.style.background = undefined;
                }}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
                <span style={badgeStyle}>{t.rowCountEstimate}</span>
              </div>
            ))}
          </div>

          {/* Row list */}
          <div style={rowListStyle}>
            {loadingRows && (
              <div style={emptyTextStyle}>Loading rows…</div>
            )}
            {!loadingRows && selectedTable && rows.length === 0 && (
              <div style={emptyTextStyle}>No rows in table</div>
            )}
            {!selectedTable && !loadingRows && (
              <div style={emptyTextStyle}>Select a table to view rows</div>
            )}
            {!loadingRows && rows.map((row, i) => (
              <div
                key={i}
                onClick={() => handleSelectRow(row)}
                style={rowItemStyle}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ds-surface)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = undefined)}
              >
                {Object.entries(row).slice(0, 3).map(([k, v]) => `${k}=${String(v).substring(0, 20)}`).join(' | ')}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ color: 'var(--ds-method-delete)', fontSize: 'var(--ds-text-xs)', marginTop: 'var(--ds-space-2)' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Styles ---

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const dialogStyle: React.CSSProperties = {
  background: 'var(--ds-bg)',
  border: '1px solid var(--ds-border)',
  borderRadius: 'var(--ds-radius-2)',
  padding: 'var(--ds-space-4)',
  minWidth: 560,
  maxWidth: 720,
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
};

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--ds-space-2) var(--ds-space-3)',
  border: '1px solid var(--ds-border)',
  borderRadius: 'var(--ds-radius-1)',
  background: 'var(--ds-surface)',
  color: 'var(--ds-text)',
  fontSize: 'var(--ds-text-sm)',
  fontFamily: 'var(--ds-font-mono)',
  boxSizing: 'border-box',
};

const tableListStyle: React.CSSProperties = {
  flex: '0 0 200px',
  overflowY: 'auto',
  maxHeight: 340,
  border: '1px solid var(--ds-border)',
  borderRadius: 'var(--ds-radius-1)',
};

const rowListStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  maxHeight: 340,
  border: '1px solid var(--ds-border)',
  borderRadius: 'var(--ds-radius-1)',
};

const tableItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: 'var(--ds-space-1) var(--ds-space-2)',
  cursor: 'pointer',
  fontSize: 'var(--ds-text-xs)',
  fontFamily: 'var(--ds-font-mono)',
  borderRadius: 'var(--ds-radius-1)',
  margin: '1px 2px',
  gap: 'var(--ds-space-1)',
};

const rowItemStyle: React.CSSProperties = {
  padding: '3px var(--ds-space-2)',
  cursor: 'pointer',
  fontSize: 'var(--ds-text-2xs)',
  fontFamily: 'var(--ds-font-mono)',
  color: 'var(--ds-text)',
  borderRadius: 'var(--ds-radius-1)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  margin: '1px 2px',
};

const badgeStyle: React.CSSProperties = {
  fontSize: 'var(--ds-text-2xs)',
  color: 'var(--ds-text-muted)',
  background: 'var(--ds-surface)',
  padding: '0 6px',
  borderRadius: 'var(--ds-radius-1)',
  minWidth: 18,
  textAlign: 'center',
};

const emptyTextStyle: React.CSSProperties = {
  color: 'var(--ds-text-muted)',
  fontSize: 'var(--ds-text-xs)',
  textAlign: 'center',
  padding: 'var(--ds-space-3)',
};

const closeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--ds-text-muted)',
  cursor: 'pointer',
  fontSize: 14,
  padding: '2px 6px',
};
