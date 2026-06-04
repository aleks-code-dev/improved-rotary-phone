import { useEffect } from 'react';

interface KeyboardShortcutsOptions {
  onSend: () => void;
  onCopyCurl: () => void;
  onCancel: () => void;
  onFindInBody: () => void;
  onToggleComment: () => void;
  isSending: boolean;
}

/**
 * Register global keyboard shortcuts.
 * D-35: Ctrl+Enter (Send), Ctrl+Shift+C (Copy as cURL),
 * Ctrl+F (Find in response), Ctrl+/ (Toggle comment), Escape (Cancel).
 */
export function useKeyboardShortcuts(opts: KeyboardShortcutsOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      // Don't intercept when focused on an input (except Ctrl+Enter for Send, Ctrl+Shift+C for Copy)
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
