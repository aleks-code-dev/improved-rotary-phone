import { useRequest } from '../../state/useRequest';

interface SettingsTabProps {
  tabId: string;
}

export function SettingsTab({ tabId }: SettingsTabProps) {
  const spec = useRequest((s) => s.specs[tabId]);
  const setSettings = useRequest((s) => s.setSettings);
  const settings = spec?.settings ?? {
    timeoutMs: 30000,
    followRedirects: true,
    maxRedirects: 10,
    sslVerify: true,
    saveCookiesToJar: false,
  };

  return (
    <div style={{ padding: 'var(--space-3)', overflow: 'auto', fontSize: 12 }}>
      <div style={{ maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Timeout */}
        <div>
          <label style={labelStyle}>Timeout: {settings.timeoutMs}ms ({settings.timeoutMs / 1000}s)</label>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <input
              type="range"
              min={1}
              max={600000}
              step={1000}
              value={settings.timeoutMs}
              onChange={(e) => setSettings(tabId, { timeoutMs: parseInt(e.target.value) })}
              style={{ flex: 1 }}
            />
            <input
              type="number"
              min={1}
              max={600000}
              value={settings.timeoutMs}
              onChange={(e) => setSettings(tabId, { timeoutMs: Math.max(1, Math.min(600000, parseInt(e.target.value) || 30000)) })}
              style={numberInputStyle}
            />
          </div>
        </div>

        {/* Follow redirects */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <input
            type="checkbox"
            checked={settings.followRedirects}
            onChange={(e) => setSettings(tabId, { followRedirects: e.target.checked })}
          />
          <label style={{ color: 'var(--color-fg)', cursor: 'pointer' }}>Follow redirects</label>
        </div>

        {/* Max redirects */}
        <div>
          <label style={{ ...labelStyle, opacity: settings.followRedirects ? 1 : 0.5 }}>Max redirects: {settings.maxRedirects}</label>
          <input
            type="number"
            min={0}
            max={50}
            value={settings.maxRedirects}
            disabled={!settings.followRedirects}
            onChange={(e) => setSettings(tabId, { maxRedirects: Math.max(0, Math.min(50, parseInt(e.target.value) || 0)) })}
            style={{ ...numberInputStyle, opacity: settings.followRedirects ? 1 : 0.5 }}
          />
        </div>

        {/* SSL verify */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <input
            type="checkbox"
            checked={settings.sslVerify}
            onChange={(e) => setSettings(tabId, { sslVerify: e.target.checked })}
          />
          <label style={{ color: 'var(--color-fg)', cursor: 'pointer' }}>SSL certificate verification</label>
        </div>

        {/* Save cookies to jar (D-32: v1.5) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <input
            type="checkbox"
            checked={settings.saveCookiesToJar}
            disabled
            title="Cookie jar ships in v1.5"
          />
          <label style={{ color: 'var(--color-fg-muted)', cursor: 'not-allowed' }} title="Cookie jar ships in v1.5">
            Save cookies to jar
          </label>
        </div>
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

const numberInputStyle: React.CSSProperties = {
  width: 80,
  padding: 'var(--space-1) var(--space-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-1)',
  background: 'var(--color-bg-elevated)',
  color: 'var(--color-fg)',
  fontSize: 12,
  fontFamily: 'var(--font-mono)',
};
