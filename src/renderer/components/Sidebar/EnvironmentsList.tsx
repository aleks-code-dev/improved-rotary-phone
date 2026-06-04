import { useState } from 'react';
import { useEnvironmentsList, useCreateEnv, useSetActiveEnv } from '../../hooks/useEnvironments';
import { useEnvironmentsStore } from '../../store/environments';
import { headerStyle, plusBtnStyle, treeItemStyle, mutedStyle, inputStyle, smallBtnStyle } from './CollectionsTree';

export function EnvironmentsList() {
  const { data: envs, isLoading } = useEnvironmentsList();
  const createEnv = useCreateEnv();
  const setActiveEnv = useSetActiveEnv();
  const activeEnvId = useEnvironmentsStore((s) => s.activeEnvId);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = () => {
    if (newName.trim()) {
      createEnv.mutate({ name: newName.trim(), values: [] });
      setNewName('');
      setShowNewModal(false);
    }
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
        <div style={{ padding: 'var(--space-2)' }}>
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNewModal(false); }}
            placeholder="Environment name"
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: 'var(--space-1)', marginTop: 'var(--space-1)' }}>
            <button onClick={handleCreate} style={smallBtnStyle}>Create</button>
            <button onClick={() => setShowNewModal(false)} style={{ ...smallBtnStyle, background: 'transparent', color: 'var(--color-fg-muted)' }}>Cancel</button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div style={mutedStyle}>No environments yet</div>
      ) : (
        list.map((env: any) => (
          <div
            key={env.id}
            onClick={() => setActiveEnv.mutate(env.id === activeEnvId ? null : env.id)}
            style={{
              ...treeItemStyle,
              fontWeight: env.active ? 600 : 400,
              color: env.active ? 'var(--color-fg)' : 'var(--color-fg-muted)',
              background: env.active ? 'var(--color-bg-hover)' : 'transparent',
            }}
          >
            {env.active && <span style={{ color: 'var(--color-method-get)', marginRight: 4, fontSize: 18, lineHeight: '10px' }}>●</span>}
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{env.name}</span>
          </div>
        ))
      )}
    </div>
  );
}
