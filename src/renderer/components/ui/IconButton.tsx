import type { ReactNode, CSSProperties, ButtonHTMLAttributes } from 'react';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  children: ReactNode;
  variant?: 'ghost' | 'outline' | 'solid';
  danger?: boolean;
  title?: string;
  style?: CSSProperties;
}

export function IconButton({
  children,
  variant = 'ghost',
  danger,
  disabled,
  title,
  style,
  ...rest
}: IconButtonProps) {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--ds-space-1) var(--ds-space-2)',
    border: 'none',
    borderRadius: 'var(--ds-radius-1)',
    fontFamily: 'var(--ds-font-sans)',
    fontSize: 'var(--ds-text-xs)',
    lineHeight: 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    transition: 'background 80ms ease',
  };

  const variantStyle: CSSProperties = (() => {
    if (danger) {
      return {
        background: 'transparent',
        color: 'var(--ds-danger)',
      };
    }
    if (variant === 'solid') {
      return {
        background: 'var(--ds-surface-raised)',
        color: 'var(--ds-text)',
      };
    }
    if (variant === 'outline') {
      return {
        background: 'transparent',
        color: 'var(--ds-text-muted)',
        border: '1px solid var(--ds-border)',
      };
    }
    return {
      background: 'transparent',
      color: 'var(--ds-text-muted)',
    };
  })();

  return (
    <button {...rest} disabled={disabled} title={title} style={{ ...base, ...variantStyle, ...style }}>
      {children}
    </button>
  );
}
