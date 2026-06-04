import { useEffect } from 'react';

interface KeyboardShortcutsOptions {
  onSend: () => void;
  onCopyCurl: () => void;
  onCancel: () => void;
  onFindInBody: () => void;
  onToggleComment: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  isSending: boolean;
}

/**
 * Register global keyboard shortcuts.
 * D-35: Full shortcut set for Phase 1.
 */
export function useKeyboardShortcuts(opts: KeyboardShortcutsOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      // Ctrl+Enter → Send (always, even in inputs)
      if (mod && e.key === 'Enter') {
        e.preventDefault();
        opts.onSend();
        return;
      }

      // Ctrl+Shift+C → Copy as cURL (always)
      if (mod && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        opts.onCopyCurl();
        return;
      }

      // Ctrl+S → Save (always)
      if (mod && !e.shiftKey && e.key === 's') {
        e.preventDefault();
        opts.onSave();
        return;
      }

      // Ctrl+Shift+S → Save As (always)
      if (mod && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        opts.onSaveAs();
        return;
      }

      // Escape → Cancel (only when sending)
      if (e.key === 'Escape' && opts.isSending) {
        e.preventDefault();
        opts.onCancel();
        return;
      }

      // Don't intercept other shortcuts when focused on input
      if (isInput) return;

      // Ctrl+F → Find in response body
      if (mod && e.key === 'f') {
        e.preventDefault();
        opts.onFindInBody();
        return;
      }

      // Ctrl+/ → Toggle comment in body editor
      if (mod && e.key === '/') {
        e.preventDefault();
        opts.onToggleComment();
        return;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [opts]);
}
