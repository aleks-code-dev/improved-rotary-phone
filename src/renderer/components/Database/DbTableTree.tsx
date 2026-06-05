import { useState, useCallback } from 'react';

interface DbTableTreeProps {
  connectionId: string | null;
  onRowSelect: (row: Record<string, unknown>, tableName: string, schema: string | null) => void;
}

export function DbTableTree({ connectionId, onRowSelect }: DbTableTreeProps) {
  const [tables, setTables] = useState<Array<{ name: string; schema: string | null; columnCount: number; rowCountEstimate: number }>>([]);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'firstN' | 'byId' | 'byWhere'>('firstN');
  const [whereClause, setWhereClause] = useState('');

  const loadTables = useCallback(async () => {
    if (!connectionId) return;
    try {
      const result = await window.api.db.listTables({ connectionId });
      setTables(result);
    } catch { /* ignore */ }
  }, [connectionId]);

  const loadRows = useCallback(async (tableName: string) => {
    if (!connectionId) return;
    setLoading(true);
    try {
      const result = await window.api.db.fetchRows({
        connectionId,
        tableName,
        schema: null,
        mode,
        whereClause: mode === 'byWhere' ? whereClause : undefined,
        limit: 10,
      });
      setRows(result.rows);
      setExpandedTable(tableName);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [connectionId, mode, whereClause]);

  if (!connectionId) {
    return (
      <div style={{ padding: 'var(--space-3)', color: 'var(--color-fg-muted)', fontSize: 12, textAlign: 'center' }}>
        No database connected
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--space-2)', fontSize: 12, overflow: 'auto', maxHeight: '100%' }}>
      {/* Mode switcher */}
      <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-2)' }}>
        {(['firstN', 'byId', 'byWhere'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: '2px 8px',
              fontSize: 10,
              border: mode === m ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
              borderRadius: 'var(--radius-1)',
              background: mode === m ? 'var(--color-accent)' : 'transparent',
              color: mode === m ? '#fff' : 'var(--color-fg-muted)',
              cursor: 'pointer',
            }}
          >
            {m === 'firstN' ? 'first N' : m === 'byId' ? 'by ID' : 'WHERE'}
          </button>
        ))}
      </div>

      {mode === 'byWhere' && (
        <input
          value={whereClause}
          onChange={(e) => setWhereClause(e.target.value)}
          placeholder="name = 'test'"
          style={{
            width: '100%', padding: '4px 6px', marginBottom: 'var(--space-2)',
            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-1)',
            background: 'var(--color-bg-elevated)', color: 'var(--color-fg)',
            fontSize: 11, fontFamily: 'var(--font-mono)',
          }}
        />
      )}

      <button onClick={loadTables} style={{
        background: 'transparent', color: 'var(--color-accent)', border: '1px dashed var(--color-border)',
        borderRadius: 'var(--radius-1)', padding: '2px 8px', cursor: 'pointer', fontSize: 11, marginBottom: 'var(--space-2)',
      }}>
        Load Tables
      </button>

      {tables.length === 0 && (
        <div style={{ color: 'var(--color-fg-muted)', textAlign: 'center', padding: 'var(--space-3)' }}>
          No tables found
        </div>
      )}

      {tables.map((table) => (
        <div key={table.name} style={{ marginBottom: 2 }}>
          <button
            onClick={() => { if (expandedTable === table.name) setExpandedTable(null); else loadRows(table.name); }}
            style={{
              background: 'transparent', border: 'none', color: 'var(--color-fg)', cursor: 'pointer',
              fontSize: 12, fontFamily: 'var(--font-mono)', padding: '2px 0', width: '100%', textAlign: 'left',
            }}
          >
            <span style={{ color: 'var(--color-fg-muted)', marginRight: 4 }}>
              {expandedTable === table.name ? '▼' : '▶'}
            </span>
            {table.name}
            <span style={{ color: 'var(--color-fg-muted)', marginLeft: 8, fontSize: 10 }}>
              {table.rowCountEstimate} rows
            </span>
          </button>

          {expandedTable === table.name && (
            <div style={{ paddingLeft: 'var(--space-3)', marginTop: 2 }}>
              {loading && <div style={{ color: 'var(--color-fg-muted)', fontSize: 11 }}>Loading...</div>}
              {rows.map((row, i) => (
                <button
                  key={i}
                  onClick={() => onRowSelect(row, table.name, table.schema)}
                  style={{
                    display: 'block', background: 'transparent', border: 'none',
                    color: 'var(--color-fg)', cursor: 'pointer', fontSize: 10,
                    fontFamily: 'var(--font-mono)', padding: '1px 0', width: '100%', textAlign: 'left',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                >
                  {Object.entries(row).slice(0, 3).map(([k, v]) => `${k}=${String(v).substring(0, 20)}`).join(' | ')}
                </button>
              ))}
              {!loading && rows.length === 0 && (
                <div style={{ color: 'var(--color-fg-muted)', fontSize: 11 }}>No rows</div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
