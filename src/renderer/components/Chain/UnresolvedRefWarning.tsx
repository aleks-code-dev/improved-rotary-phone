import React from 'react';

interface UnresolvedRefWarningProps {
  unresolvedRefs: string[];
}

export function UnresolvedRefWarning({ unresolvedRefs }: UnresolvedRefWarningProps) {
  if (!unresolvedRefs || unresolvedRefs.length === 0) return null;

  return (
    <div style={{
      background: 'rgba(251,191,36,0.1)',
      borderLeft: '3px solid var(--color-warning)',
      padding: 'var(--space-2) var(--space-3)',
      fontSize: 12,
      marginTop: 'var(--space-2)',
      borderRadius: '0 var(--radius-1) var(--radius-1) 0',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        ⚠ {unresolvedRefs.length} unresolved reference{unresolvedRefs.length !== 1 ? 's' : ''}:
      </div>
      {unresolvedRefs.map((ref, i) => (
        <div key={i} style={{ marginLeft: 'var(--space-2)', marginBottom: 2 }}>
          • <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{ref}</code> — step has not run or path does not exist
        </div>
      ))}
      <div style={{ fontSize: 10, color: 'var(--color-fg-muted)', marginTop: 'var(--space-1)' }}>
        Empty strings were substituted. The chain continued.
      </div>
    </div>
  );
}
