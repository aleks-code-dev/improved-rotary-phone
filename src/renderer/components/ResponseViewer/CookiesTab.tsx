import type { ResponseResult } from '../../state/useResponse';

interface CookiesTabProps {
  result: ResponseResult;
}

export function ResponseCookiesTab({ result }: CookiesTabProps) {
  if (!result.cookies || result.cookies.length === 0) {
    return (
      <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-fg-muted)', fontSize: 13 }}>
        No cookies in this response.
      </div>
    );
  }

  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ color: 'var(--color-fg-muted)', fontSize: 11 }}>
            <th style={cellStyle}>Name</th>
            <th style={cellStyle}>Value</th>
            <th style={cellStyle}>Domain</th>
            <th style={cellStyle}>Path</th>
            <th style={cellStyle}>Expires</th>
            <th style={{ ...cellStyle, width: 30 }}>HTTP</th>
            <th style={{ ...cellStyle, width: 30 }}>Secure</th>
          </tr>
        </thead>
        <tbody>
          {result.cookies.map((c, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ ...cellStyle, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{c.name}</td>
              <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{c.value}</td>
              <td style={{ ...cellStyle, color: 'var(--color-fg-muted)' }}>{c.domain || '—'}</td>
              <td style={{ ...cellStyle, color: 'var(--color-fg-muted)' }}>{c.path || '—'}</td>
              <td style={{ ...cellStyle, color: 'var(--color-fg-muted)', fontSize: 10 }}>{c.expires || '—'}</td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>{c.httpOnly ? '✓' : '—'}</td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>{c.secure ? '✓' : '—'}</td>
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
  whiteSpace: 'nowrap',
};
