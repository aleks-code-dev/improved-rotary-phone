import { useState } from 'react';
import { useRequest } from '../../state/useRequest';

interface HeadersTabProps {
  tabId: string;
}

export function HeadersTab({ tabId }: HeadersTabProps) {
  const spec = useRequest((s) => s.specs[tabId]);
  const headers = spec?.headers ?? [];
  const addHeader = useRequest((s) => s.addHeader);
  const updateHeader = useRequest((s) => s.updateHeader);
  const removeHeader = useRequest((s) => s.removeHeader);
  const [commonHeader, setCommonHeader] = useState('');

  const handleCommonHeader = (value: string) => {
    if (value) {
      addHeader(tabId, { key: value, value: '' });
      setCommonHeader('');
    }
  };

  return (
    <div style={{ padding: 'var(--space-3)', overflow: 'auto', fontSize: 12 }}>
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', alignItems: 'center' }}>
        <select
          value={commonHeader}
          onChange={(e) => handleCommonHeader(e.target.value)}
          style={selectStyle}
        >
          <option value="">Common headers…</option>
          <option value="Content-Type">Content-Type</option>
          <option value="Accept">Accept</option>
        </select>
        <button onClick={() => addHeader(tabId)} style={addBtnStyle}>+ Add row</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ color: 'var(--color-fg-muted)', fontSize: 11 }}>
            <th style={cellStyle}></th>
            <th style={{ ...cellStyle, textAlign: 'left' }}>Key</th>
            <th style={{ ...cellStyle, textAlign: 'left' }}>Value</th>
            <th style={{ ...cellStyle, width: 30 }}></th>
          </tr>
        </thead>
        <tbody>
          {headers.map((h, i) => (
            <tr key={i}>
              <td style={cellStyle}>
                <input
                  type="checkbox"
                  checked={h.enabled}
                  onChange={(e) => updateHeader(tabId, i, { enabled: e.target.checked })}
                />
              </td>
              <td style={cellStyle}>
                <input
                  type="text"
                  value={h.key}
                  onChange={(e) => updateHeader(tabId, i, { key: e.target.value })}
                  placeholder="key"
                  style={inputStyle}
                />
              </td>
              <td style={cellStyle}>
                <input
                  type="text"
                  value={h.value}
                  onChange={(e) => updateHeader(tabId, i, { value: e.target.value })}
                  placeholder="value"
                  style={inputStyle}
                />
              </td>
              <td style={cellStyle}>
                <button onClick={() => removeHeader(tabId, i)} style={removeBtnStyle}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cellStyle: React.CSSProperties = { padding: 'var(--space-1) var(--space-2)', fontSize: 12 };
const selectStyle: React.CSSProperties = {
  padding: 'var(--space-1) var(--space-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-1)',
  background: 'var(--color-bg-elevated)',
  color: 'var(--color-fg-muted)',
  fontSize: 12,
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
const removeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--color-fg-muted)',
  border: 'none',
  cursor: 'pointer',
  fontSize: 14,
  padding: '2px 6px',
};
