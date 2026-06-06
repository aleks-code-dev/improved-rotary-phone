import React, { useEffect, useState } from 'react';

interface PreviewResolvedModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectionId: string;
  chainId: string;
  stepIndex: number;
  stepName: string;
  stepMethod: string;
  stepUrl: string;
}

export function PreviewResolvedModal({
  isOpen,
  onClose,
  collectionId,
  chainId,
  stepIndex,
  stepName,
  stepMethod,
  stepUrl,
}: PreviewResolvedModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    resolvedUrl: string;
    resolvedHeaders: Array<{ key: string; value: string }>;
    resolvedBody: string;
    warnings: Array<{ reference: string; reason: string }>;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      window.api.chains.previewResolved({ collectionId, chainId, stepIndex })
        .then(setData)
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    }
  }, [isOpen, collectionId, chainId, stepIndex]);

  useEffect(() => {
    if (isOpen) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-2)',
          width: 600,
          maxHeight: '80vh',
          overflow: 'auto',
          padding: 'var(--space-5)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Preview Resolved Body</h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-fg-muted)',
              cursor: 'pointer',
              fontSize: 18,
              padding: '0 4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Step info */}
        <div style={{ fontSize: 12, color: 'var(--color-fg-muted)', marginBottom: 'var(--space-3)' }}>
          Step {stepIndex} · {stepMethod} {stepUrl}
        </div>

        {loading ? (
          <div style={{ color: 'var(--color-fg-muted)', fontSize: 12, padding: 'var(--space-4)', textAlign: 'center' }}>
            Loading…
          </div>
        ) : data ? (
          <>
            {/* Resolved URL */}
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Resolved URL:</div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                padding: 'var(--space-2)',
                background: 'var(--color-bg)',
                borderRadius: 'var(--radius-1)',
                border: '1px solid var(--color-border)',
                wordBreak: 'break-all',
              }}>
                {data.resolvedUrl || '(empty)'}
              </div>
            </div>

            {/* Resolved Headers */}
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Resolved Headers:</div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                padding: 'var(--space-2)',
                background: 'var(--color-bg)',
                borderRadius: 'var(--radius-1)',
                border: '1px solid var(--color-border)',
              }}>
                {data.resolvedHeaders.length === 0 ? (
                  <span style={{ color: 'var(--color-fg-muted)' }}>(none)</span>
                ) : (
                  data.resolvedHeaders.map((h, i) => (
                    <div key={i}>{h.key}: {h.value}</div>
                  ))
                )}
              </div>
            </div>

            {/* Resolved Body */}
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Resolved Body:</div>
              <pre style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                padding: 'var(--space-2)',
                background: 'var(--color-bg)',
                borderRadius: 'var(--radius-1)',
                border: '1px solid var(--color-border)',
                overflow: 'auto',
                maxHeight: 300,
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {data.resolvedBody || '(empty)'}
              </pre>
            </div>

            {/* Warnings */}
            {data.warnings.length > 0 && (
              <div style={{
                background: 'rgba(251,191,36,0.1)',
                borderLeft: '3px solid var(--color-warning)',
                padding: 'var(--space-2) var(--space-3)',
                fontSize: 12,
                borderRadius: '0 var(--radius-1) var(--radius-1) 0',
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Unresolved references:</div>
                {data.warnings.map((w, i) => (
                  <div key={i} style={{ textDecoration: 'line-through', opacity: 0.7 }}>
                    {w.reference} — {w.reason}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div style={{ color: 'var(--color-fg-muted)', fontSize: 12, padding: 'var(--space-4)', textAlign: 'center' }}>
            Could not load resolved data.
          </div>
        )}

        {/* Close button */}
        <div style={{ marginTop: 'var(--space-4)', textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{
              background: 'var(--color-accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-1)',
              padding: '6px 16px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
