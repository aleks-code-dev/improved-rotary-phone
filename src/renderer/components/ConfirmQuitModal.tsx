import { useEffect, useRef } from 'react';

interface ConfirmQuitModalProps {
  open: boolean;
  dirtyCount: number;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function ConfirmQuitModal({ open, dirtyCount, onConfirm, onDismiss }: ConfirmQuitModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      confirmRef.current?.focus();
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onDismiss();
      };
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }
  }, [open, onDismiss]);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)',
    }}>
      <div style={{
        background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-2)',
        padding: 'var(--space-6)', maxWidth: 420, width: '90%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <h3 style={{ margin: '0 0 var(--space-3)', color: 'var(--color-fg)', fontSize: 16 }}>
          You have {dirtyCount} unsaved tab{dirtyCount !== 1 ? 's' : ''}
        </h3>
        <p style={{ color: 'var(--color-fg-muted)', fontSize: 13, margin: '0 0 var(--space-5)', lineHeight: 1.5 }}>
          Quitting now will discard your unsaved changes. Are you sure?
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <button onClick={onDismiss} style={{
            padding: 'var(--space-2) var(--space-4)',
            background: 'transparent', color: 'var(--color-fg-muted)',
            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-1)',
            cursor: 'pointer', fontSize: 13,
          }}>
            Cancel
          </button>
          <button ref={confirmRef} onClick={onConfirm} style={{
            padding: 'var(--space-2) var(--space-4)',
            background: 'var(--color-method-delete)', color: 'white',
            border: 'none', borderRadius: 'var(--radius-1)',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>
            Discard and quit
          </button>
        </div>
      </div>
    </div>
  );
}
