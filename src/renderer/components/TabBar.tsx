import { useState } from 'react';
import { useTabs } from '../state/useTabs';

export function TabBar() {
  const openTabs = useTabs((s) => s.openTabs);
  const activeTabId = useTabs((s) => s.activeTabId);
  const setActiveTab = useTabs((s) => s.setActiveTab);
  const closeTab = useTabs((s) => s.closeTab);
  const reorderTabs = useTabs((s) => s.reorderTabs);

  const [dragOverId, setDragOverId] = useState<string | null>(null);

  if (openTabs.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      borderBottom: '1px solid var(--color-border)',
      background: 'var(--color-bg-tertiary)',
      overflow: 'auto',
      flexShrink: 0,
    }}>
      {openTabs.map((tab) => (
        <div
          key={tab.id}
          draggable
          className={`tab ${dragOverId === tab.id ? 'drag-over' : ''}`}
          onDragStart={(e) => {
            e.dataTransfer.setData('text/tab-id', tab.id);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDragOverId(tab.id);
          }}
          onDragLeave={() => {
            setDragOverId(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverId(null);
            const sourceId = e.dataTransfer.getData('text/tab-id');
            if (sourceId && sourceId !== tab.id) {
              const targetIndex = openTabs.findIndex((t) => t.id === tab.id);
              reorderTabs(sourceId, targetIndex);
            }
          }}
          onClick={() => setActiveTab(tab.id)}
          title={`${tab.method} ${tab.url || 'Untitled'}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            padding: 'var(--space-1) var(--space-3)',
            borderRight: '1px solid var(--color-border)',
            cursor: 'pointer',
            fontSize: 12,
            whiteSpace: 'nowrap',
            maxWidth: 200,
            overflow: 'hidden',
            background: tab.id === activeTabId
              ? 'var(--color-bg-elevated)'
              : (dragOverId === tab.id
                ? 'var(--color-bg-hover)'
                : 'transparent'),
            borderLeft: dragOverId === tab.id
              ? '2px solid var(--color-accent)'
              : '2px solid transparent',
            borderBottom: tab.id === activeTabId
              ? 'None'
              : '1px solid var(--color-border)',
            color: tab.id === activeTabId
              ? 'var(--color-fg)'
              : 'var(--color-fg-muted)',
          }}
        >
          <span style={{
            fontWeight: 600,
            color: `var(--color-method-${tab.method.toLowerCase()})`,
            fontSize: 10,
          }}>
            {tab.method}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {tab.url || 'Untitled'}
          </span>
          {tab.isDirty && (
            <span style={{ color: 'var(--color-warning)', fontSize: 14 }}>●</span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (tab.isDirty && !window.confirm('You have unsaved changes. Close anyway?')) {
                return;
              }
              closeTab(tab.id);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-fg-muted)',
              cursor: 'pointer',
              fontSize: 14,
              padding: '0 2px',
              marginLeft: 'auto',
              lineHeight: 1,
            }}
            title="Close tab"
          >
            ×
          </button>
        </div>
      ))}
      <div
        onClick={() => useTabs.getState().addTab()}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-1) var(--space-3)',
          cursor: 'pointer',
          color: 'var(--color-fg-muted)',
          fontSize: 16,
          borderRight: '1px solid var(--color-border)',
        }}
        title="New tab (Ctrl+T)"
      >
        +
      </div>
    </div>
  );
}
