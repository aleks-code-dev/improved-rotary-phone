import type { ReactNode, CSSProperties } from 'react';

export interface VerticalTabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
  disabled?: boolean;
}

interface VerticalTabStripProps {
  items: VerticalTabItem[];
  activeId: string;
  onChange: (id: string) => void;
  minWidth?: number;
  style?: CSSProperties;
}

export function VerticalTabStrip({ items, activeId, onChange, minWidth = 130, style }: VerticalTabStripProps) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minWidth,
        background: 'var(--ds-surface)',
        borderRight: '1px solid var(--ds-border)',
        padding: 'var(--ds-space-1) 0',
        ...style,
      }}
    >
      {items.map((item) => {
        const active = item.id === activeId;
        const disabled = item.disabled;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => !disabled && onChange(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--ds-space-2)',
              padding: 'var(--ds-space-2) var(--ds-space-3)',
              background: active ? 'var(--ds-surface-raised)' : 'transparent',
              color: disabled ? 'var(--ds-text-dim)' : active ? 'var(--ds-text)' : 'var(--ds-text-muted)',
              border: 'none',
              borderLeft: active ? '2px solid var(--ds-accent)' : '2px solid transparent',
              borderRadius: 0,
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontSize: 'var(--ds-text-xs)',
              fontWeight: active ? 600 : 500,
              textAlign: 'left',
              fontFamily: 'var(--ds-font-sans)',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {item.icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{item.icon}</span>}
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.count != null && item.count > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 18,
                  height: 16,
                  padding: '0 5px',
                  background: active ? 'var(--ds-primary)' : 'var(--ds-surface-raised)',
                  color: '#fff',
                  borderRadius: 'var(--ds-radius-full)',
                  fontSize: 'var(--ds-text-2xs)',
                  fontWeight: 600,
                  lineHeight: 1,
                }}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
