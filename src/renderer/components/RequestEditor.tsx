import { useState } from 'react';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

const METHOD_COLORS: Record<string, string> = {
  GET: 'var(--color-method-get)',
  POST: 'var(--color-method-post)',
  PUT: 'var(--color-method-put)',
  PATCH: 'var(--color-method-patch)',
  DELETE: 'var(--color-method-delete)',
  HEAD: 'var(--color-method-head)',
  OPTIONS: 'var(--color-method-options)',
};

export function RequestEditor() {
  const [method, setMethod] = useState<string>('GET');
  const [url, setUrl] = useState('');
  const [diagnoseResult, setDiagnoseResult] = useState<any>(null);
  const [diagnosing, setDiagnosing] = useState(false);

  async function handleDiagnose() {
    setDiagnosing(true);
    try {
      const result = await window.api.request.diagnose();
      setDiagnoseResult(result);
    } finally {
      setDiagnosing(false);
    }
  }

  const isValidUrl = url.length === 0 || (() => {
    try { new URL(url); return true; } catch { return false; }
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--color-border)', padding: 'var(--space-3)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        <select
          value={method}
          onChange={e => setMethod(e.target.value)}
          style={{
            background: METHOD_COLORS[method],
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-1)',
            padding: 'var(--space-2) var(--space-3)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <input
          type="text"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://example.com/path"
          style={{
            flex: 1,
            padding: 'var(--space-2) var(--space-3)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-1)',
            background: 'var(--color-bg-elevated)',
            color: 'var(--color-fg)',
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
          }}
        />

        <button
          disabled={!isValidUrl}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            background: 'var(--color-accent)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-1)',
            fontWeight: 600,
            cursor: isValidUrl ? 'pointer' : 'not-allowed',
            opacity: isValidUrl ? 1 : 0.5,
          }}
        >
          Send
        </button>

        <button
          onClick={handleDiagnose}
          disabled={diagnosing}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            background: 'transparent',
            color: 'var(--color-fg-muted)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-1)',
            cursor: diagnosing ? 'not-allowed' : 'pointer',
          }}
        >
          {diagnosing ? 'Diagnosing...' : 'Diagnose Connection'}
        </button>

        <button
          style={{
            padding: 'var(--space-2) var(--space-4)',
            background: 'transparent',
            color: 'var(--color-fg-muted)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-1)',
            cursor: 'pointer',
          }}
        >
          Copy as cURL
        </button>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', fontSize: 12 }}>
        {['Params', 'Headers', 'Body', 'Auth', 'Settings'].map(tab => (
          <span key={tab} style={{ padding: 'var(--space-1) var(--space-2)', color: 'var(--color-fg-muted)', cursor: 'pointer', borderBottom: '2px solid transparent' }}>{tab}</span>
        ))}
      </div>
    </div>
  );
}