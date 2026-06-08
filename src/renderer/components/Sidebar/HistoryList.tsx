import { useState } from 'react';
import { useHistoryList } from '../../hooks/useHistory';
import { useCollectionsStore } from '../../store/collections';
import { useHistoryStore } from '../../store/history';
import { useTabs } from '../../state/useTabs';
import { headerStyle, mutedStyle, inputStyle } from './CollectionsTree';
import { MethodBadge } from '../ui/MethodBadge';

export function HistoryList() {
  const searchQuery = useHistoryStore((s) => s.searchQuery);
  const setSearch = useHistoryStore((s) => s.setSearch);
  const { data: entries, isLoading } = useHistoryList(null, searchQuery);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
        style={{ ...inputStyle, marginBottom: 'var(--ds-space-2)' }}
      />

      {list.length === 0 ? (
        <div style={mutedStyle}>
          {searchQuery ? 'No matching entries' : 'No requests sent yet'}
        </div>
      ) : (
        <>
          {list.map((entry: any) => {
            const method = (entry.request?.method ?? 'GET') as any;
            return (
              <div
                key={entry.id}
                onMouseEnter={() => setHoveredId(entry.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  ...historyItemStyle,
                  borderLeft: `3px solid var(--ds-method-${method.toLowerCase()})`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-1)' }}>
                  <MethodBadge method={method} size="xs" />
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, color: 'var(--ds-text-muted)' }}>
                    {formatRelativeTime(entry.timestamp)}
                  </span>
                </div>
                <div style={{
                  fontSize: 'var(--ds-text-xs)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: 'var(--ds-text)',
                  margin: '2px 0',
                  fontFamily: 'var(--ds-font-mono)',
                }}>
                  {entry.request?.url ?? ''}
                </div>
                {entry.response && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-1)' }}>
                    <span style={{
                      fontSize: 10,
                      color: entry.response.status < 400 ? 'var(--ds-method-get)' : 'var(--ds-method-delete)',
                      fontWeight: 600,
                    }}>
                      {entry.response.status} {entry.response.statusText}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--ds-text-muted)' }}>
                      · {entry.response.durationMs ?? '?'}ms
                    </span>
                    {hoveredId === entry.id && (
                      <button
                        onClick={() => {
                          // Re-send: open a new tab with this request
                          // (would dispatch an event — keep simple for v1)
                          navigator.clipboard.writeText(entry.request?.url ?? '');
                        }}
                        style={{
                          marginLeft: 'auto',
                          background: 'transparent',
                          color: 'var(--ds-text-muted)',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 10,
                          padding: '0 4px',
                        }}
                        title="Copy URL"
                        aria-label="Copy URL"
                      >
                        Copy
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {list.length === 100 && (
            <div style={{ ...mutedStyle, fontSize: 10, textAlign: 'center' }}>Showing last 100 requests</div>
          )}
        </>
      )}
    </div>
  );
}

const historyItemStyle: React.CSSProperties = {
  padding: 'var(--ds-space-1) var(--ds-space-2)',
  marginBottom: 2,
  cursor: 'pointer',
  borderRadius: 'var(--ds-radius-1)',
  background: 'var(--ds-surface)',
  fontSize: 'var(--ds-text-xs)',
  transition: 'background 120ms ease',
};

function formatRelativeTime(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}
