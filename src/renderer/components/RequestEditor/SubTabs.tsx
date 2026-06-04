const SUB_TABS = ['Params', 'Headers', 'Body', 'Auth', 'Settings'] as const;
export type SubTab = (typeof SUB_TABS)[number];

interface SubTabsProps {
  active: SubTab;
  onChange: (tab: SubTab) => void;
}

export function SubTabs({ active, onChange }: SubTabsProps) {
  return (
    <nav style={{ display: 'flex', gap: 'var(--space-2)', fontSize: 12, borderBottom: '1px solid var(--color-border)' }}>
      {SUB_TABS.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          style={{
            padding: 'var(--space-1) var(--space-3)',
            background: 'transparent',
            color: active === tab ? 'var(--color-fg)' : 'var(--color-fg-muted)',
            border: 'none',
            borderBottom: active === tab ? '2px solid var(--color-accent)' : '2px solid transparent',
            cursor: 'pointer',
            fontWeight: active === tab ? 600 : 400,
            fontSize: 12,
          }}
        >
          {tab}
        </button>
      ))}
    </nav>
  );
}
