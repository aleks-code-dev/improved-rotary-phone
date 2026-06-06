import React from 'react';

interface ChainValidationBannerProps {
  issues: Array<{ type: string; message: string; stepIndex?: number }>;
  onDismiss: () => void;
}

export function ChainValidationBanner({ issues, onDismiss }: ChainValidationBannerProps) {
  if (!issues || issues.length === 0) return null;

  return (
    <div style={{
      background: 'rgba(251,191,36,0.1)',
      borderLeft: '3px solid var(--color-warning)',
      padding: 'var(--space-2) var(--space-3)',
      fontSize: 12,
      marginBottom: 'var(--space-2)',
      borderRadius: '0 var(--radius-1) var(--radius-1) 0',
      position: 'relative',
    }}>
      <button
        onClick={onDismiss}
        style={{
          position: 'absolute',
          top: 'var(--space-2)',
          right: 'var(--space-2)',
          background: 'transparent',
          border: 'none',
          color: 'var(--color-fg-muted)',
          cursor: 'pointer',
          fontSize: 14,
          padding: '0 4px',
        }}
      >
        ✕
      </button>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        ⚠ Chain validation failed — fix before running:
      </div>
      {issues.map((issue, i) => (
        <div key={i} style={{ marginLeft: 'var(--space-2)', marginBottom: 2 }}>
          • {issue.message}
        </div>
      ))}
    </div>
  );
}
