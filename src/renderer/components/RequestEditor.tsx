import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTabs } from '../state/useTabs';
import { useRequest, type RequestSpec } from '../state/useRequest';
import { useCollectionsStore } from '../store/collections';
import { useEnvironmentsStore } from '../store/environments';
import { useResolveVariables } from '../hooks/useVariables';
import { useHistoryStore } from '../store/history';
import { MethodPicker } from './RequestEditor/MethodPicker';
import { VerticalTabStrip, type VerticalTabItem } from './ui/VerticalTabStrip';
import { IconButton } from './ui/IconButton';
import { SendButton } from './ui/SendButton';
import { ParamsTab } from './RequestEditor/ParamsTab';
import { HeadersTab } from './RequestEditor/HeadersTab';
import { BodyTab } from './RequestEditor/BodyTab';
import { AuthTab } from './RequestEditor/AuthTab';
import { SettingsTab } from './RequestEditor/SettingsTab';
import { SaveAsModal } from './RequestEditor/SaveAsModal';
import { specToCollectionItem } from './RequestEditor/specToItem';

type SubTab = 'Params' | 'Headers' | 'Body' | 'Auth' | 'Settings';

const TAB_ICONS: Record<SubTab, string> = {
  Params: '?',
  Headers: '≡',
  Body: '{ }',
  Auth: '*',
  Settings: '⚙',
};

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
      return baseUrl ? u.toString() : '';
    } catch {
      return baseUrl;
    }
  }, [baseUrl, spec?.queryParams]);

  const isValidUrl = useMemo(() => {
    if (!baseUrl || baseUrl.length === 0) return false;
    try { new URL(baseUrl); return true; } catch { return false; }
  }, [baseUrl]);

  // Counts for vertical tab badges
  const paramCount = useMemo(
    () => (spec?.queryParams ?? []).filter((p) => p.enabled && p.key).length,
    [spec?.queryParams]
  );
  const headerCount = useMemo(
    () => (spec?.headers ?? []).filter((h) => h.enabled && h.key).length,
    [spec?.headers]
  );
  const bodyCount = useMemo(() => {
    const b = spec?.body;
    if (!b) return 0;
    if (b.mode === 'none') return 0;
    if (b.mode === 'raw') return b.text?.trim() ? 1 : 0;
    if (b.mode === 'form-data' || b.mode === 'urlencoded') return b.fields.filter((f) => f.key).length;
    if (b.mode === 'binary') return b.filePath ? 1 : 0;
    return 0;
  }, [spec?.body]);
  const authCount = useMemo(() => {
    const a = spec?.auth;
    if (!a || a.type === 'none') return 0;
    if (a.type === 'bearer') return a.token ? 1 : 0;
    if (a.type === 'basic') return a.username ? 1 : 0;
    if (a.type === 'api-key') return a.key ? 1 : 0;
    return 1;
  }, [spec?.auth]);

  const tabItems: VerticalTabItem[] = [
    { id: 'Params', label: 'Params', icon: <span style={{ fontFamily: 'var(--ds-font-mono)' }}>{TAB_ICONS.Params}</span>, count: paramCount },
    { id: 'Headers', label: 'Headers', icon: <span>{TAB_ICONS.Headers}</span>, count: headerCount },
    { id: 'Body', label: 'Body', icon: <span style={{ fontFamily: 'var(--ds-font-mono)' }}>{TAB_ICONS.Body}</span>, count: bodyCount },
    { id: 'Auth', label: 'Auth', icon: <span>{TAB_ICONS.Auth}</span>, count: authCount },
    { id: 'Settings', label: 'Settings', icon: <span>{TAB_ICONS.Settings}</span> },
  ];

  const handleSend = useCallback(async () => {
    if (!isValidUrl || sending) return;
    const currentSpec = getSpec(tabId);
    const requestId = crypto.randomUUID();
    setUnresolvedWarning(null);

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
      setSaveModalOpen(true);
    }
  }, [tabId, getSpec, queryClient]);

  const handleSaveAs = useCallback(() => {
    setSaveModalOpen(true);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderBottom: '1px solid var(--ds-border)',
        background: 'var(--ds-bg)',
      }}
    >
      {/* Row 1: URL bar (001-A) — method badge + URL + send button in a single bordered container */}
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          margin: 'var(--ds-space-3)',
          border: '1px solid var(--ds-border)',
          borderRadius: 'var(--ds-radius-1)',
          background: 'var(--ds-bg)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: 'var(--ds-space-1) var(--ds-space-2)',
            borderRight: '1px solid var(--ds-border)',
            background: 'var(--ds-surface)',
          }}
        >
          <MethodPicker value={method} onChange={(m) => setMethod(tabId, m)} />
        </div>

        <input
          type="text"
          value={displayUrl}
          onChange={(e) => {
            const val = e.target.value;
            const qIdx = val.indexOf('?');
            if (qIdx >= 0) {
              setUrl(tabId, val.slice(0, qIdx));
            } else {
              setUrl(tabId, val);
            }
          }}
          placeholder="https://example.com/path"
          aria-label="Request URL"
          style={{
            flex: 1,
            minWidth: 0,
            padding: 'var(--ds-space-2) var(--ds-space-3)',
            background: 'transparent',
            color: 'var(--ds-text)',
            border: 'none',
            outline: 'none',
            fontFamily: 'var(--ds-font-mono)',
            fontSize: 'var(--ds-text-sm)',
          }}
        />

        {sending ? (
          <SendButton loading onClick={handleCancel} title="Cancel request (Esc)">
            Cancel
          </SendButton>
        ) : (
          <SendButton
            disabled={!isValidUrl}
            onClick={handleSend}
            title={!isValidUrl ? 'Enter a valid URL to send' : 'Send request (Ctrl+Enter)'}
          >
            Send
          </SendButton>
        )}
      </div>

      {/* Row 2: Secondary toolbar — Save, Copy cURL, Diagnose */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--ds-space-1)',
          margin: '0 var(--ds-space-3) var(--ds-space-2)',
        }}
      >
        <IconButton variant="outline" onClick={handleSave} title="Save (Ctrl+S)">Save</IconButton>
        <IconButton variant="outline" onClick={handleCopyCurl} title="Copy as cURL (Ctrl+Shift+C)">Copy as cURL</IconButton>
        <IconButton variant="outline" onClick={handleDiagnose} disabled={diagnosing} title="Diagnose connection">
          {diagnosing ? 'Diagnosing…' : 'Diagnose Connection'}
        </IconButton>
      </div>

      {/* Unresolved variables warning (D-09) */}
      {unresolvedWarning && unresolvedWarning.length > 0 && (
        <div style={{
          margin: '0 var(--ds-space-3) var(--ds-space-2)',
          padding: 'var(--ds-space-2) var(--ds-space-3)',
          background: 'var(--ds-warning)',
          color: '#000',
          borderRadius: 'var(--ds-radius-1)',
          fontSize: 'var(--ds-text-xs)',
        }}>
          <strong>Warning:</strong> unresolved variables: {unresolvedWarning.map(v => `{{${v}}}`).join(', ')}
        </div>
      )}

      {/* Row 3: Vertical tab strip + active sub-tab content (002-C) */}
      <div
        style={{
          display: 'flex',
          minHeight: 240,
          maxHeight: 360,
          borderTop: '1px solid var(--ds-border)',
        }}
      >
        <VerticalTabStrip items={tabItems} activeId={activeSubTab} onChange={(id) => setActiveSubTab(id as SubTab)} minWidth={140} />
        <div style={{ flex: 1, overflow: 'auto', background: 'var(--ds-bg)' }}>
          {activeSubTab === 'Params' && <ParamsTab tabId={tabId} />}
          {activeSubTab === 'Headers' && <HeadersTab tabId={tabId} />}
          {activeSubTab === 'Body' && <BodyTab tabId={tabId} />}
          {activeSubTab === 'Auth' && <AuthTab tabId={tabId} />}
          {activeSubTab === 'Settings' && <SettingsTab tabId={tabId} />}
        </div>
      </div>

      {/* Diagnose result */}
      {diagnoseResult && (
        <div style={{
          margin: 'var(--ds-space-3)',
          padding: 'var(--ds-space-3)',
          background: 'var(--ds-surface)',
          border: '1px solid var(--ds-border)',
          borderRadius: 'var(--ds-radius-1)',
          fontSize: 'var(--ds-text-sm)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-3)', marginBottom: 'var(--ds-space-2)' }}>
            <span style={{
              background: diagnoseResult.ok ? 'var(--ds-method-get)' : 'var(--ds-method-delete)',
              color: 'white', padding: '2px 8px', borderRadius: 'var(--ds-radius-1)', fontWeight: 600, fontSize: 12,
            }}>
              {diagnoseResult.ok ? 'OK' : (diagnoseResult.error?.code || 'ERROR')}
            </span>
            <span style={{ color: 'var(--ds-text-muted)', fontFamily: 'var(--ds-font-mono)' }}>
              {diagnoseResult.target?.host}:{diagnoseResult.target?.port}
            </span>
          </div>
          {!diagnoseResult.ok && diagnoseResult.error && (
            <div style={{ color: 'var(--ds-text)' }}>{diagnoseResult.error.message}</div>
          )}
          {diagnoseResult.timing?.total > 0 && (
            <div style={{ color: 'var(--ds-text-muted)', marginTop: 4 }}>Total: {diagnoseResult.timing.total}ms</div>
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
