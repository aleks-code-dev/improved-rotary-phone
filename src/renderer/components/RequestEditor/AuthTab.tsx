import { useState } from 'react';
import { useRequest, type AuthType } from '../../state/useRequest';

interface AuthTabProps {
  tabId: string;
}

export function AuthTab({ tabId }: AuthTabProps) {
  const spec = useRequest((s) => s.specs[tabId]);
  const setAuth = useRequest((s) => s.setAuth);
  const auth = spec?.auth ?? { type: 'none' as const };

  const handleTypeChange = (type: AuthType) => {
    if (type === 'bearer') setAuth(tabId, { type: 'bearer', token: '' });
    else if (type === 'basic') setAuth(tabId, { type: 'basic', username: '', password: '' });
    else if (type === 'api-key') setAuth(tabId, { type: 'api-key', key: '', value: '', in: 'header' });
    else setAuth(tabId, { type: 'none' });
  };

  return (
    <div style={{ padding: 'var(--space-3)', overflow: 'auto', fontSize: 12 }}>
      <div style={{ marginBottom: 'var(--space-3)' }}>
        <select
          value={auth.type}
          onChange={(e) => handleTypeChange(e.target.value as AuthType)}
          style={selectStyle}
        >
          <option value="none">None</option>
          <option value="bearer">Bearer Token</option>
          <option value="basic">Basic Auth</option>
          <option value="api-key">API Key</option>
        </select>
      </div>

      {auth.type === 'none' && (
        <div style={{ color: 'var(--color-fg-muted)', padding: 'var(--space-4)', textAlign: 'center' }}>
          No authentication
        </div>
      )}

      {auth.type === 'bearer' && (
        <SecretField
          label="Token"
          value={auth.token}
          onChange={(v) => setAuth(tabId, { ...auth, token: v })}
          showEnvVar
        />
      )}

      {auth.type === 'basic' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div>
            <label style={labelStyle}>Username</label>
            <input
              type="text"
              value={auth.username}
              onChange={(e) => setAuth(tabId, { ...auth, username: e.target.value })}
              style={inputStyle}
            />
          </div>
          <SecretField
            label="Password"
            value={auth.password}
            onChange={(v) => setAuth(tabId, { ...auth, password: v })}
            showEnvVar
          />
        </div>
      )}

      {auth.type === 'api-key' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div>
            <label style={labelStyle}>Key</label>
            <input
              type="text"
              value={auth.key}
              onChange={(e) => setAuth(tabId, { ...auth, key: e.target.value })}
              placeholder="X-API-Key"
              style={inputStyle}
            />
          </div>
          <SecretField
            label="Value"
            value={auth.value}
            onChange={(v) => setAuth(tabId, { ...auth, value: v })}
            showEnvVar
          />
          <div>
            <label style={labelStyle}>Add to</label>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <label style={radioLabelStyle}>
                <input
                  type="radio"
                  checked={auth.in === 'header'}
                  onChange={() => setAuth(tabId, { ...auth, in: 'header' })}
                  style={{ marginRight: 4 }}
                />
                Header
              </label>
              <label style={radioLabelStyle}>
                <input
                  type="radio"
                  checked={auth.in === 'query'}
                  onChange={() => setAuth(tabId, { ...auth, in: 'query' })}
                  style={{ marginRight: 4 }}
                />
                Query Params
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SecretField({ label, value, onChange, showEnvVar }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  showEnvVar?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
        <input
          type={revealed ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={value ? '••••••' : label}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={() => setRevealed(!revealed)}
          style={revealBtnStyle}
          title={revealed ? 'Hide' : 'Show'}
        >
          {revealed ? '🙈' : '👁'}
        </button>
        {showEnvVar && value && !value.startsWith('{{') && (
          <button
            onClick={() => onChange(`{{${label.toLowerCase()}}}`)}
            style={{ ...revealBtnStyle, fontSize: 10, padding: '4px 6px' }}
            title="Use env var"
          >
            {'{{}}'}
          </button>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: 'var(--color-fg-muted)',
  fontSize: 11,
  marginBottom: 4,
};
const selectStyle: React.CSSProperties = {
  padding: 'var(--space-1) var(--space-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-1)',
  background: 'var(--color-bg-elevated)',
  color: 'var(--color-fg)',
  fontSize: 12,
  minWidth: 180,
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--space-1) var(--space-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-1)',
  background: 'var(--color-bg-elevated)',
  color: 'var(--color-fg)',
  fontSize: 12,
  fontFamily: 'var(--font-mono)',
};
const radioLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  color: 'var(--color-fg)',
  cursor: 'pointer',
  fontSize: 12,
};
const revealBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-1)',
  cursor: 'pointer',
  padding: '4px 8px',
  fontSize: 14,
};
