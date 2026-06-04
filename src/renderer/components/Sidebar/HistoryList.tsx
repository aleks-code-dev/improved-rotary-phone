import { useState } from 'react';
import { useHistoryList } from '../../hooks/useHistory';
import { useCollectionsStore } from '../../store/collections';
import { useHistoryStore } from '../../store/history';
import { headerStyle, mutedStyle, inputStyle } from './CollectionsTree';

export function HistoryList() {
  const activeCollectionId = useCollectionsStore((s) => s.activeCollectionId);
  const searchQuery = useHistoryStore((s) => s.searchQuery);
  const setSearch = useHistoryStore((s) => s.setSearch);
  const { data: entries, isLoading } = useHistoryList(activeCollectionId, searchQuery);

  if (!activeCollectionId) {
    return (
      <div>
        <div style={headerStyle}>History</div>
        <div style={mutedStyle}>Select a collection to view history</div>
      </div>
    );
  }

  if (isLoading) return <div style={mutedStyle}>Loading history...</div>;

  const list = entries ?? [];

  return (
    <div>
      <div style={headerStyle}>History</div>

      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search URL, method, or status..."
        style={{ ...inputStyle, marginBottom: 'var(--space-2)' }}
      />

      {list.length === 0 ? (
        <div style={mutedStyle}>
          {searchQuery ? 'No matching entries' : 'No requests sent yet'}
        </div>
      ) : (
        <>
          {list.map((entry: any) => (
            <div key={entry.id} style={{
              ...historyItemStyle,
              borderLeft: `3px solid var(--color-method-${(entry.request?.method ?? 'get').toLowerCase()})`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontWeight: 600,
                  fontSize: 10,
                  color: `var(--color-method-${(entry.request?.method ?? 'get').toLowerCase()})`,
                }}>
                  {entry.request?.method ?? 'GET'}
                </span>
                <span style={{ fontSize: 10, color: 'var(--color-fg-muted)' }}>
                  {formatRelativeTime(entry.timestamp)}
                </span>
              </div>
              <div style={{
                fontSize: 11,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: 'var(--color-fg)',
                margin: '2px 0',
              }}>
                {entry.request?.url ?? ''}
              </div>
              {entry.response && (
                <span style={{
                  fontSize: 10,
                  color: entry.response.status < 400 ? 'var(--color-method-get)' : 'var(--color-method-delete)',
                  fontWeight: 600,
                }}>
                  {entry.response.status} {entry.response.statusText} · {entry.response.durationMs ?? '?'}ms
                </span>
              )}
            </div>
          ))}
          {list.length === 100 && (
            <div style={{ ...mutedStyle, fontSize: 10, textAlign: 'center' }}>Showing last 100 requests</div>
          )}
        </>
      )}
    </div>
  );
}

const historyItemStyle: React.CSSProperties = {
  padding: 'var(--space-1) var(--space-2)',
  marginBottom: 4,
  cursor: 'pointer',
  borderRadius: 'var(--radius-1)',
  background: 'var(--color-bg-tertiary)',
  fontSize: 11,
};

function formatRelativeTime(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}
