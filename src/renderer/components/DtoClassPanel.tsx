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
      padding: 'var(--ds-space-2) 0',
      borderTop: '1px solid var(--ds-border)',
    }}>
      <div style={{
        fontSize: 'var(--ds-text-xs)',
        fontWeight: 600,
        textTransform: 'uppercase',
        color: 'var(--ds-text-muted)',
        letterSpacing: '0.05em',
        marginBottom: 'var(--ds-space-2)',
      }}>
        Request Body Class
      </div>

      {selectedEndpoint.requestBodyFqn ? (
        <>
          <div style={{
            fontFamily: 'var(--ds-font-mono)',
            fontSize: 'var(--ds-text-sm)',
            fontWeight: 600,
            color: 'var(--ds-text)',
            marginBottom: 'var(--ds-space-2)',
            wordBreak: 'break-all',
          }}>
            {selectedEndpoint.requestBodyFqn}
          </div>
          <div style={{
            fontSize: 'var(--ds-text-xs)',
            color: 'var(--ds-text-muted)',
          }}>
            Full DTO body generation is available in Phase 3
          </div>
        </>
      ) : (
        <div style={{
          fontSize: 'var(--ds-text-sm)',
          color: 'var(--ds-text-muted)',
        }}>
          No DTO class resolved for this endpoint
        </div>
      )}
    </div>
  );
}
