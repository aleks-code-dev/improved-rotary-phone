import { useState } from 'react';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [tab, setTab] = useState<'general' | 'appearance' | 'data' | 'network' | 'about'>('general');

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)',
    }}>
      <div style={{
        background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-2)',
        width: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--color-border)',
          padding: '0 var(--space-4)',
        }}>
          {(['general', 'appearance', 'data', 'network', 'about'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'transparent', border: 'none',
              borderBottom: tab === t ? '2px solid var(--color-accent)' : '2px solid transparent',
              color: tab === t ? 'var(--color-fg)' : 'var(--color-fg-muted)',
              cursor: 'pointer', fontSize: 13, textTransform: 'capitalize',
            }}>
              {t}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: 'var(--color-fg-muted)',
            cursor: 'pointer', fontSize: 20,
          }}>×</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-4)' }}>
          {tab === 'general' && <div style={{ color: 'var(--color-fg-muted)' }}>General settings coming in v1.1</div>}
          {tab === 'appearance' && <div style={{ color: 'var(--color-fg-muted)' }}>Appearance settings coming in v1.1</div>}
          {tab === 'data' && <DataLocation />}
          {tab === 'network' && <NetworkPanel />}
          {tab === 'about' && <AboutPanel />}
        </div>
      </div>
    </div>
  );
}

// --- Settings Panel Components ---

import { DataLocation } from './Settings/DataLocation';
import { NetworkPanel } from './Settings/Network';

function AboutPanel() {
  return (
    <div>
      <h3 style={{ color: 'var(--color-fg)', margin: '0 0 var(--space-3)' }}>About PostmanClone</h3>
      <p style={{ color: 'var(--color-fg-muted)', fontSize: 13 }}>Version 0.1.0</p>
      <p style={{ color: 'var(--color-fg-muted)', fontSize: 13 }}>
        A Postman-like API client for Java Spring developers.
        Built with Electron 42, React 19, and TypeScript.
      </p>
    </div>
  );
}
