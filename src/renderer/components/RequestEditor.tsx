import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTabs } from '../state/useTabs';
import { useRequest, type RequestSpec } from '../state/useRequest';
import { useCollectionsStore } from '../store/collections';
import { useEnvironmentsStore } from '../store/environments';
import { useResolveVariables } from '../hooks/useVariables';
import { useHistoryStore } from '../store/history';
import { MethodPicker } from './RequestEditor/MethodPicker';
import { SubTabs, type SubTab } from './RequestEditor/SubTabs';
import { ParamsTab } from './RequestEditor/ParamsTab';
import { HeadersTab } from './RequestEditor/HeadersTab';
import { BodyTab } from './RequestEditor/BodyTab';
import { AuthTab } from './RequestEditor/AuthTab';
import { SettingsTab } from './RequestEditor/SettingsTab';
import { SaveAsModal } from './RequestEditor/SaveAsModal';
import { specToCollectionItem } from './RequestEditor/specToItem';

export function RequestEditor() {
  const activeTabId = useTabs((s) => s.activeTabId);
  const tabId = activeTabId ?? 'default';
  const spec = useRequest((s) => s.specs[tabId]);
  const setMethod = useRequest((s) => s.setMethod);
  const setUrl = useRequest((s) => s.setUrl);
  const getSpec = useRequest((s) => s.getSpec);

  const [activeSubTab, setActiveSubTab] = useState<SubTab>('Params');
  const [sending, setSending] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnoseResult, setDiagnoseResult] = useState<any>(null);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [unresolvedWarning, setUnresolvedWarning] = useState<string[] | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  const activeCollectionId = useCollectionsStore((s) => s.activeCollectionId);
  const activeEnvId = useEnvironmentsStore((s) => s.activeEnvId);
  const appendEntry = useHistoryStore((s) => s.appendEntry);
  const queryClient = useQueryClient();

  const method = spec?.method ?? 'GET';
  const baseUrl = spec?.url ?? '';

  // Compute display URL with query params appended
  const displayUrl = useMemo(() => {
    const params = spec?.queryParams ?? [];
    const active = params.filter((p) => p.enabled && p.key);
    if (active.length === 0) return baseUrl;
    try {
      const u = new URL(baseUrl || 'http://localhost');
      for (const p of active) u.searchParams.append(p.key, p.value);
      // Preserve original base (include protocol) when baseUrl is empty
      return baseUrl ? u.toString() : '';
    } catch {
      return baseUrl;
    }
  }, [baseUrl, spec?.queryParams]);

  const isValidUrl = useMemo(() => {
    if (!baseUrl || baseUrl.length === 0) return false;
    try { new URL(baseUrl); return true; } catch { return false; }
  }, [baseUrl]);

  const handleSend = useCallback(async () => {
    if (!isValidUrl || sending) return;
    const currentSpec = getSpec(tabId);
    const requestId = crypto.randomUUID();
    setUnresolvedWarning(null);

    // D-08/D-09: Resolve variables before sending
    let resolvedSpec = currentSpec;
    try {
      const varsResult = await window.api.variables.resolve({
        spec: currentSpec as any,
        activeEnvId,
        activeCollectionId,
        globals: [],
      });
      resolvedSpec = varsResult.resolved;
      if (varsResult.unresolved && varsResult.unresolved.length > 0) {
        setUnresolvedWarning(varsResult.unresolved);
      }
    } catch {
      // Variable resolution failed — send without resolution
    }

    setCurrentRequestId(requestId);
    setSending(true);
    setDiagnoseResult(null);

    try {
      const result = await window.api.request.send({ ...resolvedSpec, requestId });
      window.dispatchEvent(new CustomEvent('response:received', { detail: { tabId, result } }));

      // Append to history (D-19) — persist via IPC
      const collectionId = activeCollectionId ?? '__global__';
      try {
        await window.api.history.append({
          collectionId,
          timestamp: Date.now(),
          request: {
            method: resolvedSpec.method,
            url: resolvedSpec.url,
            headers: (resolvedSpec.headers || []).map((h: any) => ({ key: h.key, value: h.value })),
          },
          response: {
            status: result.status,
            statusText: result.statusText,
            durationMs: result.timing?.total ?? 0,
          },
        });
        // Also update local store for immediate UI feedback
        appendEntry(collectionId, {
          id: requestId,
          timestamp: Date.now(),
          collectionId,
          request: { method: resolvedSpec.method, url: resolvedSpec.url },
          response: {
            status: result.status,
            statusText: result.statusText,
            durationMs: result.timing?.total ?? 0,
          },
        } as any);
      } catch { /* history is non-critical */ }

      // Invalidate history query so sidebar refreshes
      queryClient.invalidateQueries({ queryKey: ['history'] });
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('response:error', { detail: { tabId, error: { code: 'UNKNOWN', message: err.message } } }));
    } finally {
      setSending(false);
      setCurrentRequestId(null);
    }
  }, [isValidUrl, sending, tabId, getSpec, activeEnvId, activeCollectionId, appendEntry]);

  const handleCancel = useCallback(async () => {
    if (currentRequestId) {
      await window.api.request.cancel({ requestId: currentRequestId });
      setSending(false);
      setCurrentRequestId(null);
      window.dispatchEvent(new CustomEvent('response:cancelled', { detail: { tabId } }));
    }
  }, [currentRequestId, tabId]);

  const handleCopyCurl = useCallback(async () => {
    const currentSpec = getSpec(tabId);
    try {
      // Resolve variables first for the cURL output (D-16)
      let resolvedUrl = currentSpec.url;
      try {
        const varsResult = await window.api.variables.resolve({
          spec: currentSpec as any,
          activeEnvId,
          activeCollectionId,
          globals: [],
        });
        resolvedUrl = varsResult.resolved.url;
      } catch { /* use original URL */ }

      const { curl } = await window.api.curl.generate({ spec: currentSpec as any, resolvedUrl });
      await navigator.clipboard.writeText(curl);
    } catch { /* fallback */ }
  }, [tabId, getSpec, activeEnvId, activeCollectionId]);

  const handleDiagnose = useCallback(async () => {
    setDiagnosing(true);
    try {
      const result = await window.api.network.diagnose();
      setDiagnoseResult(result);
    } finally {
      setDiagnosing(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    const tabs = useTabs.getState().openTabs;
    const activeTab = tabs.find((t) => t.id === tabId);

    if (activeTab?.sourceCollectionId != null && activeTab?.sourceItemIndex != null) {
      // In-place save: update existing collection item
      try {
        const currentSpec = getSpec(tabId);
        const itemName = activeTab.sourceItemName || (currentSpec.method + ' ' + currentSpec.url);
        const item = specToCollectionItem(currentSpec, itemName);

        const coll = await window.api.collections.read({ id: activeTab.sourceCollectionId });
        coll.item = coll.item || [];
        coll.item[activeTab.sourceItemIndex] = item;

        await window.api.collections.update({ id: activeTab.sourceCollectionId, collection: coll });

        useTabs.getState().markClean(tabId);
        useTabs.getState().updateTab(tabId, { sourceItemName: currentSpec.method + ' ' + currentSpec.url });

        queryClient.invalidateQueries({ queryKey: ['collections'] });
        queryClient.invalidateQueries({ queryKey: ['collections', activeTab.sourceCollectionId] });
      } catch (err) {
        console.error('Failed to save request in-place:', err);
      }
    } else {
      // New unsaved tab: open SaveAsModal
      setSaveModalOpen(true);
    }
  }, [tabId, getSpec, queryClient]);

  const handleSaveAs = useCallback(() => {
    setSaveModalOpen(true);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--color-border)', padding: 'var(--space-3)' }}>
      {/* Row 1: Toolbar */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', alignItems: 'center' }}>
        <MethodPicker value={method} onChange={(m) => setMethod(tabId, m)} />

        <input
          type="text"
          value={displayUrl}
          onChange={(e) => {
            // If URL has query string, parse it apart
            const val = e.target.value;
            const qIdx = val.indexOf('?');
            if (qIdx >= 0) {
              setUrl(tabId, val.slice(0, qIdx));
            } else {
              setUrl(tabId, val);
            }
          }}
          placeholder="https://example.com/path"
          style={{
            flex: 1,
            padding: 'var(--space-2) var(--space-3)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-1)',
            background: 'var(--color-bg-elevated)',
            color: 'var(--color-fg)',
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
          }}
        />

        {sending ? (
          <button onClick={handleCancel} style={cancelBtnStyle}>
            Cancel
          </button>
        ) : (
          <button
            disabled={!isValidUrl}
            onClick={handleSend}
            title={!isValidUrl ? 'Enter a valid URL to send' : 'Send request (Ctrl+Enter)'}
            style={{
              ...sendBtnStyle,
              opacity: isValidUrl ? 1 : 0.5,
              cursor: isValidUrl ? 'pointer' : 'not-allowed',
            }}
          >
            Send
          </button>
        )}

        <button onClick={handleSave} style={toolbarBtnStyle} title="Save (Ctrl+S)">
          Save
        </button>

        <button onClick={handleCopyCurl} style={toolbarBtnStyle} title="Copy as cURL (Ctrl+Shift+C)">
          Copy as cURL
        </button>

        <button
          onClick={handleDiagnose}
          disabled={diagnosing}
          style={{ ...toolbarBtnStyle, opacity: diagnosing ? 0.5 : 1 }}
        >
          {diagnosing ? 'Diagnosing…' : 'Diagnose Connection'}
        </button>
      </div>

      {/* Unresolved variables warning (D-09) */}
      {unresolvedWarning && unresolvedWarning.length > 0 && (
        <div style={{
          marginBottom: 'var(--space-3)',
          padding: 'var(--space-2) var(--space-3)',
          background: 'var(--color-warning, #fbbf24)',
          color: '#000',
          borderRadius: 'var(--radius-1)',
          fontSize: 12,
        }}>
          <strong>Warning:</strong> unresolved variables: {unresolvedWarning.map(v => `{{${v}}}`).join(', ')}
        </div>
      )}

      {/* Row 2: Sub-tabs */}
      <SubTabs active={activeSubTab} onChange={setActiveSubTab} />

      {/* Row 3: Active sub-tab content */}
      <div style={{ minHeight: 120, maxHeight: 320, overflow: 'auto' }}>
        {activeSubTab === 'Params' && <ParamsTab tabId={tabId} />}
        {activeSubTab === 'Headers' && <HeadersTab tabId={tabId} />}
        {activeSubTab === 'Body' && <BodyTab tabId={tabId} />}
        {activeSubTab === 'Auth' && <AuthTab tabId={tabId} />}
        {activeSubTab === 'Settings' && <SettingsTab tabId={tabId} />}
      </div>

      {/* Diagnose result */}
      {diagnoseResult && (
        <div style={{
          marginTop: 'var(--space-3)',
          padding: 'var(--space-3)',
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-1)',
          fontSize: 13,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <span style={{
              background: diagnoseResult.ok ? 'var(--color-method-get)' : 'var(--color-method-delete)',
              color: 'white', padding: '2px 8px', borderRadius: 'var(--radius-1)', fontWeight: 600, fontSize: 12,
            }}>
              {diagnoseResult.ok ? 'OK' : (diagnoseResult.error?.code || 'ERROR')}
            </span>
            <span style={{ color: 'var(--color-fg-muted)', fontFamily: 'var(--font-mono)' }}>
              {diagnoseResult.target?.host}:{diagnoseResult.target?.port}
            </span>
          </div>
          {!diagnoseResult.ok && diagnoseResult.error && (
            <div style={{ color: 'var(--color-fg)' }}>{diagnoseResult.error.message}</div>
          )}
          {diagnoseResult.timing?.total > 0 && (
            <div style={{ color: 'var(--color-fg-muted)', marginTop: 4 }}>Total: {diagnoseResult.timing.total}ms</div>
          )}
        </div>
      )}

      <SaveAsModal
        open={saveModalOpen}
        requestName={method + ' ' + baseUrl}
        spec={spec}
        savedTabId={tabId}
        onClose={() => setSaveModalOpen(false)}
        onSaved={() => setSaveModalOpen(false)}
      />
    </div>
  );
}

const sendBtnStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  background: 'var(--color-accent)',
  color: 'white',
  border: 'none',
  borderRadius: 'var(--radius-1)',
  fontWeight: 600,
  fontSize: 13,
};

const cancelBtnStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  background: 'var(--color-method-delete)',
  color: 'white',
  border: 'none',
  borderRadius: 'var(--radius-1)',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
};

const toolbarBtnStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  background: 'transparent',
  color: 'var(--color-fg-muted)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-1)',
  cursor: 'pointer',
  fontSize: 13,
  whiteSpace: 'nowrap',
};
