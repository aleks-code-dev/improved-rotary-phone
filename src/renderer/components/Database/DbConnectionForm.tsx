import { useState, useCallback, useEffect } from 'react';
import { IconButton } from '../ui/IconButton';

interface DbConnectionFormProps {
  onConnectionCreated?: (connectionId: string) => void;
}

interface ParsedUrl {
  driver: string | null;
  host: string | null;
  port: number | null;
  database: string | null;
  raw: string;
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--ds-text-2xs)',
  fontWeight: 600,
  color: 'var(--ds-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 'var(--ds-space-1)',
};

const urlInputStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--ds-space-2) var(--ds-space-3)',
  border: '1px solid var(--ds-border)',
  borderRadius: 'var(--ds-radius-1)',
  background: 'var(--ds-editor-bg)',
  color: 'var(--ds-text)',
  fontSize: 'var(--ds-text-sm)',
  fontFamily: 'var(--ds-font-mono)',
  outline: 'none',
};

const standardInputStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--ds-space-2) var(--ds-space-3)',
  border: '1px solid var(--ds-border)',
  borderRadius: 'var(--ds-radius-1)',
  background: 'var(--ds-surface)',
  color: 'var(--ds-text)',
  fontSize: 'var(--ds-text-sm)',
  fontFamily: 'var(--ds-font-sans)',
};

const monoTextStyle: React.CSSProperties = {
  fontFamily: 'var(--ds-font-mono)',
  fontSize: 'var(--ds-text-sm)',
  color: 'var(--ds-text)',
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
  const [testResult, setTestResult] = useState<{ ok: boolean; latencyMs?: number; error?: string; connected?: boolean } | null>(null);
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
    setTestResult(null);
    try {
      const { id } = await window.api.db.connections.create({ name, url, user, password, dbType });
      const result = await window.api.db.connect({ connectionId: id });
      if (!result?.ok) {
        // Keep form open so the user can fix credentials and retry.
        setTestResult({ ok: false, error: result?.error ?? 'Connect failed after save' });
        setSaving(false);
        return;
      }
      onConnectionCreated?.(id);
      setName(''); setUrl(''); setUser(''); setPassword('');
    } catch (err: any) {
      setTestResult({ ok: false, error: err?.message ?? 'Save failed' });
    } finally {
      setSaving(false);
    }
  }, [name, url, user, password, dbType, onConnectionCreated]);

  return (
    <div style={{ padding: 'var(--ds-space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-3)' }}>
      <div>
        <label style={labelStyle}>Connection Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My App Dev DB"
          style={standardInputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>JDBC URL</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="jdbc:postgresql://localhost:5432/mydb"
          style={urlInputStyle}
        />
      </div>

      {/* Parsed URL grid (006-B) */}
      {parsedUrl && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto 1fr',
          gap: 'var(--ds-space-2) var(--ds-space-3)',
          padding: 'var(--ds-space-3)',
          background: 'var(--ds-surface)',
          borderRadius: 'var(--ds-radius-1)',
          border: '1px solid var(--ds-border)',
        }}>
          <span style={labelStyle}>Driver</span>
          <span style={monoTextStyle}>{parsedUrl.driver ?? 'Unknown'}</span>
          <span style={labelStyle}>Host</span>
          <span style={monoTextStyle}>{parsedUrl.host ?? '-'}</span>
          <span style={labelStyle}>Port</span>
          <span style={monoTextStyle}>{parsedUrl.port ?? '-'}</span>
          <span style={labelStyle}>Database</span>
          <span style={monoTextStyle}>{parsedUrl.database ?? '-'}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ds-space-3)' }}>
        <div>
          <label style={labelStyle}>Username</label>
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="postgres"
            style={standardInputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              style={{ ...standardInputStyle, paddingRight: 'var(--ds-space-7)' }}
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              type="button"
              style={{
                position: 'absolute',
                right: 'var(--ds-space-2)',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--ds-text-muted)',
                cursor: 'pointer',
                fontSize: 'var(--ds-text-sm)',
                padding: 'var(--ds-space-1)',
              }}
              title={showPassword ? 'Hide password' : 'Show password'}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--ds-space-2)', alignItems: 'center' }}>
        <IconButton
          variant="outline"
          onClick={handleTest}
          disabled={!url || testing}
        >
          {testing ? 'Testing…' : 'Test Connection'}
        </IconButton>
        {testResult && (
          <span style={{
            fontSize: 'var(--ds-text-sm)',
            color: testResult.connected || testResult.ok ? 'var(--ds-method-get)' : 'var(--ds-method-delete)',
            fontWeight: 500,
          }}>
            {testResult.connected || testResult.ok
              ? `✓ Connected in ${testResult.latencyMs}ms`
              : `✗ ${testResult.error ?? 'Unknown error'}`}
          </span>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={!name || !url || saving}
        style={{
          background: 'var(--ds-primary)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--ds-radius-1)',
          padding: 'var(--ds-space-2) var(--ds-space-3)',
          cursor: !name || !url || saving ? 'not-allowed' : 'pointer',
          fontSize: 'var(--ds-text-sm)',
          fontWeight: 600,
          opacity: !name || !url || saving ? 0.5 : 1,
        }}
      >
        {saving ? 'Saving…' : 'Save Connection'}
      </button>
    </div>
  );
}
