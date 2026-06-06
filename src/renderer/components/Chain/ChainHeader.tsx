import React, { useState, useRef, useEffect } from 'react';

interface ChainHeaderProps {
  chain: { id: string; name: string; steps: any[] };
  isRunning: boolean;
  isStopping: boolean;
  progress: { stepIndex: number; totalSteps: number; status: string } | null;
  onSave: () => void;
  onRun: () => void;
  onStop: () => void;
  onNameChange: (name: string) => void;
}

export function ChainHeader({ chain, isRunning, isStopping, progress, onSave, onRun, onStop, onNameChange }: ChainHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(chain.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const stepCount = chain.steps?.length ?? 0;
  const progressPercent = progress ? Math.round((progress.stepIndex / progress.totalSteps) * 100) : 0;

  return (
    <div style={{
      background: 'var(--color-bg-elevated)',
      borderBottom: '1px solid var(--color-border)',
      padding: 'var(--space-3) var(--space-4)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <span style={{ fontSize: 14 }}>🔗</span>
        {editing ? (
          <input
            ref={inputRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={() => { setEditing(false); onNameChange(editName); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { setEditing(false); onNameChange(editName); } if (e.key === 'Escape') { setEditing(false); setEditName(chain.name); } }}
            style={{
              fontSize: 14,
              fontWeight: 600,
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-1)',
              padding: '2px 6px',
              color: 'var(--color-fg)',
              outline: 'none',
            }}
          />
        ) : (
          <span
            onClick={() => setEditing(true)}
            style={{ fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            {chain.name}
          </span>
        )}
        <span style={{
          background: 'var(--color-chain-badge)',
          color: '#fff',
          fontSize: 10,
          padding: '2px 8px',
          borderRadius: 'var(--radius-full)',
          fontWeight: 600,
        }}>
          CHAIN
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-fg-muted)' }}>
          {stepCount} steps
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={onSave} style={btnStyle}>
          Save
        </button>
        {isRunning ? (
          <button onClick={onStop} style={{ ...btnStyle, background: 'var(--color-step-failed)' }}>
            Stop
          </button>
        ) : (
          <button
            onClick={onRun}
            disabled={stepCount === 0}
            style={{
              ...btnStyle,
              opacity: stepCount === 0 ? 0.5 : 1,
              cursor: stepCount === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            Run Chain
          </button>
        )}
      </div>
      {isRunning && progress && (
        <div style={{ marginTop: 'var(--space-2)' }}>
          <div style={{ fontSize: 12, color: 'var(--color-fg-muted)', marginBottom: 4 }}>
            Step {progress.stepIndex} of {progress.totalSteps} · {progress.status}
          </div>
          <div style={{
            height: 3,
            background: 'var(--color-border)',
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              background: 'var(--color-progress-bar)',
              transition: 'width 0.3s ease',
              width: `${progressPercent}%`,
            }} />
          </div>
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: 'var(--color-accent)',
  color: '#fff',
  fontSize: 12,
  padding: '4px 12px',
  borderRadius: 'var(--radius-1)',
  border: 'none',
  cursor: 'pointer',
};
