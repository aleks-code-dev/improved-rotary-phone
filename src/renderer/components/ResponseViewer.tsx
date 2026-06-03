import { useState } from 'react';

interface DiagnoseResult {
  ok: boolean;
  error?: { code: string; message: string };
  timing: { dns: number; connect: number; tls: number; request: number; wait: number; response: number; total: number };
  target: { url: string; host: string; port: number };
}

export function ResponseViewer() {
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'cookies' | 'timing'>('body');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderTop: '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-border)' }}>
        {(['body', 'headers', 'cookies', 'timing'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: 'var(--space-1) var(--space-3)',
              background: activeTab === tab ? 'var(--color-accent)' : 'transparent',
              color: activeTab === tab ? 'white' : 'var(--color-fg-muted)',
              border: 'none',
              borderRadius: 'var(--radius-1)',
              cursor: 'pointer',
              textTransform: 'capitalize',
              fontSize: 13,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, padding: 'var(--space-4)', overflow: 'auto', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
        <div style={{ color: 'var(--color-fg-muted)', textAlign: 'center', padding: 'var(--space-6)' }}>
          Empty response
        </div>
      </div>
    </div>
  );
}