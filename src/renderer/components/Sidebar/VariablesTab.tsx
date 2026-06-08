import { useState, useMemo } from 'react';
import { useEnvironmentsList, useEnvironment, useUpdateEnv } from '../../hooks/useEnvironments';
import { useEnvironmentsStore } from '../../store/environments';
import { headerStyle, mutedStyle } from './CollectionsTree';

const SCOPE_COLORS: Record<string, { bg: string; fg: string }> = {
  Env: { bg: 'rgba(76, 154, 255, 0.15)', fg: 'var(--ds-method-put)' },
  Collection: { bg: 'rgba(240, 140, 0, 0.15)', fg: 'var(--ds-method-post)' },
  Global: { bg: 'rgba(47, 158, 68, 0.15)', fg: 'var(--ds-method-get)' },
};

const SCOPES = ['Env', 'Collection', 'Global'] as const;
type Scope = typeof SCOPES[number];

interface VariableRow {
  key: string;
  value: string;
  enabled: boolean;
  secret: boolean;
  scope: Scope;
  envId?: string;
  collectionId?: string;
}

export function VariablesTab() {
  const { data: envs } = useEnvironmentsList();
  const updateEnv = useUpdateEnv();
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  // Collect all variables across envs (env scope)
  const envVars: VariableRow[] = useMemo(() => {
    if (!envs) return [];
    const result: VariableRow[] = [];
    for (const env of envs) {
      const values = (env as any).values ?? [];
      for (const v of values) {
        result.push({
          key: v.key ?? '',
          value: v.value ?? '',
          enabled: v.enabled !== false,
          secret: v.secret === true,
          scope: 'Env',
          envId: env.id,
        });
      }
    }
    return result;
  }, [envs]);

  // Placeholder for collection + global (future: hook to store)
  const collectionVars: VariableRow[] = [];
  const globalVars: VariableRow[] = [];

  const allRows: VariableRow[] = [...envVars, ...collectionVars, ...globalVars];

  const handleAdd = (scope: Scope) => {
    if (scope === 'Env' && envs && envs.length > 0) {
      const firstEnv = envs[0];
      const currentValues = (firstEnv as any).values ?? [];
      updateEnv.mutate({
        id: firstEnv.id,
        env: { ...firstEnv, values: [...currentValues, { key: '', value: '', enabled: true, secret: false }] },
      });
    }
  };

  const handleUpdate = (row: VariableRow, field: Partial<VariableRow>) => {
    if (row.envId && envs) {
      const env = envs.find((e: any) => e.id === row.envId);
      if (!env) return;
      const values = ((env as any).values ?? []).map((v: any, i: number) => {
        if (row.envId === env.id && i === envVars.findIndex((r) => r.envId === env.id && r.key === v.key && r.value === v.value)) {
          return { ...v, ...field };
        }
        return v;
      });
      updateEnv.mutate({ id: env.id, env: { ...env, values } });
    }
  };

  const handleDelete = (row: VariableRow) => {
    if (row.envId && envs) {
      const env = envs.find((e: any) => e.id === row.envId);
      if (!env) return;
      const values = ((env as any).values ?? []).filter((v: any) =>
        !(v.key === row.key && v.value === row.value)
      );
      updateEnv.mutate({ id: env.id, env: { ...env, values } });
    }
  };

  return (
    <div>
      <div style={headerStyle}>
        <span>Variables</span>
        <button
          onClick={() => handleAdd('Env')}
          style={{
            background: 'transparent',
            border: '1px solid var(--ds-border)',
            borderRadius: 'var(--ds-radius-1)',
            color: 'var(--ds-text-muted)',
            cursor: 'pointer',
            fontSize: 14,
            padding: '0 6px',
            lineHeight: '18px',
          }}
          title="Add variable"
          aria-label="Add variable"
        >+</button>
      </div>

      {/* Environment switcher (004-A header) */}
      {envs && envs.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 'var(--ds-space-1)',
          marginBottom: 'var(--ds-space-2)',
          flexWrap: 'wrap',
        }}>
          {envs.map((env: any) => (
            <EnvironmentChip key={env.id} env={env} />
          ))}
        </div>
      )}

      {/* Dense table grid (004-A) */}
      <div style={{
        border: '1px solid var(--ds-border)',
        borderRadius: 'var(--ds-radius-1)',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--ds-text-sm)' }}>
          <thead>
            <tr style={{ background: 'var(--ds-surface)' }}>
              <th style={{ ...thStyle, width: '30%' }}>Name</th>
              <th style={{ ...thStyle, width: '40%' }}>Value</th>
              <th style={{ ...thStyle, width: '20%' }}>Scope</th>
              <th style={{ ...thStyle, width: 30 }}></th>
            </tr>
          </thead>
          <tbody>
            {allRows.length === 0 ? (
              <tr>
                <td style={{ ...tdStyle, color: 'var(--ds-text-muted)', fontStyle: 'italic' }} colSpan={4}>
                  No variables defined
                </td>
              </tr>
            ) : (
              allRows.map((row, i) => (
                <tr key={`${row.scope}-${i}-${row.key}`} style={rowStyle}>
                  <td style={tdStyle}>
                    <input
                      value={row.key}
                      onChange={(e) => handleUpdate(row, { key: e.target.value })}
                      onFocus={() => setEditingRowId(`${row.scope}-${i}-${row.key}`)}
                      onBlur={() => setEditingRowId(null)}
                      placeholder="variable_name"
                      style={cellInputStyle}
                    />
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-1)' }}>
                      <input
                        value={row.value}
                        onChange={(e) => handleUpdate(row, { value: e.target.value })}
                        onFocus={() => setEditingRowId(`${row.scope}-${i}-${row.key}`)}
                        onBlur={() => setEditingRowId(null)}
                        placeholder="value"
                        type={row.secret ? 'password' : 'text'}
                        style={{
                          ...cellInputStyle,
                          WebkitTextSecurity: row.secret ? 'disc' : 'none',
                        }}
                      />
                      <input
                        type="checkbox"
                        checked={row.secret}
                        onChange={(e) => handleUpdate(row, { secret: e.target.checked })}
                        title="Secret"
                        aria-label="Secret"
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      ...scopeBadgeStyle,
                      background: SCOPE_COLORS[row.scope]?.bg ?? 'var(--ds-surface)',
                      color: SCOPE_COLORS[row.scope]?.fg ?? 'var(--ds-text-muted)',
                    }}>
                      {row.scope}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => handleDelete(row)}
                      style={removeBtnStyle}
                      title="Delete variable"
                      aria-label="Delete variable"
                    >✕</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Bulk export toolbar (004-A) */}
      {allRows.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 'var(--ds-space-1)',
          marginTop: 'var(--ds-space-2)',
        }}>
          <button
            onClick={() => {
              const json = JSON.stringify(
                Object.fromEntries(allRows.filter((r) => r.key).map((r) => [r.key, r.value])),
                null,
                2
              );
              navigator.clipboard.writeText(json);
            }}
            style={bulkBtnStyle}
            title="Copy all as JSON"
          >
            Copy JSON
          </button>
          <button
            onClick={() => {
              const text = allRows.filter((r) => r.key).map((r) => `${r.key}=${r.value}`).join('\n');
              navigator.clipboard.writeText(text);
            }}
            style={bulkBtnStyle}
            title="Copy as .env format"
          >
            Copy .env
          </button>
        </div>
      )}
    </div>
  );
}

function EnvironmentChip({ env }: { env: any }) {
  const setActiveEnv = useEnvironmentsStore((s) => s.setActiveEnv);
  const activeEnvId = useEnvironmentsStore((s) => s.activeEnvId);
  const isActive = env.active || activeEnvId === env.id;

  return (
    <button
      onClick={() => setActiveEnv(isActive ? null : env.id)}
      style={{
        padding: '2px 8px',
        fontSize: 'var(--ds-text-xs)',
        background: isActive ? 'var(--ds-primary)' : 'var(--ds-surface)',
        color: isActive ? 'white' : 'var(--ds-text-muted)',
        border: '1px solid var(--ds-border)',
        borderRadius: 'var(--ds-radius-1)',
        cursor: 'pointer',
        fontWeight: isActive ? 600 : 400,
      }}
    >
      {env.name}
    </button>
  );
}

const thStyle: React.CSSProperties = {
  padding: '3px 6px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: 10,
  color: 'var(--ds-text-muted)',
  borderBottom: '1px solid var(--ds-border)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const tdStyle: React.CSSProperties = {
  padding: '3px 6px',
  borderBottom: '1px solid var(--ds-border)',
};

const rowStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--ds-border)',
};

const cellInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '2px 4px',
  border: '1px solid transparent',
  background: 'transparent',
  color: 'var(--ds-text)',
  fontSize: 'var(--ds-text-sm)',
  fontFamily: 'var(--ds-font-mono)',
  outline: 'none',
  borderRadius: 'var(--ds-radius-1)',
};

const removeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--ds-text-muted)',
  border: 'none',
  cursor: 'pointer',
  fontSize: 12,
  padding: '0 4px',
  opacity: 0.5,
  transition: 'opacity 120ms ease',
};

const scopeBadgeStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  padding: '1px 6px',
  borderRadius: 'var(--ds-radius-1)',
  display: 'inline-block',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const bulkBtnStyle: React.CSSProperties = {
  padding: '2px 8px',
  fontSize: 'var(--ds-text-xs)',
  background: 'transparent',
  color: 'var(--ds-text-muted)',
  border: '1px solid var(--ds-border)',
  borderRadius: 'var(--ds-radius-1)',
  cursor: 'pointer',
};
