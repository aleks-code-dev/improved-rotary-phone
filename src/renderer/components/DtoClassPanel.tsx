import React from 'react';
import { useEndpointsStore } from '../store/endpoints';

export function DtoClassPanel() {
  const selectedEndpointId = useEndpointsStore((s) => s.selectedEndpointId);
  const lastScanResult = useEndpointsStore((s) => s.lastScanResult);

  if (!selectedEndpointId || !lastScanResult) return null;

  // Find the selected endpoint
  let selectedEndpoint: any = null;
  for (const ctrl of lastScanResult.controllers) {
    const found = ctrl.endpoints.find(ep => ep.id === selectedEndpointId);
    if (found) {
      selectedEndpoint = found;
      break;
    }
  }

  if (!selectedEndpoint) return null;

  return (
    <div style={{
      padding: 'var(--space-2) 0',
      borderTop: '1px solid var(--color-border)',
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        color: 'var(--color-fg-muted)',
        letterSpacing: '0.05em',
        marginBottom: 'var(--space-2)',
      }}>
        Request Body Class
      </div>

      {selectedEndpoint.requestBodyFqn ? (
        <>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-fg)',
            marginBottom: 'var(--space-2)',
            wordBreak: 'break-all',
          }}>
            {selectedEndpoint.requestBodyFqn}
          </div>
          <div style={{
            fontSize: 11,
            color: 'var(--color-fg-muted)',
          }}>
            Full DTO body generation is available in Phase 3
          </div>
        </>
      ) : (
        <div style={{
          fontSize: 12,
          color: 'var(--color-fg-muted)',
        }}>
          No DTO class resolved for this endpoint
        </div>
      )}
    </div>
  );
}
