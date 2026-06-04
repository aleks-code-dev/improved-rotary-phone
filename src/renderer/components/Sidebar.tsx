import { useState, useEffect } from 'react';
import { CollectionsTree } from './Sidebar/CollectionsTree';
import { EnvironmentsList } from './Sidebar/EnvironmentsList';
import { HistoryList } from './Sidebar/HistoryList';
import { VariablesTab } from './Sidebar/VariablesTab';

type SidebarGroup = 'collections' | 'environments' | 'history' | 'variables';

export function Sidebar() {
  const [status, setStatus] = useState<any>({ state: 'starting' });
  const [visibleGroups, setVisibleGroups] = useState<Set<SidebarGroup>>(
    new Set(['collections', 'environments', 'history', 'variables'])
  );

  useEffect(() => {
    window.api.helper.getStatus().then(setStatus);
    const unsub = window.api.helper.onStatus(setStatus);
    return unsub;
  }, []);

  const toggleGroup = (group: SidebarGroup) => {
    setVisibleGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  return (
    <div style={{ width: 240, borderRight: '1px solid var(--color-border)', padding: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', overflow: 'auto' }}>
      {/* Sidebar toolbar */}
      <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
        {(['collections', 'environments', 'history', 'variables'] as SidebarGroup[]).map((g) => (
          <button
            key={g}
            onClick={() => toggleGroup(g)}
            style={{
              padding: '2px 6px',
              fontSize: 10,
              textTransform: 'capitalize',
              background: visibleGroups.has(g) ? 'var(--color-bg-elevated)' : 'transparent',
              color: visibleGroups.has(g) ? 'var(--color-fg)' : 'var(--color-fg-muted)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-1)',
              cursor: 'pointer',
            }}
          >
            {g}
          </button>
        ))}
      </div>

      {visibleGroups.has('collections') && <CollectionsTree />}
      {visibleGroups.has('environments') && <EnvironmentsList />}
      {visibleGroups.has('history') && <HistoryList />}
      {visibleGroups.has('variables') && <VariablesTab />}
    </div>
  );
}
