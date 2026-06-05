import { useState, useCallback, useEffect } from 'react';

interface DbConnectionFormProps {
  onConnectionCreated?: () => void;
}

interface ParsedUrl {
  driver: string | null;
  host: string | null;
  port: number | null;
  database: string | null;
  raw: string;
}

const selectStyle: React.CSSProperties = {
  padding: 'var(--space-1) var(--space-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-1)',
  background: 'var(--color-bg-elevated)',
  color: 'var(--color-fg)',
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
const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--color-fg-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};
const btnPrimary: React.CSSProperties = {
  background: 'var(--color-accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius-1)',
  padding: 'var(--space-1) var(--space-3)',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
};
const btnSecondary: React.CSSProperties = {
  background: 'var(--color-bg-elevated)',
  color: 'var(--color-accent)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-1)',
  padding: 'var(--space-1) var(--space-3)',
  cursor: 'pointer',
  fontSize: 12,
};

export function DbConnectionForm({ onConnectionCreated }: DbConnectionFormProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [dbType, setDbType] = useState<'postgresql' | 'mysql' | 'oracle' | 'h2'>('postgresql');
  const [parsedUrl, setParsedUrl] = useState<ParsedUrl | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; latencyMs?: number; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Auto-detect dbType from JDBC URL
  useEffect(() => {
    if (url.startsWith('jdbc:postgresql:')) setDbType('postgresql');
    else if (url.startsWith('jdbc:mysql:')) setDbType('mysql');
    else if (url.startsWith('jdbc:oracle:')) setDbType('oracle');
    else if (url.startsWith('jdbc:h2:')) setDbType('h2');
  }, [url]);

  // Parse JDBC URL on change (debounced)
  useEffect(() => {
    if (!url) { setParsedUrl(null); return; }
    const timer = setTimeout(async () => {
      try {
        const result = await window.api.db.parseJdbcUrl({ url });
        setParsedUrl(result);
      } catch { setParsedUrl(null); }
    }, 300);
    return () => clearTimeout(timer);
  }, [url]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.api.db.testConnection({ url, user, password, dbType });
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ ok: false, error: err.message });
    } finally {
      setTesting(false);
    }
  }, [url, user, password, dbType]);

  const handleSave = useCallback(async () => {
    if (!name || !url) return;
    setSaving(true);
    try {
      await window.api.db.connections.create({ name, url, user, password, dbType });
      onConnectionCreated?.();
      setName(''); setUrl(''); setUser(''); setPassword('');
    } catch {
      // Error handled silently
    } finally {
      setSaving(false);
    }
  }, [name, url, user, password, dbType, onConnectionCreated]);

  return (
    <div style={{ padding: 'var(--space-3)', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div>
        <label style={labelStyle}>Connection Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My App Dev DB" style={inputStyle} />
      </div>

      <div>
        <label style={labelStyle}>JDBC URL</label>
        <textarea
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="jdbc:postgresql://localhost:5432/mydb"
          style={{ ...inputStyle, minHeight: 48, resize: 'vertical' }}
        />
      </div>

      {/* Parsed URL grid */}
      {parsedUrl && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: 'var(--space-2)',
          padding: 'var(--space-2)',
          background: 'var(--color-bg)',
          borderRadius: 'var(--radius-1)',
          border: '1px solid var(--color-border)',
        }}>
          <div><span style={labelStyle}>Driver</span><div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{parsedUrl.driver ?? 'Unknown'}</div></div>
          <div><span style={labelStyle}>Host</span><div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{parsedUrl.host ?? '-'}</div></div>
          <div><span style={labelStyle}>Port</span><div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{parsedUrl.port ?? '-'}</div></div>
          <div><span style={labelStyle}>Database</span><div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{parsedUrl.database ?? '-'}</div></div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
        <div>
          <label style={labelStyle}>Username</label>
          <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="postgres" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              style={inputStyle}
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-fg-muted)', cursor: 'pointer', fontSize: 12 }}
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        <button onClick={handleTest} disabled={!url || testing} style={btnSecondary}>
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        {testResult && (
          <span style={{ fontSize: 12, color: testResult.connected ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {testResult.connected ? `Connected in ${testResult.latencyMs}ms` : `Failed: ${testResult.error ?? 'Unknown error'}`}
          </span>
        )}
      </div>

      <button onClick={handleSave} disabled={!name || !url || saving} style={btnPrimary}>
        {saving ? 'Saving...' : 'Save Connection'}
      </button>
    </div>
  );
}
