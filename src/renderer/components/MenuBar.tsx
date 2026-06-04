import { useEffect } from 'react';
import { useTabs } from '../state/useTabs';

/**
 * MenuBar component that listens for menu events dispatched from the main process
 * and maps them to renderer actions.
 *
 * The main process sets the Electron Menu with File/View/Help items.
 * Each item sends an IPC event to the renderer via webContents.send.
 */
export function MenuBar() {
  const addTab = useTabs((s) => s.addTab);

  useEffect(() => {
    const handler = (e: Event) => {
      const action = (e as CustomEvent).detail?.action;
      switch (action) {
        case 'new-request':
          addTab();
          break;
        case 'save':
          window.dispatchEvent(new CustomEvent('menu:save'));
          break;
        case 'save-as':
          window.dispatchEvent(new CustomEvent('menu:saveAs'));
          break;
        case 'import-curl':
          window.dispatchEvent(new CustomEvent('menu:importCurl'));
          break;
        case 'import-postman':
          window.dispatchEvent(new CustomEvent('menu:importPostman'));
          break;
        case 'export-collection':
          window.dispatchEvent(new CustomEvent('menu:exportCollection'));
          break;
        case 'toggle-sidebar':
          window.dispatchEvent(new CustomEvent('menu:toggleSidebar'));
          break;
        case 'open-settings':
          window.dispatchEvent(new CustomEvent('menu:openSettings'));
          break;
        case 'open-logs':
          window.dispatchEvent(new CustomEvent('menu:openLogs'));
          break;
      }
    };

    window.addEventListener('menu:action', handler);
    return () => window.removeEventListener('menu:action', handler);
  }, [addTab]);

  // This is a logic-only component — no visible UI
  return null;
}
