import { useState, useEffect } from 'react';
import { CollectionsTree } from './Sidebar/CollectionsTree';
import { EndpointsTree } from './Sidebar/EndpointsTree';
import { EnvironmentsList } from './Sidebar/EnvironmentsList';
import { HistoryList } from './Sidebar/HistoryList';
import { VariablesTab } from './Sidebar/VariablesTab';
import { DtoClassPanel } from './DtoClassPanel';
import { IconButton } from './ui/IconButton';

type SidebarGroup = 'endpoints' | 'collections' | 'environments' | 'history' | 'variables';

const GROUP_LABELS: Record<SidebarGroup, string> = {
  endpoints: 'Endpoints',
  collections: 'Collections',
  environments: 'Environments',
  history: 'History',
  variables: 'Variables',
};

export function Sidebar() {
  const [status, setStatus] = useState<any>({ state: 'starting' });
  const [visibleGroups, setVisibleGroups] = useState<Set<SidebarGroup>>(
    new Set(['endpoints', 'collections', 'environments', 'history', 'variables'])
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
    <div style={{ width: 240, borderRight: '1px solid var(--ds-border)', padding: 'var(--ds-space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-3)', overflow: 'auto' }}>
      {/* Sidebar toolbar */}
      <div style={{ display: 'flex', gap: 'var(--ds-space-1)', flexWrap: 'wrap' }}>
        {(['endpoints', 'collections', 'environments', 'history', 'variables'] as SidebarGroup[]).map((g) => (
          <IconButton
            key={g}
            variant={visibleGroups.has(g) ? 'solid' : 'ghost'}
            onClick={() => toggleGroup(g)}
            size="sm"
            style={{ textTransform: 'capitalize', fontSize: 'var(--ds-text-xs)' }}
          >
            {GROUP_LABELS[g]}
          </IconButton>
        ))}
      </div>

      {visibleGroups.has('endpoints') && <EndpointsTree />}
      {visibleGroups.has('endpoints') && <DtoClassPanel />}
      {visibleGroups.has('collections') && <CollectionsTree />}
      {visibleGroups.has('environments') && <EnvironmentsList />}
      {visibleGroups.has('history') && <HistoryList />}
      {visibleGroups.has('variables') && <VariablesTab />}
    </div>
  );
}
