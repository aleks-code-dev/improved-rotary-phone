import type { ReactNode, CSSProperties, ButtonHTMLAttributes } from 'react';

interface SendButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  children?: ReactNode;
  loading?: boolean;
  style?: CSSProperties;
}

export function SendButton({ children = 'Send', loading, disabled, style, ...rest }: SendButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      {...rest}
      disabled={isDisabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--ds-space-2)',
        padding: 'var(--ds-space-2) var(--ds-space-4)',
        background: isDisabled ? 'var(--ds-text-dim)' : 'var(--ds-accent)',
        color: '#fff',
        border: 'none',
        borderRadius: 'var(--ds-radius-1)',
        fontWeight: 600,
        fontSize: 'var(--ds-text-sm)',
        fontFamily: 'var(--ds-font-sans)',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.6 : 1,
        transition: 'background 80ms ease',
        ...style,
      }}
    >
      {loading && (
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 12,
            height: 12,
            border: '2px solid rgba(255,255,255,0.4)',
            borderTopColor: '#fff',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      )}
      {children}
    </button>
  );
}
