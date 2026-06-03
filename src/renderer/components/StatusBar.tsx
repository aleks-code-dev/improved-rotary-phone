import { useState, useEffect } from 'react';

export function StatusBar() {
  const [status, setStatus] = useState<any>({ state: 'starting' });

  useEffect(() => {
    window.api.helper.getStatus().then(setStatus);
    const unsub = window.api.helper.onStatus(setStatus);
    return unsub;
  }, []);

  const stateIcon = status.state === 'healthy' ? '●' : status.state === 'starting' ? '○' : status.state === 'restarting' ? '↻' : '✗';
  const stateColor = status.state === 'healthy' ? 'var(--color-status-2xx)' : status.state === 'starting' || status.state === 'restarting' ? 'var(--color-status-3xx)' : 'var(--color-status-5xx)';

  const stateLabel = () => {
    switch (status.state) {
      case 'healthy': return `● Healthy${status.pid ? ` (pid ${status.pid}, v${status.version})` : ''}`;
      case 'starting': return '○ Starting...';
      case 'restarting': return `↻ Restarting (attempt ${status.attempt}, next in ${Math.round(status.nextInMs / 1000)}s)`;
      case 'offline': return `✗ Offline — ${status.reason}`;
      case 'crashed': return `✗ Crashed (${status.restartCount} restarts)`;
      default: return '○ Unknown';
    }
  };

  return (
    <div style={{
      height: 24,
      borderTop: '1px solid var(--color-border)',
      padding: '0 var(--space-3)',
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      fontSize: 12,
      background: 'var(--color-bg-elevated)',
    }}>
      <span style={{ color: stateColor, cursor: 'pointer' }} title="Helper status">{stateLabel()}</span>
      <span style={{ color: 'var(--color-fg-muted)' }}>·</span>
      <span style={{ color: 'var(--color-fg-muted)' }}>Env: No env</span>
      <div style={{ flex: 1 }} />
      <button
        onClick={() => window.api.helper.restart()}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--color-fg-muted)',
          cursor: 'pointer',
          fontSize: 12,
          padding: '2px 4px',
        }}
      >
        Restart helper
      </button>
    </div>
  );
}