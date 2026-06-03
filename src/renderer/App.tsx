import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { RequestEditor } from './components/RequestEditor';
import { ResponseViewer } from './components/ResponseViewer';
import { StatusBar } from './components/StatusBar';
import { FirstRunDialog } from './components/FirstRunDialog';

export function App() {
  const [bootstrap, setBootstrap] = useState<any>(null);
  const [theme, setTheme] = useState<'system' | 'dark' | 'light'>('system');

  useEffect(() => {
    window.api.app.bootstrap().then((result) => {
      setBootstrap(result);
      setTheme(result.theme);
      applyTheme(result.theme);
    });
  }, []);

  function applyTheme(t: 'system' | 'dark' | 'light') {
    if (t === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', t);
    }
  }

  if (!bootstrap) return null;

  if (bootstrap.firstRun) {
    return <FirstRunDialog onConfirm={(path) => {
      window.api.app.setDataDir({ path }).then(() => window.location.reload());
    }} />;
  }

  return (
    <div className="app-shell" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <RequestEditor />
          <ResponseViewer />
        </div>
      </div>
      <StatusBar />
    </div>
  );
}