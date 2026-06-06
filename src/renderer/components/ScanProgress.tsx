import React from 'react';

interface ScanProgressProps {
  projectPath: string;
  endpointCount: number;
}

export function ScanProgress({ projectPath, endpointCount }: ScanProgressProps) {
  const truncatedPath = projectPath.length > 40
    ? '...' + projectPath.slice(-37)
    : projectPath;

  return (
    <div style={{ padding: 'var(--space-2)' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        marginBottom: 'var(--space-2)',
      }}>
        <span style={{ color: 'var(--color-status-3xx)', fontSize: 10 }}>○</span>
        <span style={{
          fontSize: 11,
          color: 'var(--color-fg-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          Scanning {truncatedPath}...
        </span>
      </div>

      {/* Indeterminate progress bar */}
      <div style={{
        height: 4,
        background: 'var(--color-border)',
        borderRadius: 'var(--radius-1)',
        overflow: 'hidden',
        marginBottom: 'var(--space-1)',
      }}>
        <div style={{
          height: '100%',
          background: 'var(--color-accent)',
          borderRadius: 'var(--radius-1)',
          width: '30%',
          animation: 'shimmer 1.5s infinite ease-in-out',
        }} />
      </div>

      <div style={{
        fontSize: 11,
        color: 'var(--color-fg-muted)',
      }}>
        Found {endpointCount} endpoint{endpointCount !== 1 ? 's' : ''} so far...
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
