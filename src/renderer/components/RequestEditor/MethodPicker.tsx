import type { HttpMethod } from '../../state/useRequest';
import { MethodBadge } from '../ui/MethodBadge';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

interface MethodPickerProps {
  value: HttpMethod;
  onChange: (method: HttpMethod) => void;
}

export function MethodPicker({ value, onChange }: MethodPickerProps) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      <MethodBadge method={value} size="md" style={{ minWidth: 72 }} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as HttpMethod)}
        aria-label="HTTP method"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {METHODS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
