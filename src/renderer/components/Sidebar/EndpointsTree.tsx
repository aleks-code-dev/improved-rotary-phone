import React, { useState, useCallback, useEffect } from 'react';
import { useEndpointsList, useEndpointsScan } from '../../hooks/useEndpoints';
import { useEndpointsStore, EndpointData } from '../../store/endpoints';
import { useTabs } from '../../state/useTabs';
import { useRequest } from '../../state/useRequest';
import { headerStyle, treeItemStyle, mutedStyle, inputStyle } from './CollectionsTree';
import { ScanProgress } from '../ScanProgress';
import { SpringProjectPicker } from '../SpringProjectPicker';
import { MethodBadge } from '../ui/MethodBadge';

const METHOD_ORDER = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const rescanBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--ds-border)',
  borderRadius: 'var(--ds-radius-1)',
  color: 'var(--ds-text-muted)',
  cursor: 'pointer',
  fontSize: 12,
  padding: '0 6px',
  lineHeight: '18px',
};

export function EndpointsTree() {
  const { data: endpoints, isLoading } = useEndpointsList();
  const scanMutation = useEndpointsScan();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const activeProjectId = useEndpointsStore((s) => s.activeProjectId);
  const activeProjectPath = useEndpointsStore((s) => s.activeProjectPath);
  const scanStatus = useEndpointsStore((s) => s.scanStatus);
  const lastScanResult = useEndpointsStore((s) => s.lastScanResult);
  const lastScanError = useEndpointsStore((s) => s.lastScanError);
  const setSelectedEndpoint = useEndpointsStore((s) => s.setSelectedEndpoint);
  const selectedEndpointId = useEndpointsStore((s) => s.selectedEndpointId);
  const addTab = useTabs((s) => s.addTab);

  // Open-time rescan: trigger rescan if project path exists on mount
  useEffect(() => {
    if (activeProjectPath && scanStatus === 'idle' && !lastScanResult) {
      scanMutation.mutate(activeProjectPath);
    }
  }, [activeProjectPath]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const detectedDto = endpoint.requestBodyFqn
      ? {
          fqn: endpoint.requestBodyFqn,
          simpleName: endpoint.requestBodyFqn.split('.').pop() ?? endpoint.requestBodyFqn,
        }
      : undefined;

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
      detectedDto,
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
        <div style={{ padding: 'var(--ds-space-2)' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--ds-space-1)',
            marginBottom: 'var(--ds-space-2)',
          }}>
            <span style={{ color: 'var(--ds-method-delete)', fontSize: 14 }}>✗</span>
            <span style={{ fontSize: 'var(--ds-text-sm)', fontWeight: 600, color: 'var(--ds-text)' }}>
              Scan failed
            </span>
          </div>
          <div style={{
            fontSize: 'var(--ds-text-sm)',
            color: 'var(--ds-text-muted)',
            marginBottom: 'var(--ds-space-3)',
            lineHeight: 1.5,
          }}>
            {lastScanError || 'Unknown error'}. Check that the project is a valid Spring Boot project with source code accessible on disk.
          </div>
          <button
            onClick={handleRescan}
            style={{
              background: 'var(--ds-primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--ds-radius-1)',
              padding: 'var(--ds-space-1) var(--ds-space-3)',
              fontSize: 'var(--ds-text-sm)',
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
        <div style={{ padding: 'var(--ds-space-2)' }}>
          <div style={{
            fontSize: 'var(--ds-text-sm)',
            fontWeight: 600,
            color: 'var(--ds-text)',
            marginBottom: 'var(--ds-space-2)',
          }}>
            No @RestController endpoints detected
          </div>
          <div style={{
            fontSize: 'var(--ds-text-sm)',
            color: 'var(--ds-text-muted)',
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

  // Filter controllers + endpoints by search query
  const filteredControllers = searchQuery
    ? sortedControllers.map((ctrl) => {
        const matchingEndpoints = ctrl.endpoints.filter(
          (ep) =>
            ep.fullPath.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ep.method.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ep.handlerMethod.toLowerCase().includes(searchQuery.toLowerCase())
        );
        return { ...ctrl, endpoints: matchingEndpoints };
      }).filter((c) => c.endpoints.length > 0 || c.simpleName.toLowerCase().includes(searchQuery.toLowerCase()))
    : sortedControllers;

  return (
    <div>
      <div style={headerStyle}>
        <span>Endpoints</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-1)' }}>
          <span style={{
            fontSize: 10,
            color: 'var(--ds-text-muted)',
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

      {controllers.length > 0 && (
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search paths, methods..."
          style={{ ...inputStyle, marginBottom: 'var(--ds-space-2)' }}
        />
      )}

      {filteredControllers.map((ctrl) => {
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
              <span
                style={{
                  fontSize: 9,
                  color: 'var(--ds-text-muted)',
                  transition: 'transform 120ms ease',
                  display: 'inline-block',
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                }}
              >▶</span>
              <span style={{ marginRight: 'var(--ds-space-1)' }}>📦</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ctrl.simpleName}</span>
              <span style={{
                fontSize: 10,
                color: 'var(--ds-text-muted)',
                background: 'var(--ds-surface)',
                padding: '0 6px',
                borderRadius: 'var(--ds-radius-1)',
                minWidth: 18,
                textAlign: 'center',
              }}>
                {ctrl.endpoints.length}
              </span>
            </div>
            {isExpanded && sortedEndpoints.map((ep) => (
              <div
                key={ep.id}
                onClick={() => handleEndpointClick(ep)}
                style={{
                  ...treeItemStyle,
                  paddingLeft: 'var(--ds-space-5)',
                  fontWeight: selectedEndpointId === ep.id ? 600 : 400,
                  background: selectedEndpointId === ep.id ? 'var(--ds-surface)' : 'transparent',
                }}
                title={`${ep.method} ${ep.fullPath}`}
              >
                <MethodBadge method={ep.method as any} size="xs" />
                <span style={{
                  fontFamily: 'var(--ds-font-mono)',
                  fontSize: 'var(--ds-text-xs)',
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
