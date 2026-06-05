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

  return (
    <div style={{
      maxHeight: 180,
      overflow: 'auto',
      borderTop: '1px solid var(--color-border)',
      padding: 'var(--space-2)',
      fontSize: 11,
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 2fr',
        gap: '2px var(--space-2)',
      }}>
        {Object.entries(row).map(([key, value]) => (
          <Fragment key={key}>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-fg-muted)', fontWeight: 600 }}>{key}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-fg)' }}>
              {value === null ? 'NULL' : String(value).substring(0, 100)}
            </span>
          </Fragment>
        ))}
      </div>
      {dtoFqn && (
        <button
          onClick={handleUseRow}
          style={{
            marginTop: 'var(--space-2)',
            background: 'var(--color-accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-1)',
            padding: 'var(--space-1) var(--space-3)',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          Use this row → body
        </button>
      )}
    </div>
  );
}

// Fragment import
import { Fragment } from 'react';
