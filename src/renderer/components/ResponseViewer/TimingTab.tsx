import type { ResponseResult } from '../../state/useResponse';

interface TimingTabProps {
  result: ResponseResult;
}

const TIMING_ROWS: Array<{ key: keyof ResponseResult['timing']; label: string; v1Note?: string }> = [
  { key: 'dns', label: 'DNS', v1Note: 'Detailed timing requires v1.1' },
  { key: 'connect', label: 'Connect', v1Note: 'Detailed timing requires v1.1' },
  { key: 'tls', label: 'TLS', v1Note: 'Detailed timing requires v1.1' },
  { key: 'request', label: 'Request' },
  { key: 'wait', label: 'Wait' },
  { key: 'response', label: 'Response' },
];

export function ResponseTimingTab({ result }: TimingTabProps) {
  return (
    <div style={{ overflow: 'auto', height: '100%', padding: 'var(--space-3)' }}>
      <table style={{ width: '100%', maxWidth: 400, borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ color: 'var(--color-fg-muted)', fontSize: 11 }}>
            <th style={labelCell}>Phase</th>
            <th style={valueCell}>Time (ms)</th>
          </tr>
        </thead>
        <tbody>
          {TIMING_ROWS.map(({ key, label, v1Note }) => (
            <tr key={key} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={labelCell}>
                {label}
                {v1Note && result.timing[key] === 0 && (
                  <span style={{ fontSize: 10, color: 'var(--color-fg-muted)', marginLeft: 4 }} title={v1Note}>*</span>
                )}
              </td>
              <td style={valueCell}>
                {result.timing[key]}ms
              </td>
            </tr>
          ))}
          <tr style={{ borderTop: '2px solid var(--color-border)', fontWeight: 700 }}>
            <td style={{ ...labelCell, fontWeight: 700 }}>Total</td>
            <td style={{ ...valueCell, fontWeight: 700 }}>{result.timing.total}ms</td>
          </tr>
        </tbody>
      </table>
      {result.timing.dns === 0 && result.timing.connect === 0 && result.timing.tls === 0 && (
        <div style={{ marginTop: 'var(--space-3)', fontSize: 11, color: 'var(--color-fg-muted)', maxWidth: 400 }}>
          * Detailed DNS/Connect/TLS breakdown requires v1.1. v1 shows total, wait, and response times.
        </div>
      )}
    </div>
  );
}

const labelCell: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  textAlign: 'left',
  fontFamily: 'var(--font-mono)',
  color: 'var(--color-fg)',
};

const valueCell: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  textAlign: 'right',
  fontFamily: 'var(--font-mono)',
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--color-fg)',
};
