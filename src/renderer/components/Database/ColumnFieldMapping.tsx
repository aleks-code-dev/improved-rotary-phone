interface ColumnFieldMappingProps {
  mappings: Array<{ column: string; field: string; compatibility: 'exact' | 'compatible' | 'incompatible' }>;
  coverage: { mapped: number; required: number; total: number };
  columns: string[];
  onUpdate: (index: number, partial: Partial<{ field: string }>) => void;
  onAutoMap: () => void;
  onReset: () => void;
  onApply: () => void;
}

const compatibilityColors: Record<string, string> = {
  exact: 'var(--color-success)',
  compatible: 'var(--color-warning)',
  incompatible: 'var(--color-danger)',
};

export function ColumnFieldMapping({ mappings, coverage, columns, onUpdate, onAutoMap, onReset, onApply }: ColumnFieldMappingProps) {
  const coverageColor = coverage.mapped === coverage.required && coverage.required > 0
    ? 'var(--color-success)'
    : coverage.mapped > 0
      ? 'var(--color-warning)'
      : 'var(--color-danger)';

  return (
    <div style={{ fontSize: 12 }}>
      {/* Header with coverage badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
        <span style={{ fontWeight: 600 }}>Column → Field Mapping</span>
        <span style={{
          fontSize: 10,
          padding: '2px 8px',
          borderRadius: 'var(--radius-1)',
          background: coverageColor,
          color: '#fff',
        }}>
          {coverage.mapped}/{coverage.total} mapped
        </span>
      </div>

      {/* Mapping table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 'var(--space-2)' }}>
        <thead>
          <tr style={{ color: 'var(--color-fg-muted)', fontSize: 10, fontWeight: 600 }}>
            <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'left' }}>DTO Field</th>
            <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'left' }}>DB Column</th>
            <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'center', width: 30 }}>Match</th>
          </tr>
        </thead>
        <tbody>
          {mappings.map((m, i) => (
            <tr key={i}>
              <td style={{ padding: 'var(--space-1) var(--space-2)', fontFamily: 'var(--font-mono)' }}>{m.field}</td>
              <td style={{ padding: 'var(--space-1) var(--space-2)' }}>
                <select
                  value={m.column}
                  onChange={(e) => onUpdate(i, { field: e.target.value === '__none__' ? '' : e.target.value })}
                  style={{
                    padding: '2px 4px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-1)',
                    background: 'var(--color-bg-elevated)', color: 'var(--color-fg)', fontSize: 11,
                    borderColor: compatibilityColors[m.compatibility],
                  }}
                >
                  <option value="__none__">[none]</option>
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </td>
              <td style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'center' }}>
                <span style={{
                  width: 10, height: 10, borderRadius: '50%', display: 'inline-block',
                  background: compatibilityColors[m.compatibility] ?? 'var(--color-border)',
                }} title={m.compatibility} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button onClick={onAutoMap} style={{
          background: 'transparent', color: 'var(--color-accent)', border: '1px dashed var(--color-border)',
          borderRadius: 'var(--radius-1)', padding: '2px 8px', cursor: 'pointer', fontSize: 11,
        }}>
          Auto-map by name
        </button>
        <button onClick={onReset} style={{
          background: 'transparent', color: 'var(--color-fg-muted)', border: '1px dashed var(--color-border)',
          borderRadius: 'var(--radius-1)', padding: '2px 8px', cursor: 'pointer', fontSize: 11,
        }}>
          Reset all
        </button>
        <button onClick={onApply} style={{
          background: 'var(--color-accent)', color: '#fff', border: 'none',
          borderRadius: 'var(--radius-1)', padding: '2px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600,
        }}>
          Apply mapping → body
        </button>
      </div>
    </div>
  );
}
