import React from 'react';

interface StepCardProps {
  stepIndex: number;
  method: string;
  url: string;
  isSelected: boolean;
  isActive: boolean;
  result?: {
    status: number;
    timing?: { total: number };
    error?: string;
  } | null;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

const methodColors: Record<string, string> = {
  GET: 'var(--color-method-get)',
  POST: 'var(--color-method-post)',
  PUT: 'var(--color-method-put)',
  PATCH: 'var(--color-method-patch)',
  DELETE: 'var(--color-method-delete)',
  HEAD: 'var(--color-method-head)',
  OPTIONS: 'var(--color-method-options)',
};

function getStatusInfo(result: StepCardProps['result'], isActive: boolean) {
  if (isActive) return { color: 'var(--color-step-active)', text: '◆ Running…', spinning: true };
  if (!result) return { color: 'var(--color-step-pending)', text: '○ Not run', spinning: false };
  if (result.error) return { color: 'var(--color-step-failed)', text: `✗ ${result.error}`, spinning: false };
  if (result.status >= 200 && result.status < 300) {
    return {
      color: 'var(--color-step-success)',
      text: `✓ ${result.status} · ${result.timing?.total ?? 0}ms`,
      spinning: false,
    };
  }
  return {
    color: 'var(--color-step-failed)',
    text: `✗ ${result.status} · ${result.timing?.total ?? 0}ms`,
    spinning: false,
  };
}

export function StepCard({ stepIndex, method, url, isSelected, isActive, result, onClick, onContextMenu }: StepCardProps) {
  const status = getStatusInfo(result, isActive);

  let borderColor = 'var(--color-border)';
  let background = 'transparent';
  if (isSelected) {
    borderColor = 'var(--color-step-active)';
    background = 'rgba(76,154,255,0.06)';
  } else if (isActive) {
    borderColor = 'var(--color-step-active)';
  } else if (result?.error || (result && result.status >= 400)) {
    borderColor = 'var(--color-step-failed)';
  }

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{
        minWidth: 150,
        maxWidth: 180,
        flexShrink: 0,
        border: `2px solid ${borderColor}`,
        borderRadius: 'var(--radius-2)',
        background,
        padding: 'var(--space-2)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        animation: isActive ? 'pulse 1s ease-in-out infinite' : undefined,
      }}
    >
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
        <span style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: isSelected ? 'var(--color-step-active)' : 'var(--color-step-pending)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          flexShrink: 0,
        }}>
          {stepIndex}
        </span>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          color: methodColors[method] ?? 'var(--color-fg-muted)',
          background: `${methodColors[method] ?? 'var(--color-fg-muted)'}20`,
          borderRadius: 'var(--radius-1)',
          padding: '1px 6px',
        }}>
          {method}
        </span>
      </div>
      <div style={{
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        color: 'var(--color-fg-muted)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: 120,
      }}>
        {url || '(no url)'}
      </div>
      <div style={{
        fontSize: 9,
        color: status.color,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}>
        {status.spinning && (
          <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: 10 }}>↻</span>
        )}
        {status.text}
      </div>
    </div>
  );
}
