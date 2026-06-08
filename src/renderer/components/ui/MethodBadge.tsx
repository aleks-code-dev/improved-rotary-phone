import type { CSSProperties } from 'react';
import type { HttpMethod } from '../../state/useRequest';

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'var(--ds-method-get)',
  POST: 'var(--ds-method-post)',
  PUT: 'var(--ds-method-put)',
  PATCH: 'var(--ds-method-patch)',
  DELETE: 'var(--ds-method-delete)',
  HEAD: 'var(--ds-method-head)',
  OPTIONS: 'var(--ds-method-options)',
};

export function methodColor(method: HttpMethod): string {
  return METHOD_COLORS[method];
}

interface MethodBadgeProps {
  method: HttpMethod;
  size?: 'sm' | 'md' | 'lg';
  uppercase?: boolean;
  style?: CSSProperties;
  className?: string;
}

const SIZES: Record<NonNullable<MethodBadgeProps['size']>, { pad: string; font: string; min: string }> = {
  xs: { pad: '1px 4px', font: 'var(--ds-text-2xs)', min: '32px' },
  sm: { pad: '2px 6px', font: 'var(--ds-text-2xs)', min: '40px' },
  md: { pad: 'var(--ds-space-1) var(--ds-space-3)', font: 'var(--ds-text-xs)', min: '56px' },
  lg: { pad: 'var(--ds-space-2) var(--ds-space-4)', font: 'var(--ds-text-sm)', min: '80px' },
};

export function MethodBadge({ method, size = 'md', uppercase = true, style, className }: MethodBadgeProps) {
  const s = SIZES[size] ?? SIZES.md;
  const bg = METHOD_COLORS[method] ?? METHOD_COLORS.GET;
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: s.min,
        padding: s.pad,
        background: bg,
        color: '#fff',
        fontFamily: 'var(--ds-font-sans)',
        fontWeight: 700,
        fontSize: s.font,
        textTransform: uppercase ? 'uppercase' : 'none',
        letterSpacing: uppercase ? '0.04em' : 'normal',
        borderRadius: 'var(--ds-radius-1)',
        lineHeight: 1.1,
        userSelect: 'none',
        ...style,
      }}
    >
      {method}
    </span>
  );
}
