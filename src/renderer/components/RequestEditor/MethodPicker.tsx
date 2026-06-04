import type { HttpMethod } from '../../state/useRequest';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

interface MethodPickerProps {
  value: HttpMethod;
  onChange: (method: HttpMethod) => void;
}

export function MethodPicker({ value, onChange }: MethodPickerProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as HttpMethod)}
      style={{
        background: `var(--color-method-${value.toLowerCase()})`,
        color: 'white',
        border: 'none',
        borderRadius: 'var(--radius-1)',
        padding: 'var(--space-2) var(--space-3)',
        fontWeight: 600,
        cursor: 'pointer',
        fontSize: 13,
        minWidth: 100,
      }}
    >
      {METHODS.map((m) => (
        <option key={m} value={m} style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-fg)' }}>
          {m}
        </option>
      ))}
    </select>
  );
}
