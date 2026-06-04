import { useState, useMemo, useCallback } from 'react';
import { useTabs } from '../state/useTabs';
import { useRequest } from '../state/useRequest';
import { MethodPicker } from './RequestEditor/MethodPicker';
import { SubTabs, type SubTab } from './RequestEditor/SubTabs';
import { ParamsTab } from './RequestEditor/ParamsTab';
import { HeadersTab } from './RequestEditor/HeadersTab';
import { BodyTab } from './RequestEditor/BodyTab';
import { AuthTab } from './RequestEditor/AuthTab';
import { SettingsTab } from './RequestEditor/SettingsTab';

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

  const method = spec?.method ?? 'GET';
  const url = spec?.url ?? '';

  const isValidUrl = useMemo(() => {
    if (!url || url.length === 0) return false;
    try { new URL(url); return true; } catch { return false; }
  }, [url]);

  const handleSend = useCallback(async () => {
    if (!isValidUrl || sending) return;
    const currentSpec = getSpec(tabId);
    const requestId = crypto.randomUUID();
    setCurrentRequestId(requestId);
    setSending(true);
    setDiagnoseResult(null);

    try {
      const result = await window.api.request.send({ ...currentSpec, requestId });
      // Dispatch custom event for ResponseViewer to pick up
      window.dispatchEvent(new CustomEvent('response:received', { detail: { tabId, result } }));
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('response:error', { detail: { tabId, error: { code: 'UNKNOWN', message: err.message } } }));
    } finally {
      setSending(false);
      setCurrentRequestId(null);
    }
  }, [isValidUrl, sending, tabId, getSpec]);

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
      const { curl } = await window.api.request.generateCurl(currentSpec);
      await navigator.clipboard.writeText(curl);
    } catch {
      // Fallback: show in UI
    }
  }, [tabId, getSpec]);

  const handleDiagnose = useCallback(async () => {
    setDiagnosing(true);
    try {
      const result = await window.api.request.diagnose();
      setDiagnoseResult(result);
    } finally {
      setDiagnosing(false);
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--color-border)', padding: 'var(--space-3)' }}>
      {/* Row 1: Toolbar */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', alignItems: 'center' }}>
        <MethodPicker value={method} onChange={(m) => setMethod(tabId, m)} />

        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(tabId, e.target.value)}
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
