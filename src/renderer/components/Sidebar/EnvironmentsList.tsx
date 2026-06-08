import { useState } from 'react';
import { useEnvironmentsList, useCreateEnv, useSetActiveEnv, useDeleteEnv } from '../../hooks/useEnvironments';
import { useEnvironmentsStore } from '../../store/environments';
import { headerStyle, plusBtnStyle, treeItemStyle, mutedStyle, inputStyle, smallBtnStyle } from './CollectionsTree';

export function EnvironmentsList() {
  const { data: envs, isLoading } = useEnvironmentsList();
  const createEnv = useCreateEnv();
  const setActiveEnv = useSetActiveEnv();
  const deleteEnv = useDeleteEnv();
  const activeEnvId = useEnvironmentsStore((s) => s.activeEnvId);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const handleCreate = () => {
    if (newName.trim()) {
      createEnv.mutate({ name: newName.trim(), values: [] });
      setNewName('');
      setShowNewModal(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) return <div style={mutedStyle}>Loading environments...</div>;

  const list = envs ?? [];

  return (
    <div>
      <div style={headerStyle}>
        <span>Environments</span>
        <button onClick={() => setShowNewModal(true)} style={plusBtnStyle} title="New environment">+</button>
      </div>

      {showNewModal && (
        <div style={{ padding: 'var(--ds-space-2)' }}>
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNewModal(false); }}
            placeholder="Environment name"
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: 'var(--ds-space-1)', marginTop: 'var(--ds-space-1)' }}>
            <button onClick={handleCreate} style={smallBtnStyle}>Create</button>
            <button onClick={() => setShowNewModal(false)} style={{ ...smallBtnStyle, background: 'transparent', color: 'var(--ds-text-muted)' }}>Cancel</button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div style={mutedStyle}>No environments yet</div>
      ) : (
        list.map((env: any) => {
          const isExpanded = expanded.has(env.id);
          const isActive = env.active || activeEnvId === env.id;
          const valueCount = (env.values ?? []).length;
          return (
            <div key={env.id}>
              <div
                onClick={() => {
                  setActiveEnv.mutate(isActive ? null : env.id);
                  toggleExpand(env.id);
                }}
                style={{
                  ...treeItemStyle,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--ds-text)' : 'var(--ds-text-muted)',
                  background: isActive ? 'var(--ds-surface)' : 'transparent',
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    color: 'var(--ds-text-muted)',
                    transition: 'transform 120ms ease',
                    display: 'inline-block',
                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  }}
                >▶</span>
                <span style={{ marginRight: 'var(--ds-space-1)' }}>🌐</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{env.name}</span>
                {isActive && (
                  <span style={{
                    color: 'var(--ds-method-get)',
                    fontSize: 12,
                    lineHeight: 1,
                  }}>●</span>
                )}
                <span style={{
                  fontSize: 10,
                  color: 'var(--ds-text-muted)',
                  background: 'var(--ds-surface)',
                  padding: '0 6px',
                  borderRadius: 'var(--ds-radius-1)',
                  minWidth: 18,
                  textAlign: 'center',
                }}>{valueCount}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete environment "${env.name}"?`)) {
                      deleteEnv.mutate({ id: env.id });
                    }
                  }}
                  style={{
                    background: 'transparent',
                    color: 'var(--ds-text-muted)',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    padding: '0 4px',
                    opacity: 0.5,
                  }}
                  title="Delete environment"
                  aria-label="Delete environment"
                >✕</button>
              </div>
              {isExpanded && valueCount > 0 && (
                <div style={{
                  paddingLeft: 'var(--ds-space-5)',
                  fontSize: 'var(--ds-text-xs)',
                  color: 'var(--ds-text-muted)',
                  fontFamily: 'var(--ds-font-mono)',
                  marginBottom: 4,
                }}>
                  {env.values.slice(0, 5).map((v: any, i: number) => (
                    <div key={i} style={{ padding: '2px 0' }}>
                      {v.key || <em>(empty)</em>} = {v.secret ? '••••' : v.value}
                    </div>
                  ))}
                  {valueCount > 5 && (
                    <div style={{ color: 'var(--ds-text-muted)', fontStyle: 'italic' }}>
                      +{valueCount - 5} more
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
