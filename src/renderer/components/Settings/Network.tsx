import { useState } from 'react';

export function NetworkPanel() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleDiagnose = async () => {
    setLoading(true);
    try {
      const r = await window.api.network.diagnose();
      setResult(r);
    } catch (err: any) {
      setResult({ ok: false, error: { code: 'ERROR', message: err.message } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3 style={{ color: 'var(--color-fg)', margin: '0 0 var(--space-3)' }}>Network</h3>

      <button onClick={handleDiagnose} disabled={loading} style={{
        padding: 'var(--space-3) var(--space-5)',
        background: 'var(--color-accent)', color: 'white',
        border: 'none', borderRadius: 'var(--radius-1)',
        cursor: 'pointer', fontSize: 14, fontWeight: 600,
        opacity: loading ? 0.5 : 1,
        marginBottom: 'var(--space-4)',
      }}>
        {loading ? 'Diagnosing...' : 'Diagnose Connection'}
      </button>

      {result ? (
        <div style={{
          padding: 'var(--space-4)', borderRadius: 'var(--radius-1)',
          background: 'var(--color-bg-tertiary)', fontSize: 13,
        }}>
          <div style={{ marginBottom: 'var(--space-2)' }}>
            <span style={{ color: 'var(--color-fg-muted)' }}>Target: </span>
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              {result.target?.url ?? 'N/A'}
            </code>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 'var(--space-2)' }}>
            <tbody>
              {[
                ['DNS', result.timing?.dns ?? 0],
                ['Connect', result.timing?.connect ?? 0],
                ['TLS', result.timing?.tls ?? 0],
                ['Wait', result.timing?.wait ?? 0],
                ['Total', result.timing?.total ?? 0],
              ].map(([label, value]) => (
                <tr key={label}>
                  <td style={{ padding: 'var(--space-1) 0', color: 'var(--color-fg-muted)' }}>{label}</td>
                  <td style={{ padding: 'var(--space-1) 0', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                    {value}ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-1)',
            background: result.ok ? 'var(--color-method-get)' : 'var(--color-method-delete)',
            color: 'white', fontWeight: 600, fontSize: 12,
          }}>
            {result.ok ? 'OK' : `Error: ${result.error?.code ?? 'UNKNOWN'} - ${result.error?.message ?? ''}`}
          </div>
        </div>
      ) : (
        <div style={{ color: 'var(--color-fg-muted)', fontSize: 13, fontStyle: 'italic' }}>
          Click 'Diagnose Connection' to probe the active environment
        </div>
      )}
    </div>
  );
}
