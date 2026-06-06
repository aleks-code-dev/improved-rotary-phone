import { useState, useEffect } from 'react';
import { useEndpointsStore } from '../store/endpoints';

export function StatusBar() {
  const [status, setStatus] = useState<any>({ state: 'starting' });
  const scanStatus = useEndpointsStore((s) => s.scanStatus);
  const lastScanResult = useEndpointsStore((s) => s.lastScanResult);
  const lastScanError = useEndpointsStore((s) => s.lastScanError);
  const activeProjectId = useEndpointsStore((s) => s.activeProjectId);

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

  const scannerLabel = () => {
    if (!activeProjectId && scanStatus === 'idle') {
      return { icon: '○', color: 'var(--color-fg-muted)', text: 'Spring: not scanned' };
    }
    if (scanStatus === 'scanning') {
      const count = lastScanResult?.totalEndpoints ?? 0;
      return { icon: '○', color: 'var(--color-status-3xx)', text: `Spring: scanning... (${count})` };
    }
    if (scanStatus === 'error') {
      return { icon: '✗', color: 'var(--color-status-5xx)', text: 'Spring: scan failed' };
    }
    if (lastScanResult) {
      return { icon: '●', color: 'var(--color-status-2xx)', text: `Spring: ${lastScanResult.totalEndpoints} endpoints` };
    }
    return { icon: '○', color: 'var(--color-fg-muted)', text: 'Spring: not scanned' };
  };

  const scanner = scannerLabel();

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
      <span style={{ color: scanner.color }} aria-live="polite" title="Scanner status">
        {scanner.icon} {scanner.text}
      </span>
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
