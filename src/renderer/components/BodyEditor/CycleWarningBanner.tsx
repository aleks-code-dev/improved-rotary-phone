interface CycleWarningBannerProps {
  cycleRefs: string[];
  onDismiss: () => void;
}

export function CycleWarningBanner({ cycleRefs, onDismiss }: CycleWarningBannerProps) {
  if (cycleRefs.length === 0) return null;

  return (
    <div style={{
      background: 'rgba(251, 191, 36, 0.1)',
      borderLeft: '3px solid var(--color-warning)',
      padding: 'var(--space-2) var(--space-3)',
      fontSize: 12,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 'var(--space-2)',
    }}>
      <span style={{ color: 'var(--color-fg)' }}>
        This body contains circular references. $ref markers indicate repeated types: {cycleRefs.join(', ')}
      </span>
      <button
        onClick={onDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--color-fg-muted)',
          cursor: 'pointer',
          fontSize: 14,
          padding: '2px 6px',
        }}
      >
        ✕
      </button>
    </div>
  );
}
