interface ColumnFieldMappingProps {
  mappings: Array<{ column: string; field: string; compatibility: 'exact' | 'compatible' | 'incompatible' }>;
  coverage: { mapped: number; required: number; total: number };
  columns: string[];
  onUpdate: (index: number, partial: Partial<{ field: string }>) => void;
  onAutoMap: () => void;
  onReset: () => void;
  onApply: () => void;
}

const COMPATIBILITY_COLORS: Record<string, { dot: string; label: string }> = {
  exact: { dot: 'var(--ds-method-get)', label: 'Exact match' },
  compatible: { dot: 'var(--ds-method-post)', label: 'Compatible (auto-converts)' },
  incompatible: { dot: 'var(--ds-method-delete)', label: 'Incompatible — manual fix needed' },
};

const thStyle: React.CSSProperties = {
  padding: 'var(--ds-space-1) var(--ds-space-2)',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: 'var(--ds-text-2xs)',
  color: 'var(--ds-text-muted)',
  borderBottom: '1px solid var(--ds-border)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const tdStyle: React.CSSProperties = {
  padding: 'var(--ds-space-1) var(--ds-space-2)',
  borderBottom: '1px solid var(--ds-border)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--ds-text-2xs)',
  fontWeight: 600,
  color: 'var(--ds-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 'var(--ds-space-1)',
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '2px 4px',
  border: '1px solid var(--ds-border)',
  borderRadius: 'var(--ds-radius-1)',
  background: 'var(--ds-surface)',
  color: 'var(--ds-text)',
  fontSize: 'var(--ds-text-xs)',
  fontFamily: 'var(--ds-font-mono)',
};

export function ColumnFieldMapping({ mappings, coverage, columns, onUpdate, onAutoMap, onReset, onApply }: ColumnFieldMappingProps) {
  // Coverage badge color (green = all required mapped, yellow = partial, red = none)
  const coverageColor =
    coverage.required > 0 && coverage.mapped === coverage.required
      ? 'var(--ds-method-get)'
      : coverage.mapped > 0
        ? 'var(--ds-method-post)'
        : 'var(--ds-method-delete)';

  return (
    <div>
      {/* Header with coverage badge */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--ds-space-3)',
      }}>
        <span style={{ ...labelStyle, marginBottom: 0 }}>Column → Field Mapping</span>
        <span
          style={{
            fontSize: 'var(--ds-text-2xs)',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 'var(--ds-radius-1)',
            background: coverageColor,
            color: '#fff',
          }}
          title={`${coverage.mapped} of ${coverage.required} required fields mapped`}
        >
          {coverage.mapped}/{coverage.required} required
        </span>
      </div>

      {/* Mapping table */}
      <div style={{
        border: '1px solid var(--ds-border)',
        borderRadius: 'var(--ds-radius-1)',
        overflow: 'hidden',
        marginBottom: 'var(--ds-space-3)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--ds-surface)' }}>
              <th style={thStyle}>DTO Field</th>
              <th style={thStyle}>DB Column</th>
              <th style={{ ...thStyle, textAlign: 'center', width: 40 }}>Type</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((m, i) => {
              const comp = COMPATIBILITY_COLORS[m.compatibility] ?? COMPATIBILITY_COLORS.incompatible;
              return (
                <tr key={i}>
                  <td style={{ ...tdStyle, fontFamily: 'var(--ds-font-mono)', fontSize: 'var(--ds-text-xs)' }}>
                    {m.field}
                  </td>
                  <td style={tdStyle}>
                    <select
                      value={m.column}
                      onChange={(e) => onUpdate(i, { field: e.target.value === '__none__' ? '' : e.target.value })}
                      style={selectStyle}
                    >
                      <option value="__none__">[none]</option>
                      {columns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        display: 'inline-block',
                        background: comp.dot,
                      }}
                      title={comp.label}
                      aria-label={comp.label}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: 'var(--ds-space-3)',
        marginBottom: 'var(--ds-space-3)',
        fontSize: 'var(--ds-text-2xs)',
        color: 'var(--ds-text-muted)',
      }}>
        {Object.entries(COMPATIBILITY_COLORS).map(([key, { dot, label }]) => (
          <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              display: 'inline-block',
              background: dot,
            }} />
            {label}
          </span>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 'var(--ds-space-2)', justifyContent: 'flex-end' }}>
        <button
          onClick={onAutoMap}
          style={{
            background: 'transparent',
            color: 'var(--ds-primary)',
            border: '1px dashed var(--ds-border)',
            borderRadius: 'var(--ds-radius-1)',
            padding: 'var(--ds-space-1) var(--ds-space-3)',
            cursor: 'pointer',
            fontSize: 'var(--ds-text-xs)',
          }}
        >
          Auto-map by name
        </button>
        <button
          onClick={onReset}
          style={{
            background: 'transparent',
            color: 'var(--ds-text-muted)',
            border: '1px dashed var(--ds-border)',
            borderRadius: 'var(--ds-radius-1)',
            padding: 'var(--ds-space-1) var(--ds-space-3)',
            cursor: 'pointer',
            fontSize: 'var(--ds-text-xs)',
          }}
        >
          Reset all
        </button>
        <button
          onClick={onApply}
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
          Apply mapping → body
        </button>
      </div>
    </div>
  );
}
