import React from 'react';

interface ChainSidebarItemProps {
  chain: { id: string; name: string; steps: any[] };
  collectionId: string;
  isActive: boolean;
  onClick: () => void;
}

export function ChainSidebarItem({ chain, isActive, onClick }: ChainSidebarItemProps) {
  const stepCount = chain.steps?.length ?? 0;

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: 'var(--space-1) var(--space-2)',
        cursor: 'pointer',
        fontSize: 12,
        borderRadius: 'var(--radius-1)',
        marginBottom: 2,
        paddingLeft: 'var(--space-5)',
        fontWeight: isActive ? 600 : 400,
        color: isActive ? 'var(--color-fg)' : 'var(--color-fg-muted)',
        background: isActive ? 'var(--color-bg-hover)' : 'transparent',
      }}
    >
      <span style={{ marginRight: 'var(--space-1)', fontSize: 12 }}>🔗</span>
      <span style={{
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {chain.name}
      </span>
      <span style={{
        background: 'var(--color-chain-badge)',
        color: '#fff',
        fontSize: 9,
        padding: '1px 6px',
        borderRadius: 'var(--radius-full)',
        fontWeight: 600,
        marginLeft: 'var(--space-1)',
      }}>
        {stepCount}
      </span>
    </div>
  );
}
