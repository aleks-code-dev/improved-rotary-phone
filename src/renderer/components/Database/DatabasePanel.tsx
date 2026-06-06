import { useState, useEffect, useCallback } from 'react';
import { DbConnectionForm } from './DbConnectionForm';
import { DbTableTree } from './DbTableTree';
import { DbRowDetail } from './DbRowDetail';
import { IconButton } from '../ui/IconButton';
import { useTabs } from '../../state/useTabs';
import { useRequest } from '../../state/useRequest';
import { useEndpointsStore } from '../../store/endpoints';
import { useDbSelection } from '../../store/dbSelection';

interface DbConnectionMeta {
  id: string;
  name: string;
  dbType: 'postgresql' | 'mysql' | 'oracle' | 'h2' | 'unknown';
  connected: boolean;
}

interface SelectedRow {
  row: Record<string, unknown>;
  tableName: string;
  schema: string | null;
}

const DB_TYPE_ICONS: Record<string, string> = {
  postgresql: '🐘',
  mysql: '🐬',
  oracle: '🔴',
  h2: '💧',
  unknown: '🗄',
};

export function DatabasePanel({ width }: { width: number }) {
  const [connections, setConnections] = useState<DbConnectionMeta[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<SelectedRow | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const activeTabId = useTabs((s) => s.activeTabId);
  const tabId = activeTabId ?? 'default';
  const detectedDto = useEndpointsStore((s) => s.selectedEndpointId);

  // Find the detected DTO FQN from the active tab's spec
  const spec = useRequest((s) => s.specs[tabId]);
  const setBody = useRequest((s) => s.setBody);
  const detectedDtoFqn = (spec as any)?.detectedDto?.fqn ?? null;

  const refreshConnections = useCallback(async () => {
    try {
      const list = await window.api.db.connections.list();
      setConnections(list);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshConnections();
  }, [refreshConnections]);

  const handleConnectionCreated = useCallback((connectionId: string) => {
    setShowNewForm(false);
    refreshConnections().then(() => {
      // Mark the new connection as connected (Save→connect succeeded).
      setConnections((prev) =>
        prev.map((c) => (c.id === connectionId ? { ...c, connected: true } : c)),
      );
    });
  }, [refreshConnections]);

  const handleRowSelect = useCallback(async (row: Record<string, unknown>, tableName: string, schema: string | null) => {
    setSelectedRow({ row, tableName, schema });
    useDbSelection.getState().setSelection({
      selectedTableName: tableName,
      selectedRow: { row, schema },
    });
    // If the active endpoint has a detected DTO, also auto-fill the body
    // in the request builder. This makes "click a row → use as body" a
    // one-click workflow — no need to then click the button in BodyTab.
    // Silently no-op on IPC failure (the DbRowDetail button remains a fallback).
    if (!detectedDtoFqn || !selectedConnectionId) return;
    try {
      const result = await window.api.db.mapRowToDto({
        connectionId: selectedConnectionId,
        tableName,
        rowId: row,
        dtoFqn: detectedDtoFqn,
      });
      if (result.ok) {
        setBody(tabId, {
          mode: 'raw',
          contentType: 'application/json',
          text: result.bodyJson,
        });
        window.dispatchEvent(new CustomEvent('body:auto-filled', { detail: { tabId } }));
      }
    } catch { /* silent — fallback button still works */ }
  }, [detectedDtoFqn, selectedConnectionId, tabId, setBody]);

  const handleUseRow = useCallback((bodyJson: string) => {
    // Auto-fill the body editor with the row's JSON (007-D)
    setBody(tabId, {
      mode: 'raw',
      contentType: 'application/json',
      text: bodyJson,
    });
    // Switch to Body tab in the request editor
    window.dispatchEvent(new CustomEvent('body:auto-filled', { detail: { tabId } }));
  }, [tabId, setBody]);

  const selectedConnection = connections.find((c) => c.id === selectedConnectionId);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width,
      borderLeft: '1px solid var(--ds-border)',
      background: 'var(--ds-bg)',
      overflow: 'hidden',
    }}>
      {/* Panel header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--ds-space-2) var(--ds-space-3)',
        borderBottom: '1px solid var(--ds-border)',
        background: 'var(--ds-surface)',
        fontSize: 'var(--ds-text-xs)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--ds-text-muted)',
      }}>
        <span>Database</span>
        <IconButton
          variant="ghost"
          size="sm"
          onClick={() => setShowNewForm(true)}
          title="New connection"
          aria-label="New connection"
        >
          +
        </IconButton>
      </div>

      {/* 2-column layout (006-B): left = connections list, right = workspace */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left column: connections list */}
        <div style={{
          width: 130,
          borderRight: '1px solid var(--ds-border)',
          overflow: 'auto',
          background: 'var(--ds-surface)',
        }}>
          {loading ? (
            <div style={{ padding: 'var(--ds-space-3)', color: 'var(--ds-text-muted)', fontSize: 'var(--ds-text-2xs)' }}>
              Loading…
            </div>
          ) : connections.length === 0 ? (
            <div style={{ padding: 'var(--ds-space-3)', color: 'var(--ds-text-muted)', fontSize: 'var(--ds-text-2xs)' }}>
              No connections
            </div>
          ) : (
            connections.map((conn) => {
              const isActive = conn.id === selectedConnectionId;
              const icon = DB_TYPE_ICONS[conn.dbType] ?? DB_TYPE_ICONS.unknown;
              return (
                <div
                  key={conn.id}
                  onClick={async () => {
                    setSelectedConnectionId(conn.id);
                    setSelectedRow(null);
                    useDbSelection.getState().setSelection({
                      selectedConnectionId: conn.id,
                      selectedTableName: null,
                      selectedRow: null,
                    });
                    // Auto-connect on select if the pool isn't open
                    // (e.g. helper restarted, or user never ran Test).
                    if (!conn.connected) {
                      try {
                        const r = await window.api.db.connect({ connectionId: conn.id });
                        if (r?.ok) {
                          setConnections((prev) =>
                            prev.map((c) => (c.id === conn.id ? { ...c, connected: true } : c)),
                          );
                        }
                      } catch {
                        // Leave dot gray; user can try again or re-Save.
                      }
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--ds-space-1)',
                    padding: '4px var(--ds-space-2)',
                    cursor: 'pointer',
                    fontSize: 'var(--ds-text-xs)',
                    borderRadius: 'var(--ds-radius-1)',
                    margin: 2,
                    background: isActive ? 'var(--ds-bg)' : 'transparent',
                    color: isActive ? 'var(--ds-text)' : 'var(--ds-text-muted)',
                    fontWeight: isActive ? 600 : 400,
                    borderLeft: isActive ? '2px solid var(--ds-primary)' : '2px solid transparent',
                  }}
                >
                  <span style={{ fontSize: 'var(--ds-text-sm)' }}>{icon}</span>
                  <span style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>{conn.name}</span>
                  <span style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: conn.connected ? 'var(--ds-method-get)' : 'var(--ds-text-muted)',
                    flexShrink: 0,
                  }} title={conn.connected ? 'Connected' : 'Disconnected'} />
                </div>
              );
            })
          )}
        </div>

        {/* Right column: workspace (form / tree / row detail) */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {showNewForm || (connections.length === 0 && !loading) ? (
            <DbConnectionForm onConnectionCreated={handleConnectionCreated} />
          ) : selectedConnection ? (
            <>
              <DbTableTree
                connectionId={selectedConnection.id}
                onRowSelect={handleRowSelect}
              />
              {selectedRow && (
                <DbRowDetail
                  row={selectedRow.row}
                  tableName={selectedRow.tableName}
                  schema={selectedRow.schema}
                  connectionId={selectedConnection.id}
                  dtoFqn={detectedDtoFqn}
                  onUseRow={handleUseRow}
                />
              )}
            </>
          ) : (
            <div style={{
              padding: 'var(--ds-space-3)',
              color: 'var(--ds-text-muted)',
              fontSize: 'var(--ds-text-xs)',
              textAlign: 'center',
            }}>
              Select a connection
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
