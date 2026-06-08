import { useRequest } from '../../state/useRequest';

interface ParamsTabProps {
  tabId: string;
}

export function ParamsTab({ tabId }: ParamsTabProps) {
  const spec = useRequest((s) => s.specs[tabId]);
  const queryParams = spec?.queryParams ?? [];

  const addQueryParam = useRequest((s) => s.addQueryParam);
  const updateQueryParam = useRequest((s) => s.updateQueryParam);
  const removeQueryParam = useRequest((s) => s.removeQueryParam);

  const cellStyle: React.CSSProperties = {
    padding: 'var(--space-1) var(--space-2)',
    fontSize: 12,
  };

  return (
    <div style={{ padding: 'var(--space-3)', overflow: 'auto', fontSize: 12 }}>
      <h4 style={{ margin: '0 0 var(--space-2)', color: 'var(--color-fg)', fontSize: 13 }}>Query Params</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 'var(--space-3)' }}>
        <thead>
          <tr style={{ color: 'var(--color-fg-muted)', fontSize: 11 }}>
            <th style={{ ...cellStyle, width: 30, textAlign: 'left' }}></th>
            <th style={{ ...cellStyle, textAlign: 'left' }}>Key</th>
            <th style={{ ...cellStyle, textAlign: 'left' }}>Value</th>
            <th style={{ ...cellStyle, width: 30 }}></th>
          </tr>
        </thead>
        <tbody>
          {queryParams.map((p, i) => (
            <tr key={i}>
              <td style={cellStyle}>
                <input
                  type="checkbox"
                  checked={p.enabled}
                  onChange={(e) => updateQueryParam(tabId, i, { enabled: e.target.checked })}
                />
              </td>
              <td style={cellStyle}>
                <input
                  type="text"
                  value={p.key}
                  onChange={(e) => updateQueryParam(tabId, i, { key: e.target.value })}
                  placeholder="key"
                  style={inputStyle}
                />
              </td>
              <td style={cellStyle}>
                <input
                  type="text"
                  value={p.value}
                  onChange={(e) => updateQueryParam(tabId, i, { value: e.target.value })}
                  placeholder="value"
                  style={inputStyle}
                />
              </td>
              <td style={cellStyle}>
                <button onClick={() => removeQueryParam(tabId, i)} style={removeBtnStyle}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={() => addQueryParam(tabId)} style={addBtnStyle}>+ Add row</button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-1)',
  background: 'var(--color-bg-elevated)',
  color: 'var(--color-fg)',
  fontSize: 12,
  fontFamily: 'var(--font-mono)',
};

const addBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--color-accent)',
  border: '1px dashed var(--color-border)',
  borderRadius: 'var(--radius-1)',
  padding: 'var(--space-1) var(--space-3)',
  cursor: 'pointer',
  fontSize: 12,
};

const removeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--color-fg-muted)',
  border: 'none',
  cursor: 'pointer',
  fontSize: 14,
  padding: '2px 6px',
};
