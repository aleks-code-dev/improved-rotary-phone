import { useState, useCallback } from 'react';
import { useCollectionsList, useCreateCollection, useCollection } from '../../hooks/useCollections';
import { useTabs } from '../../state/useTabs';
import { useRequest } from '../../state/useRequest';
import { useCollectionsStore } from '../../store/collections';
import { useChain } from '../../state/useChain';
import { ChainSidebarItem } from '../Chain/ChainSidebarItem';
import { MethodBadge } from '../ui/MethodBadge';
import { IconButton } from '../ui/IconButton';

export function CollectionsTree() {
  const { data: collections, isLoading } = useCollectionsList();
  const createCollection = useCreateCollection();
  const addTab = useTabs((s) => s.addTab);
  const activeCollectionId = useCollectionsStore((s) => s.activeCollectionId);
  const setActiveCollection = useCollectionsStore((s) => s.setActiveCollection);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
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

  const handleCreate = () => {
    if (newName.trim()) {
      createCollection.mutate({ name: newName.trim(), items: [] });
      setNewName('');
      setShowNewModal(false);
    }
  };

  if (isLoading) return <div style={mutedStyle}>Loading collections...</div>;

  const list = collections ?? [];
  const filtered = searchQuery
    ? list.filter((c: any) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : list;

  return (
    <div>
      <div style={headerStyle}>
        <span>Collections</span>
        <button
          onClick={() => setShowNewModal(true)}
          style={plusBtnStyle}
          title="New collection"
          aria-label="New collection"
        >+</button>
      </div>

      {list.length > 0 && (
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search collections..."
          style={{ ...inputStyle, marginBottom: 'var(--ds-space-2)' }}
        />
      )}

      {showNewModal && (
        <div style={{ padding: 'var(--ds-space-2)' }}>
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNewModal(false); }}
            placeholder="Collection name"
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: 'var(--ds-space-1)', marginTop: 'var(--ds-space-1)' }}>
            <button onClick={handleCreate} style={smallBtnStyle}>Create</button>
            <button onClick={() => setShowNewModal(false)} style={{ ...smallBtnStyle, background: 'transparent', color: 'var(--ds-text-muted)' }}>Cancel</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={mutedStyle}>
          {searchQuery ? 'No matching collections' : 'No collections yet'}
        </div>
      ) : (
        filtered.map((col: any) => {
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
                  color: activeCollectionId === col.id ? 'var(--ds-text)' : 'var(--ds-text-muted)',
                  background: activeCollectionId === col.id ? 'var(--ds-surface)' : 'transparent',
                }}
              >
                <span
                  style={{
                    ...chevronStyle,
                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  }}
                >▶</span>
                <span style={{ marginRight: 'var(--ds-space-1)' }}>📁</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{col.name}</span>
                <span style={countBadgeStyle}>{displayCount}</span>
                <div style={hoverActionsStyle}>
                  <IconButton
                    variant="ghost"
                    size="sm"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await window.api.chains.create({ collectionId: col.id, name: 'New Chain' });
                      setLoadId(null);
                      setTimeout(() => setLoadId(col.id), 100);
                    }}
                    title="New chain"
                    aria-label="New chain"
                  >
                    🔗
                  </IconButton>
                </div>
              </div>
              {isExpanded && items.map((item: any, i: number) => {
                const method = (item.request?.method ?? 'GET') as any;
                const urlStr = typeof item.request?.url === 'string'
                  ? item.request.url
                  : (item.request?.url?.raw ?? '');
                return (
                  <div
                    key={item.id ?? i}
                    onClick={() => {
                      const tabId = addTab({
                        method,
                        url: urlStr,
                        sourceCollectionId: col.id,
                        sourceItemIndex: i,
                        sourceItemName: item.name,
                      });
                      // Load full spec into the request store
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
                      paddingLeft: 'var(--ds-space-5)',
                      cursor: 'pointer',
                    }}
                    title={item.request?.url?.raw ?? item.request?.url ?? ''}
                  >
                    <MethodBadge method={method} size="xs" />
                    <span style={{
                      fontSize: 'var(--ds-text-xs)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      fontFamily: 'var(--ds-font-mono)',
                    }}>
                      {item.name ?? urlStr ?? 'Untitled'}
                    </span>
                  </div>
                );
              })}
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

// Shared styles (005-A tree sidebar)
export const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontWeight: 600,
  fontSize: 'var(--ds-text-xs)',
  textTransform: 'uppercase',
  color: 'var(--ds-text-muted)',
  letterSpacing: '0.05em',
  marginBottom: 'var(--ds-space-1)',
};

export const plusBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--ds-border)',
  borderRadius: 'var(--ds-radius-1)',
  color: 'var(--ds-text-muted)',
  cursor: 'pointer',
  fontSize: 14,
  padding: '0 6px',
  lineHeight: '18px',
};

export const treeItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '4px var(--ds-space-2)',
  cursor: 'pointer',
  fontSize: 'var(--ds-text-sm)',
  borderRadius: 'var(--ds-radius-1)',
  marginBottom: 2,
  gap: 'var(--ds-space-1)',
  position: 'relative',
};

export const mutedStyle: React.CSSProperties = {
  color: 'var(--ds-text-muted)',
  fontSize: 'var(--ds-text-sm)',
  padding: 'var(--ds-space-2) 0',
};

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--ds-space-1) var(--ds-space-2)',
  border: '1px solid var(--ds-border)',
  borderRadius: 'var(--ds-radius-1)',
  background: 'var(--ds-surface)',
  color: 'var(--ds-text)',
  fontSize: 'var(--ds-text-sm)',
};

export const smallBtnStyle: React.CSSProperties = {
  padding: '2px var(--ds-space-2)',
  background: 'var(--ds-primary)',
  color: 'white',
  border: 'none',
  borderRadius: 'var(--ds-radius-1)',
  cursor: 'pointer',
  fontSize: 11,
};

const chevronStyle: React.CSSProperties = {
  fontSize: 9,
  color: 'var(--ds-text-muted)',
  transition: 'transform 120ms ease',
  display: 'inline-block',
};

const countBadgeStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--ds-text-muted)',
  background: 'var(--ds-surface)',
  padding: '0 6px',
  borderRadius: 'var(--ds-radius-1)',
  minWidth: 18,
  textAlign: 'center',
};

const hoverActionsStyle: React.CSSProperties = {
  display: 'none',
  // Shown on parent :hover via CSS — keeping simple for now
};
