import { useState, useEffect } from 'react';

export function Sidebar() {
  const [status, setStatus] = useState<any>({ state: 'starting' });

  useEffect(() => {
    window.api.helper.getStatus().then(setStatus);
    const unsub = window.api.helper.onStatus(setStatus);
    return unsub;
  }, []);

  return (
    <div style={{ width: 240, borderRight: '1px solid var(--color-border)', padding: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', overflow: 'auto' }}>
      <div style={{ fontWeight: 600, fontSize: 11, textTransform: 'uppercase', color: 'var(--color-fg-muted)', letterSpacing: '0.05em' }}>Collections</div>
      <div style={{ color: 'var(--color-fg-muted)', fontSize: 13 }}>No collections yet</div>

      <div style={{ fontWeight: 600, fontSize: 11, textTransform: 'uppercase', color: 'var(--color-fg-muted)', letterSpacing: '0.05em' }}>Environments</div>
      <div style={{ color: 'var(--color-fg-muted)', fontSize: 13 }}>No environments yet</div>

      <div style={{ fontWeight: 600, fontSize: 11, textTransform: 'uppercase', color: 'var(--color-fg-muted)', letterSpacing: '0.05em' }}>History</div>
      <div style={{ color: 'var(--color-fg-muted)', fontSize: 13 }}>No requests sent yet</div>
    </div>
  );
}