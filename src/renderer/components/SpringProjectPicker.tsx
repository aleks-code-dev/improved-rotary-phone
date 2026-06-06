import React from 'react';
import { useEndpointsScan } from '../hooks/useEndpoints';

export function SpringProjectPicker() {
  const scanMutation = useEndpointsScan();

  const handleSelectProject = async () => {
    const result = await window.api.app.showOpenDialog({
      kind: 'folder',
      title: 'Select Spring Project',
    });
    if (result.path) {
      scanMutation.mutate(result.path);
    }
  };

  return (
    <div style={{ padding: 'var(--space-2)' }}>
      <button
        onClick={handleSelectProject}
        disabled={scanMutation.isPending}
        style={{
          width: '100%',
          background: 'var(--color-accent)',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius-1)',
          padding: 'var(--space-1) var(--space-3)',
          fontSize: 12,
          fontWeight: 600,
          cursor: scanMutation.isPending ? 'not-allowed' : 'pointer',
          opacity: scanMutation.isPending ? 0.7 : 1,
          marginBottom: 'var(--space-3)',
        }}
      >
        {scanMutation.isPending ? 'Scanning...' : 'Select Spring Project'}
      </button>

      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--color-fg)',
        marginBottom: 'var(--space-2)',
      }}>
        Select a Spring project
      </div>

      <div style={{
        fontSize: 12,
        color: 'var(--color-fg-muted)',
        lineHeight: 1.5,
      }}>
        Open a local Spring Boot project to auto-detect every @RestController endpoint. No manual spec authoring required.
      </div>
    </div>
  );
}
