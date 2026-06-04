import { useState, useEffect, useCallback, useRef } from 'react';
import { useTabs } from '../state/useTabs';
import { useResponse } from '../state/useResponse';
import { useKeyboardShortcuts } from '../state/useKeyboardShortcuts';
import { StatusRow } from './ResponseViewer/StatusRow';
import { ResponseBodyTab } from './ResponseViewer/BodyTab';
import { ResponseHeadersTab } from './ResponseViewer/HeadersTab';
import { ResponseCookiesTab } from './ResponseViewer/CookiesTab';
import { ResponseTimingTab } from './ResponseViewer/TimingTab';

type ViewerTab = 'body' | 'headers' | 'cookies' | 'timing';

export function ResponseViewer() {
  const activeTabId = useTabs((s) => s.activeTabId);
  const tabId = activeTabId ?? 'default';
  const response = useResponse((s) => s.responses[tabId]);
  const setResponse = useResponse((s) => s.setResponse);

  const [activeTab, setActiveTab] = useState<ViewerTab>('body');
  const [searchVisible, setSearchVisible] = useState(false);
  const searchRef = useRef<{ focus: () => void } | null>(null);
  const [sending, setSending] = useState(false);

  const state = response ?? { status: 'idle' as const };
  const result = state.status === 'done' ? state.result : undefined;

  // Listen for custom events from RequestEditor
  useEffect(() => {
    const handleReceived = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.tabId === tabId) {
        setResponse(tabId, { status: 'done', result: detail.result });
        setSending(false);
      }
    };
    const handleError = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.tabId === tabId) {
        setResponse(tabId, { status: 'error', error: detail.error });
        setSending(false);
      }
    };
    const handleCancelled = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.tabId === tabId) {
        setResponse(tabId, { status: 'cancelled' });
        setSending(false);
      }
    };

    window.addEventListener('response:received', handleReceived);
    window.addEventListener('response:error', handleError);
    window.addEventListener('response:cancelled', handleCancelled);
    // Detect send from keyboard shortcut
    window.addEventListener('request:send', () => setSending(true));

    return () => {
      window.removeEventListener('response:received', handleReceived);
      window.removeEventListener('response:error', handleError);
      window.removeEventListener('response:cancelled', handleCancelled);
      window.removeEventListener('request:send', () => setSending(true));
    };
  }, [tabId, setResponse]);

  const handleSaveToFile = useCallback(async () => {
    if (!result) return;
    const saveResult = await window.api.app.showSaveDialog({
      title: 'Save response body',
      defaultPath: 'response.txt',
      filters: [{ name: 'All Files', extensions: ['*'] }],
    });
    if (saveResult.path) {
      await window.api.app.writeFile({ path: saveResult.path, dataBase64: result.bodyBase64 });
    }
  }, [result]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSend: () => {
      setSending(true);
      window.dispatchEvent(new CustomEvent('request:send-kb', { detail: { tabId } }));
    },
    onCopyCurl: () => {
      window.dispatchEvent(new CustomEvent('curl:copy', { detail: { tabId } }));
    },
    onCancel: () => {
      window.api.request.cancel({ requestId: tabId });
    },
    onFindInBody: () => {
      setSearchVisible(!searchVisible);
      searchRef.current?.focus();
    },
    onToggleComment: () => {},
    onSave: () => {
      window.dispatchEvent(new CustomEvent('menu:save'));
    },
    onSaveAs: () => {
      window.dispatchEvent(new CustomEvent('menu:saveAs'));
    },
    isSending: sending,
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderTop: '1px solid var(--color-border)' }}>
      {/* Status row */}
      <StatusRow state={state} onSaveToFile={handleSaveToFile} />

      {/* Viewer sub-tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-border)' }}>
        {(['body', 'headers', 'cookies', 'timing'] as ViewerTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: 'var(--space-1) var(--space-3)',
              background: activeTab === tab ? 'var(--color-accent)' : 'transparent',
              color: activeTab === tab ? 'white' : 'var(--color-fg-muted)',
              border: 'none',
              borderRadius: 'var(--radius-1)',
              cursor: 'pointer',
              textTransform: 'capitalize',
              fontSize: 13,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Active tab content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'body' && result && (
          <ResponseBodyTab result={result} searchVisible={searchVisible} onSearchRef={(ref) => { searchRef.current = ref; }} />
        )}
        {activeTab === 'body' && !result && (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-fg-muted)', fontSize: 13 }}>
            {state.status === 'idle' && 'Send a request to see the response'}
            {state.status === 'sending' && 'Waiting for response…'}
            {state.status === 'error' && 'Request failed'}
            {state.status === 'cancelled' && 'Request cancelled'}
          </div>
        )}
        {activeTab === 'headers' && result && <ResponseHeadersTab result={result} />}
        {activeTab === 'headers' && !result && (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-fg-muted)', fontSize: 13 }}>
            No response headers to display
          </div>
        )}
        {activeTab === 'cookies' && result && <ResponseCookiesTab result={result} />}
        {activeTab === 'cookies' && !result && (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-fg-muted)', fontSize: 13 }}>
            No response cookies to display
          </div>
        )}
        {activeTab === 'timing' && result && <ResponseTimingTab result={result} />}
        {activeTab === 'timing' && !result && (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-fg-muted)', fontSize: 13 }}>
            No timing data to display
          </div>
        )}
      </div>
    </div>
  );
}
