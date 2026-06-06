import { useState, useCallback } from 'react';
import { PillBar, type PillItem } from '../ui/PillBar';

interface DbTableTreeProps {
  connectionId: string | null;
  onRowSelect: (row: Record<string, unknown>, tableName: string, schema: string | null) => void;
  onUseRowAsBody?: (row: Record<string, unknown>, tableName: string, schema: string | null) => void;
}

type RowFetchMode = 'firstN' | 'byId' | 'byWhere';

const MODE_ITEMS: PillItem<RowFetchMode>[] = [
  { id: 'firstN', label: 'First N' },
  { id: 'byId', label: 'By ID' },
  { id: 'byWhere', label: 'WHERE' },
];

const tableRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '4px var(--ds-space-2)',
  cursor: 'pointer',
  fontSize: 'var(--ds-text-sm)',
  borderRadius: 'var(--ds-radius-1)',
  marginBottom: 2,
  gap: 'var(--ds-space-1)',
  fontFamily: 'var(--ds-font-mono)',
};

const inlineRowStyle: React.CSSProperties = {
  display: 'block',
  padding: '3px var(--ds-space-2) 3px var(--ds-space-5)',
  cursor: 'pointer',
  fontSize: 'var(--ds-text-2xs)',
  fontFamily: 'var(--ds-font-mono)',
  color: 'var(--ds-text)',
  borderRadius: 'var(--ds-radius-1)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  marginBottom: 1,
};

const chevronStyle: React.CSSProperties = {
  fontSize: 9,
  color: 'var(--ds-text-muted)',
  transition: 'transform 120ms ease',
  display: 'inline-block',
};

export function DbTableTree({ connectionId, onRowSelect, onUseRowAsBody }: DbTableTreeProps) {
  const [tables, setTables] = useState<Array<{ name: string; schema: string | null; columnCount: number; rowCountEstimate: number }>>([]);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [mode, setMode] = useState<RowFetchMode>('firstN');
  const [whereClause, setWhereClause] = useState('');

  const loadTables = useCallback(async () => {
    if (!connectionId) return;
    setTablesLoading(true);
    setTablesError(null);
    try {
      const result = await window.api.db.listTables({ connectionId });
      setTables(result ?? []);
    } catch (err: any) {
      setTablesError(err?.message ?? 'Failed to load tables');
      setTables([]);
    } finally {
      setTablesLoading(false);
    }
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
      <div style={{
        padding: 'var(--ds-space-3)',
        color: 'var(--ds-text-muted)',
        fontSize: 'var(--ds-text-sm)',
        textAlign: 'center',
      }}>
        No database connected
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--ds-space-2)', overflow: 'auto', maxHeight: '100%' }}>
      {/* Mode switcher (PillBar) */}
      <div style={{ marginBottom: 'var(--ds-space-2)' }}>
        <PillBar items={MODE_ITEMS} activeId={mode} onChange={setMode} />
      </div>

      {mode === 'byWhere' && (
        <input
          value={whereClause}
          onChange={(e) => setWhereClause(e.target.value)}
          placeholder="name = 'test'"
          style={{
            width: '100%',
            padding: 'var(--ds-space-1) var(--ds-space-2)',
            marginBottom: 'var(--ds-space-2)',
            border: '1px solid var(--ds-border)',
            borderRadius: 'var(--ds-radius-1)',
            background: 'var(--ds-surface)',
            color: 'var(--ds-text)',
            fontSize: 'var(--ds-text-sm)',
            fontFamily: 'var(--ds-font-mono)',
          }}
        />
      )}

      <button
        onClick={loadTables}
        disabled={tablesLoading}
        style={{
          background: 'transparent',
          color: 'var(--ds-primary)',
          border: '1px dashed var(--ds-border)',
          borderRadius: 'var(--ds-radius-1)',
          padding: 'var(--ds-space-1) var(--ds-space-3)',
          cursor: tablesLoading ? 'wait' : 'pointer',
          fontSize: 'var(--ds-text-sm)',
          marginBottom: 'var(--ds-space-2)',
          width: '100%',
          opacity: tablesLoading ? 0.6 : 1,
        }}
      >
        {tablesLoading ? 'Loading…' : 'Load Tables'}
      </button>

      {tablesError && (
        <div style={{
          color: 'var(--ds-method-delete)',
          fontSize: 'var(--ds-text-xs)',
          textAlign: 'center',
          padding: 'var(--ds-space-2)',
        }}>
          ✗ {tablesError}
        </div>
      )}

      {tables.length === 0 && !tablesError && (
        <div style={{
          color: 'var(--ds-text-muted)',
          textAlign: 'center',
          padding: 'var(--ds-space-3)',
          fontSize: 'var(--ds-text-sm)',
        }}>
          No tables found
        </div>
      )}

      {tables.map((table) => {
        const isExpanded = expandedTable === table.name;
        return (
          <div key={table.name} style={{ marginBottom: 2 }}>
            <div
              onClick={() => {
                if (isExpanded) setExpandedTable(null);
                else loadRows(table.name);
              }}
              style={tableRowStyle}
            >
              <span style={{ ...chevronStyle, transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{table.name}</span>
              <span style={{
                fontSize: 'var(--ds-text-2xs)',
                color: 'var(--ds-text-muted)',
                background: 'var(--ds-surface)',
                padding: '0 6px',
                borderRadius: 'var(--ds-radius-1)',
                minWidth: 18,
                textAlign: 'center',
              }}>
                {table.rowCountEstimate}
              </span>
            </div>

            {isExpanded && (
              <div style={{ marginTop: 2 }}>
                {loading && (
                  <div style={{ color: 'var(--ds-text-muted)', fontSize: 'var(--ds-text-2xs)', padding: 'var(--ds-space-1) var(--ds-space-3)' }}>
                    Loading…
                  </div>
                )}
                {rows.map((row, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--ds-space-1)',
                      padding: '3px var(--ds-space-2) 3px var(--ds-space-5)',
                      borderRadius: 'var(--ds-radius-1)',
                      marginBottom: 1,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ds-surface)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div
                      onClick={() => onRowSelect(row, table.name, table.schema)}
                      style={{ ...inlineRowStyle, padding: 0, marginBottom: 0, flex: 1, minWidth: 0 }}
                    >
                      {Object.entries(row).slice(0, 3).map(([k, v]) => `${k}=${String(v).substring(0, 20)}`).join(' | ')}
                    </div>
                    {onUseRowAsBody && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onUseRowAsBody(row, table.name, table.schema); }}
                        title="Use this row as request body (raw JSON)"
                        style={{
                          flexShrink: 0,
                          background: 'transparent',
                          color: 'var(--ds-primary)',
                          border: '1px solid var(--ds-border)',
                          borderRadius: 'var(--ds-radius-1)',
                          padding: '0 6px',
                          cursor: 'pointer',
                          fontSize: 'var(--ds-text-2xs)',
                          fontFamily: 'var(--ds-font-mono)',
                          lineHeight: '16px',
                          height: 16,
                        }}
                      >
                        → body
                      </button>
                    )}
                  </div>
                ))}
                {!loading && rows.length === 0 && (
                  <div style={{ color: 'var(--ds-text-muted)', fontSize: 'var(--ds-text-2xs)', padding: 'var(--ds-space-1) var(--ds-space-3)' }}>
                    No rows
                  </div>
                )}
                {!loading && rows.length > 0 && (
                  <div style={{
                    color: 'var(--ds-primary)',
                    fontSize: 'var(--ds-text-2xs)',
                    padding: 'var(--ds-space-1) var(--ds-space-3)',
                    cursor: 'pointer',
                  }}>
                    Load 10 more →
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
