import { Fragment } from 'react';

interface DbRowDetailProps {
  row: Record<string, unknown>;
  tableName: string;
  schema: string | null;
  connectionId: string;
  dtoFqn: string | null;
  onUseRow: (bodyJson: string) => void;
}

export function DbRowDetail({ row, tableName, schema, connectionId, dtoFqn, onUseRow }: DbRowDetailProps) {
  const handleUseRow = async () => {
    if (!dtoFqn) return;
    try {
      const result = await window.api.db.mapRowToDto({
        connectionId,
        tableName,
        rowId: row as Record<string, unknown>,
        dtoFqn,
      });
      if (result.ok) {
        onUseRow(result.bodyJson);
      }
    } catch { /* ignore */ }
  };

  const fullTableName = schema ? `${schema}.${tableName}` : tableName;

  return (
    <div style={{
      maxHeight: 180,
      overflow: 'auto',
      borderTop: '1px solid var(--ds-border)',
      background: 'var(--ds-surface)',
    }}>
      {/* Sticky header (007-D) */}
      <div style={{
        position: 'sticky',
        top: 0,
        background: 'var(--ds-bg)',
        padding: 'var(--ds-space-2) var(--ds-space-3)',
        borderBottom: '1px solid var(--ds-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--ds-space-2)',
        zIndex: 1,
      }}>
        <span style={{
          background: 'var(--ds-primary)',
          color: '#fff',
          fontSize: 'var(--ds-text-2xs)',
          fontWeight: 600,
          padding: '2px 6px',
          borderRadius: 'var(--ds-radius-full, 999px)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          DB Row
        </span>
        <span style={{
          fontFamily: 'var(--ds-font-mono)',
          fontSize: 'var(--ds-text-xs)',
          color: 'var(--ds-text-muted)',
        }}>
          {fullTableName}
        </span>
      </div>

      {/* Column/value grid */}
      <div style={{
        padding: 'var(--ds-space-2) var(--ds-space-3)',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: 'var(--ds-space-1) var(--ds-space-3)',
        fontSize: 'var(--ds-text-xs)',
      }}>
        {Object.entries(row).map(([key, value]) => (
          <Fragment key={key}>
            <span style={{
              fontFamily: 'var(--ds-font-mono)',
              color: 'var(--ds-text-muted)',
              fontWeight: 600,
            }}>{key}</span>
            <span style={{
              fontFamily: 'var(--ds-font-mono)',
              color: value === null ? 'var(--ds-text-muted)' : 'var(--ds-text)',
              fontStyle: value === null ? 'italic' : 'normal',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }} title={String(value ?? '')}>
              {value === null ? 'NULL' : String(value).substring(0, 100)}
            </span>
          </Fragment>
        ))}
      </div>

      {dtoFqn && (
        <div style={{ padding: 'var(--ds-space-2) var(--ds-space-3)' }}>
          <button
            onClick={handleUseRow}
            style={{
              background: 'var(--ds-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--ds-radius-1)',
              padding: 'var(--ds-space-1) var(--ds-space-3)',
              cursor: 'pointer',
              fontSize: 'var(--ds-text-xs)',
              fontWeight: 600,
            }}
          >
            Use this row → body
          </button>
        </div>
      )}
    </div>
  );
}
