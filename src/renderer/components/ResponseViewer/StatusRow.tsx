import type { ResponseState, ResponseResult } from '../../state/useResponse';

interface StatusRowProps {
  state: ResponseState;
  onSaveToFile: () => void;
}

function getStatusClass(code: number): string {
  if (code >= 200 && code < 300) return 'var(--color-status-2xx)';
  if (code >= 300 && code < 400) return 'var(--color-status-3xx)';
  if (code >= 400 && code < 500) return 'var(--color-status-4xx)';
  if (code >= 500 && code < 600) return 'var(--color-status-5xx)';
  return 'var(--color-fg-muted)';
}

export function StatusRow({ state, onSaveToFile }: StatusRowProps) {
  const { status, result, error } = state;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      padding: 'var(--space-2) var(--space-3)',
      borderBottom: '1px solid var(--color-border)',
      minHeight: 48,
      flexWrap: 'wrap',
    }}>
      {status === 'idle' && (
        <span style={{ color: 'var(--color-fg-muted)', fontSize: 13 }}>
          Send a request to see the response
        </span>
      )}

      {status === 'sending' && (
        <>
          <span style={spinnerStyle} />
          <span style={{ color: 'var(--color-fg-muted)', fontSize: 13 }}>Sending…</span>
        </>
      )}

      {status === 'done' && result && (
        <>
          <span style={{
            fontSize: 18,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: getStatusClass(result.status),
          }}>
            {result.status}
          </span>
          <span style={{ color: 'var(--color-fg)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
            {result.statusText}
          </span>
          <span style={{ color: 'var(--color-fg-muted)', fontSize: 12 }}>
            {result.timing.total}ms
          </span>
          {result.httpVersion && (
            <span style={{ color: 'var(--color-fg-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              {result.httpVersion}
            </span>
          )}
          {result.bodyTruncated && (
            <div style={{
              marginLeft: 'auto',
              padding: 'var(--space-1) var(--space-3)',
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-method-put)',
              borderRadius: 'var(--radius-1)',
              fontSize: 11,
              color: 'var(--color-fg)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}>
              <span>Body truncated at 1MB — full size: {result.bodySizeBytes.toLocaleString()} bytes</span>
              <button onClick={onSaveToFile} style={saveBtnStyle}>Save to file</button>
            </div>
          )}
        </>
      )}

      {status === 'error' && error && (
        <>
          <span style={{
            fontSize: 18,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-status-5xx)',
          }}>
            {error.code}
          </span>
          <span style={{ color: 'var(--color-fg)', fontSize: 13 }}>{error.message}</span>
        </>
      )}

      {status === 'cancelled' && (
        <span style={{ color: 'var(--color-fg-muted)', fontSize: 13, fontStyle: 'italic' }}>
          Cancelled by user
        </span>
      )}
    </div>
  );
}

const spinnerStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  border: '2px solid var(--color-border)',
  borderTop: '2px solid var(--color-accent)',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};

const saveBtnStyle: React.CSSProperties = {
  background: 'var(--color-accent)',
  color: 'white',
  border: 'none',
  borderRadius: 'var(--radius-1)',
  padding: '2px var(--space-2)',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 600,
};
