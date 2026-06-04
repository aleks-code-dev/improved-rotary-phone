import type { ResponseResult } from '../../state/useResponse';

interface HeadersTabProps {
  result: ResponseResult;
}

export function ResponseHeadersTab({ result }: HeadersTabProps) {
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard write silently fails
    }
  };

  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ color: 'var(--color-fg-muted)', fontSize: 11 }}>
            <th style={cellStyle}>Key</th>
            <th style={cellStyle}>Value</th>
            <th style={{ ...cellStyle, width: 50 }}></th>
          </tr>
        </thead>
        <tbody>
          {result.headers.map((h, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-fg)' }}>
                {h.key}
              </td>
              <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', color: 'var(--color-fg)', wordBreak: 'break-all' }}>
                {h.value}
              </td>
              <td style={cellStyle}>
                <button onClick={() => handleCopy(h.value)} style={copyBtnStyle} title="Copy value">
                  Copy
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  padding: 'var(--space-1) var(--space-2)',
  textAlign: 'left',
  verticalAlign: 'top',
};

const copyBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--color-accent)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-1)',
  cursor: 'pointer',
  fontSize: 10,
  padding: '2px 6px',
};
