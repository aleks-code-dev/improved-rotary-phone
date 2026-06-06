import { useState, useCallback } from 'react';
import { useCollectionsList, useCreateCollection, useCollection } from '../../hooks/useCollections';
import { useTabs } from '../../state/useTabs';
import { useRequest } from '../../state/useRequest';
import { useCollectionsStore } from '../../store/collections';
import { useChain } from '../../state/useChain';
import { ChainSidebarItem } from '../Chain/ChainSidebarItem';

export function CollectionsTree() {
  const { data: collections, isLoading } = useCollectionsList();
  const createCollection = useCreateCollection();
  const addTab = useTabs((s) => s.addTab);
  const activeCollectionId = useCollectionsStore((s) => s.activeCollectionId);
  const setActiveCollection = useCollectionsStore((s) => s.setActiveCollection);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Track which collection's full data we need to fetch on expand
  const [loadId, setLoadId] = useState<string | null>(null);
  const activeChainId = useChain((s) => s.activeChainId);
  const openChain = useChain((s) => s.openChain);

  // Fetch full collection when expanding (includes item[] with requests)
  const { data: fullCollection } = useCollection(loadId);

  const toggleExpand = useCallback((colId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(colId)) {
        next.delete(colId);
      } else {
        next.add(colId);
        setLoadId(colId); // trigger fetch
      }
      return next;
    });
  }, []);

  if (isLoading) return <div style={mutedStyle}>Loading collections...</div>;

  const list = collections ?? [];

  return (
    <div>
      <div style={headerStyle}>
        <span>Collections</span>
        <button onClick={() => setShowNewModal(true)} style={plusBtnStyle} title="New collection">+</button>
      </div>

      {showNewModal && (
        <div style={{ padding: 'var(--space-2)' }}>
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNewModal(false); }}
            placeholder="Collection name"
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: 'var(--space-1)', marginTop: 'var(--space-1)' }}>
            <button onClick={handleCreate} style={smallBtnStyle}>Create</button>
            <button onClick={() => setShowNewModal(false)} style={{ ...smallBtnStyle, background: 'transparent', color: 'var(--color-fg-muted)' }}>Cancel</button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div style={mutedStyle}>No collections yet</div>
      ) : (
        list.map((col: any) => {
          const isExpanded = expanded.has(col.id);
          // Show item count from metadata immediately; refresh from full collection on expand
          const items = (fullCollection && col.id === loadId)
            ? (fullCollection.item ?? [])
            : [];
          const displayCount = (fullCollection && col.id === loadId)
            ? items.length
            : (col.itemCount ?? 0);
          return (
            <div key={col.id}>
              <div
                onClick={() => {
                  setActiveCollection(col.id);
                  toggleExpand(col.id);
                }}
                style={{
                  ...treeItemStyle,
                  fontWeight: activeCollectionId === col.id ? 600 : 400,
                  color: activeCollectionId === col.id ? 'var(--color-fg)' : 'var(--color-fg-muted)',
                  background: activeCollectionId === col.id ? 'var(--color-bg-hover)' : 'transparent',
                }}
              >
                <span style={{ marginRight: 'var(--space-1)', fontSize: 10 }}>
                  {isExpanded ? '▼' : '▶'}
                </span>
                <span style={{ marginRight: 'var(--space-1)' }}>📁</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{col.name}</span>
                <span style={{ fontSize: 10, color: 'var(--color-fg-muted)' }}>{displayCount}</span>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    await window.api.chains.create({ collectionId: col.id, name: 'New Chain' });
                    // Invalidate to refresh the collection data
                    setLoadId(null);
                    setTimeout(() => setLoadId(col.id), 100);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-fg-muted)',
                    cursor: 'pointer',
                    fontSize: 12,
                    padding: '0 4px',
                    lineHeight: '18px',
                  }}
                  title="New chain"
                >
                  🔗
                </button>
              </div>
              {isExpanded && items.map((item: any, i: number) => (
                <div
                  key={item.id ?? i}
                  onClick={() => {
                    const method = (item.request?.method ?? 'GET') as any;
                    const url = typeof item.request?.url === 'string'
                      ? item.request.url
                      : (item.request?.url?.raw ?? '');
                    const tabId = addTab({ 
                      method, 
                      url,
                      sourceCollectionId: col.id,
                      sourceItemIndex: i,
                      sourceItemName: item.name,
                    });
                    // Load full spec into the request store
                    const urlStr = typeof item.request?.url === 'string'
                      ? item.request.url
                      : (item.request?.url?.raw ?? '');
                    const headers = (item.request?.header || []).map((h: any) => ({
                      key: h.key, value: h.value, enabled: true,
                    }));
                    const bodyMode = item.request?.body?.mode || 'none';
                    const qp = (item as any)._queryParams || [];
                    useRequest.getState().setSpec(tabId, {
                      requestId: crypto.randomUUID(),
                      method: method,
                      url: urlStr,
                      headers,
                      queryParams: qp,
                      pathParams: [],
                      body: bodyMode === 'none' ? { mode: 'none' }
                        : bodyMode === 'raw' ? { mode: 'raw', contentType: 'application/json', text: item.request?.body?.raw || '' }
                        : bodyMode === 'urlencoded' ? { mode: 'urlencoded', fields: item.request?.body?.urlencoded || [] }
                        : bodyMode === 'form-data' ? { mode: 'form-data', fields: item.request?.body?.formdata || [] }
                        : { mode: 'none' },
                      auth: item.request?.auth || { type: 'none' },
                      settings: {
                        timeoutMs: 30000, followRedirects: true,
                        maxRedirects: 10, sslVerify: true, saveCookiesToJar: false,
                      },
                    });
                  }}
                  style={{
                    ...treeItemStyle,
                    paddingLeft: 'var(--space-5)',
                    cursor: 'pointer',
                  }}
                  title={item.request?.url?.raw ?? item.request?.url ?? ''}
                >
                  <span style={{
                    color: `var(--color-method-${(item.request?.method ?? 'get').toLowerCase()})`,
                    fontWeight: 600,
                    fontSize: 10,
                    marginRight: 'var(--space-1)',
                  }}>
                    {item.request?.method ?? 'GET'}
                  </span>
                  <span style={{
                    fontSize: 11,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}>
                    {item.name ?? (item.request?.url?.raw ?? item.request?.url ?? 'Untitled')}
                  </span>
                </div>
              ))}
              {/* Chain items */}
              {(fullCollection?.chains ?? []).map((chain: any) => (
                <ChainSidebarItem
                  key={chain.id}
                  chain={chain}
                  collectionId={col.id}
                  isActive={activeChainId === chain.id}
                  onClick={() => {
                    openChain(col.id, chain.id);
                    // Open chain editor in the center pane
                    window.dispatchEvent(new CustomEvent('chain:open', { detail: { collectionId: col.id, chainId: chain.id } }));
                  }}
                />
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}

// Shared styles
export const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontWeight: 600,
  fontSize: 11,
  textTransform: 'uppercase',
  color: 'var(--color-fg-muted)',
  letterSpacing: '0.05em',
  marginBottom: 'var(--space-1)',
};

export const plusBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-1)',
  color: 'var(--color-fg-muted)',
  cursor: 'pointer',
  fontSize: 14,
  padding: '0 6px',
  lineHeight: '18px',
};

export const treeItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: 'var(--space-1) var(--space-2)',
  cursor: 'pointer',
  fontSize: 12,
  borderRadius: 'var(--radius-1)',
  marginBottom: 2,
};

export const mutedStyle: React.CSSProperties = {
  color: 'var(--color-fg-muted)',
  fontSize: 12,
  padding: 'var(--space-2) 0',
};

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--space-1) var(--space-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-1)',
  background: 'var(--color-bg-elevated)',
  color: 'var(--color-fg)',
  fontSize: 12,
};

export const smallBtnStyle: React.CSSProperties = {
  padding: '2px var(--space-2)',
  background: 'var(--color-accent)',
  color: 'white',
  border: 'none',
  borderRadius: 'var(--radius-1)',
  cursor: 'pointer',
  fontSize: 11,
};
