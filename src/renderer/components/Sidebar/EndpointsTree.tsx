import React, { useState, useCallback } from 'react';
import { useEndpointsList, useEndpointsScan } from '../../hooks/useEndpoints';
import { useEndpointsStore, EndpointData } from '../../store/endpoints';
import { useTabs } from '../../state/useTabs';
import { useRequest } from '../../state/useRequest';
import { headerStyle, treeItemStyle, mutedStyle } from './CollectionsTree';
import { ScanProgress } from '../ScanProgress';
import { SpringProjectPicker } from '../SpringProjectPicker';

const METHOD_ORDER = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const rescanBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-1)',
  color: 'var(--color-fg-muted)',
  cursor: 'pointer',
  fontSize: 14,
  padding: '0 4px',
  lineHeight: '18px',
  width: 18,
  height: 18,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export function EndpointsTree() {
  const { data: endpoints, isLoading } = useEndpointsList();
  const scanMutation = useEndpointsScan();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const activeProjectId = useEndpointsStore((s) => s.activeProjectId);
  const activeProjectPath = useEndpointsStore((s) => s.activeProjectPath);
  const scanStatus = useEndpointsStore((s) => s.scanStatus);
  const lastScanResult = useEndpointsStore((s) => s.lastScanResult);
  const lastScanError = useEndpointsStore((s) => s.lastScanError);
  const setSelectedEndpoint = useEndpointsStore((s) => s.setSelectedEndpoint);
  const selectedEndpointId = useEndpointsStore((s) => s.selectedEndpointId);
  const addTab = useTabs((s) => s.addTab);

  const toggleExpand = useCallback((fqn: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(fqn)) next.delete(fqn);
      else next.add(fqn);
      return next;
    });
  }, []);

  const handleEndpointClick = useCallback((endpoint: EndpointData) => {
    setSelectedEndpoint(endpoint.id);

    const tabId = addTab({
      method: endpoint.method as any,
      url: `{{baseUrl}}${endpoint.fullPath}`,
      sourceItemName: `${endpoint.handlerMethod} [${endpoint.sourceFile}]`,
    });

    const pathParams = endpoint.pathVariables.map(p => ({
      key: p.name,
      value: '',
    }));

    const queryParams = endpoint.queryParams.map(p => ({
      key: p.name,
      value: p.defaultValue ?? '',
      enabled: true,
    }));

    const headers = [
      { key: 'Content-Type', value: endpoint.consumes[0] ?? 'application/json', enabled: true },
      { key: 'Accept', value: endpoint.produces[0] ?? 'application/json', enabled: true },
    ];

    const body = endpoint.requestBodyFqn
      ? { mode: 'raw' as const, contentType: 'application/json' as const, text: '{}' }
      : { mode: 'none' as const };

    useRequest.getState().setSpec(tabId, {
      requestId: crypto.randomUUID(),
      method: endpoint.method as any,
      url: `{{baseUrl}}${endpoint.fullPath}`,
      headers,
      queryParams,
      pathParams,
      body,
      auth: { type: 'none' },
      settings: {
        timeoutMs: 30000,
        followRedirects: true,
        maxRedirects: 10,
        sslVerify: true,
        saveCookiesToJar: false,
      },
    });
  }, [addTab, setSelectedEndpoint]);

  const handleRescan = useCallback(() => {
    if (activeProjectPath) {
      scanMutation.mutate(activeProjectPath);
    }
  }, [activeProjectPath, scanMutation]);

  // Empty state: no project selected
  if (!activeProjectId && scanStatus === 'idle') {
    return (
      <div>
        <div style={headerStyle}>
          <span>Endpoints</span>
        </div>
        <SpringProjectPicker />
      </div>
    );
  }

  // Loading state: scanning
  if (scanStatus === 'scanning') {
    const endpointCount = lastScanResult?.totalEndpoints ?? 0;
    return (
      <div>
        <div style={headerStyle}>
          <span>Endpoints</span>
        </div>
        <ScanProgress
          projectPath={activeProjectPath ?? ''}
          endpointCount={endpointCount}
        />
      </div>
    );
  }

  // Error state
  if (scanStatus === 'error') {
    return (
      <div>
        <div style={headerStyle}>
          <span>Endpoints</span>
          {activeProjectPath && (
            <button
              onClick={handleRescan}
              style={rescanBtnStyle}
              title="Rescan Spring project"
              aria-label="Rescan Spring project"
            >
              ⟳
            </button>
          )}
        </div>
        <div style={{ padding: 'var(--space-2)' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            marginBottom: 'var(--space-2)',
          }}>
            <span style={{ color: 'var(--color-status-5xx)', fontSize: 14 }}>✗</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-fg)' }}>
              Scan failed
            </span>
          </div>
          <div style={{
            fontSize: 12,
            color: 'var(--color-fg-muted)',
            marginBottom: 'var(--space-3)',
            lineHeight: 1.5,
          }}>
            {lastScanError || 'Unknown error'}. Check that the project is a valid Spring Boot project with source code accessible on disk.
          </div>
          <button
            onClick={handleRescan}
            style={{
              background: 'var(--color-accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-1)',
              padding: 'var(--space-1) var(--space-3)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Rescan Project
          </button>
        </div>
      </div>
    );
  }

  // Empty state: scan complete but no endpoints
  if (lastScanResult && lastScanResult.controllers.length === 0) {
    return (
      <div>
        <div style={headerStyle}>
          <span>Endpoints</span>
          <button
            onClick={handleRescan}
            style={rescanBtnStyle}
            title="Rescan Spring project"
            aria-label="Rescan Spring project"
          >
            ⟳
          </button>
        </div>
        <div style={{ padding: 'var(--space-2)' }}>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-fg)',
            marginBottom: 'var(--space-2)',
          }}>
            No @RestController endpoints detected
          </div>
          <div style={{
            fontSize: 12,
            color: 'var(--color-fg-muted)',
            lineHeight: 1.5,
          }}>
            This project may not be a Spring Boot project, or controllers use non-standard annotations. Try a different folder or check your project structure.
          </div>
        </div>
      </div>
    );
  }

  // Tree state: endpoints loaded
  const controllers = lastScanResult?.controllers ?? [];
  const sortedControllers = [...controllers].sort((a, b) =>
    a.simpleName.localeCompare(b.simpleName)
  );

  const truncatedPath = (activeProjectPath ?? '').length > 30
    ? '...' + (activeProjectPath ?? '').slice(-27)
    : activeProjectPath ?? '';

  return (
    <div>
      <div style={headerStyle}>
        <span>Endpoints</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <span style={{
            fontSize: 10,
            color: 'var(--color-fg-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 120,
          }} title={activeProjectPath ?? ''}>
            {truncatedPath}
          </span>
          <button
            onClick={handleRescan}
            disabled={scanMutation.isPending}
            style={rescanBtnStyle}
            title="Rescan Spring project"
            aria-label="Rescan Spring project"
          >
            {scanMutation.isPending ? '↻' : '⟳'}
          </button>
        </div>
      </div>

      {sortedControllers.map((ctrl) => {
        const isExpanded = expanded.has(ctrl.fqn);
        const sortedEndpoints = [...ctrl.endpoints].sort((a, b) => {
          const pathCompare = a.fullPath.localeCompare(b.fullPath);
          if (pathCompare !== 0) return pathCompare;
          return METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method);
        });

        return (
          <div key={ctrl.fqn}>
            <div
              onClick={() => toggleExpand(ctrl.fqn)}
              style={treeItemStyle}
            >
              <span style={{ marginRight: 'var(--space-1)', fontSize: 10 }}>
                {isExpanded ? '▼' : '▶'}
              </span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {ctrl.simpleName}
              </span>
              <span style={{ fontSize: 10, color: 'var(--color-fg-muted)' }}>
                ({ctrl.endpoints.length})
              </span>
            </div>
            {isExpanded && sortedEndpoints.map((ep) => (
              <div
                key={ep.id}
                onClick={() => handleEndpointClick(ep)}
                style={{
                  ...treeItemStyle,
                  paddingLeft: 'var(--space-5)',
                  fontWeight: selectedEndpointId === ep.id ? 600 : 400,
                  background: selectedEndpointId === ep.id ? 'var(--color-bg-hover, oklch(0.92 0.005 250))' : 'transparent',
                }}
                title={`${ep.method} ${ep.fullPath}`}
              >
                <span style={{
                  color: `var(--color-method-${ep.method.toLowerCase()})`,
                  fontWeight: 600,
                  fontSize: 10,
                  marginRight: 'var(--space-1)',
                  minWidth: 48,
                }}>
                  {ep.method}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}>
                  {ep.fullPath}
                </span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
