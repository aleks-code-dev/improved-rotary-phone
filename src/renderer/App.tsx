import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { TabBar } from './components/TabBar';
import { RequestEditor } from './components/RequestEditor';
import { ResponseViewer } from './components/ResponseViewer';
import { StatusBar } from './components/StatusBar';
import { FirstRunDialog } from './components/FirstRunDialog';
import { ConfirmQuitModal } from './components/ConfirmQuitModal';
import { ChainEditor } from './components/Chain/ChainEditor';
import { DatabasePanel } from './components/Database/DatabasePanel';
import { Splitter } from './components/Splitter';
import { useTabs } from './state/useTabs';

export function App() {
  const [bootstrap, setBootstrap] = useState<any>(null);
  const [theme, setTheme] = useState<'system' | 'dark' | 'light'>('system');
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [activeChain, setActiveChain] = useState<{ collectionId: string; chainId: string } | null>(null);
  const [dbPanelOpen, setDbPanelOpen] = useState(false);
  const [dbPanelWidth, setDbPanelWidth] = useState<number>(() => {
    const v = Number(localStorage.getItem('pc.dbPanelWidth'));
    return Number.isFinite(v) && v >= 240 && v <= 700 ? v : 340;
  });

  useEffect(() => {
    localStorage.setItem('pc.dbPanelWidth', String(dbPanelWidth));
  }, [dbPanelWidth]);

  useEffect(() => {
    window.api.app.bootstrap().then((result) => {
      setBootstrap(result);
      setTheme(result.theme);
      applyTheme(result.theme);
      // D-21: Hydrate tabs from previous session
      if (result.savedTabs && result.savedTabs.length > 0) {
        useTabs.getState().hydrate(result.savedTabs, result.activeTabId ?? null);
      }
    });

    // D-21: Listen for app quit request
    const unsub = window.api.app.onQuitRequest(() => {
      const tabs = useTabs.getState().openTabs;
      const dirtyCount = tabs.filter((t) => t.isDirty).length;
      if (dirtyCount > 0) {
        setShowQuitModal(true);
      } else {
        window.api.app.confirmQuit({ canQuit: true });
      }
    });

    // Listen for chain:open events from sidebar
    const handleChainOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setActiveChain({ collectionId: detail.collectionId, chainId: detail.chainId });
    };
    window.addEventListener('chain:open', handleChainOpen);

    // Listen for db:toggle events from status bar
    const handleDbToggle = () => setDbPanelOpen((prev) => !prev);
    window.addEventListener('db:toggle', handleDbToggle);

    return () => {
      unsub();
      window.removeEventListener('chain:open', handleChainOpen);
      window.removeEventListener('db:toggle', handleDbToggle);
    };
  }, []);

  const handleQuitConfirm = useCallback(() => {
    setShowQuitModal(false);
    window.api.app.confirmQuit({ canQuit: true });
  }, []);

  const handleQuitDismiss = useCallback(() => {
    setShowQuitModal(false);
    window.api.app.confirmQuit({ canQuit: false });
  }, []);

  // HOOKS MUST COME BEFORE ALL CONDITIONAL RETURNS
  const dirtyCount = useTabs((s) => s.openTabs.filter((t) => t.isDirty).length);

  function applyTheme(t: 'system' | 'dark' | 'light') {
    if (t === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', t);
    }
  }

  if (!bootstrap) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary, #1e1e2e)', color: 'var(--text-primary, #cdd6f4)', fontFamily: 'system-ui, sans-serif' }}>
        <p>Starting PostmanClone...</p>
      </div>
    );
  }

  if (bootstrap.firstRun) {
    return <FirstRunDialog onConfirm={(path) => {
      window.api.app.bootstrap().then(() => window.location.reload());
    }} />;
  }

  return (
    <div className="app-shell" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <TabBar />
          {activeChain ? (
            <ChainEditor
              collectionId={activeChain.collectionId}
              chainId={activeChain.chainId}
            />
          ) : (
            <>
              <RequestEditor />
              <ResponseViewer />
            </>
          )}
        </div>
        {dbPanelOpen && (
          <>
            <Splitter
              orientation="vertical"
              onResize={(d) => setDbPanelWidth((w) => Math.max(240, Math.min(700, w - d)))}
            />
            <DatabasePanel width={dbPanelWidth} />
          </>
        )}
      </div>
      <StatusBar dbPanelOpen={dbPanelOpen} onToggleDbPanel={() => setDbPanelOpen((prev) => !prev)} />
      <ConfirmQuitModal
        open={showQuitModal}
        dirtyCount={dirtyCount}
        onConfirm={handleQuitConfirm}
        onDismiss={handleQuitDismiss}
      />
    </div>
  );
}
