import type { ReactNode, CSSProperties } from 'react';

export interface PillItem<T extends string = string> {
  id: T;
  label: ReactNode;
  disabled?: boolean;
}

interface PillBarProps<T extends string> {
  items: PillItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  style?: CSSProperties;
}

export function PillBar<T extends string>({ items, activeId, onChange, style }: PillBarProps<T>) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: 'var(--ds-space-1)',
        padding: 'var(--ds-space-1)',
        background: 'var(--ds-surface)',
        borderRadius: 'var(--ds-radius-1)',
        ...style,
      }}
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            onClick={() => !item.disabled && onChange(item.id)}
            style={{
              padding: 'var(--ds-space-1) var(--ds-space-3)',
              background: active ? 'var(--ds-bg)' : 'transparent',
              color: active ? 'var(--ds-text)' : 'var(--ds-text-muted)',
              border: '1px solid',
              borderColor: active ? 'var(--ds-primary)' : 'transparent',
              borderRadius: 'var(--ds-radius-1)',
              cursor: item.disabled ? 'not-allowed' : 'pointer',
              fontSize: 'var(--ds-text-xs)',
              fontWeight: active ? 600 : 500,
              fontFamily: 'var(--ds-font-sans)',
              lineHeight: 1.2,
              opacity: item.disabled ? 0.5 : 1,
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
