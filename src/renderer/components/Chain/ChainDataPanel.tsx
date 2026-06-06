import React, { useState } from 'react';
import { ChainStepColumn } from './ChainStepColumn';

interface ChainStep {
  stepIndex: number;
  name: string;
  request: { method: string; url: string };
}

interface ChainDataPanelProps {
  steps: ChainStep[];
  selectedStepIndex: number;
  stepResults: Map<number, any>;
}

export function ChainDataPanel({ steps, selectedStepIndex, stepResults }: ChainDataPanelProps) {
  const [isOpen, setIsOpen] = useState(() => {
    // Default open when selected step has prior steps with data
    return steps.some(s => s.stepIndex < selectedStepIndex && stepResults.has(s.stepIndex));
  });

  const priorSteps = steps.filter(s => s.stepIndex < selectedStepIndex && stepResults.has(s.stepIndex));
  const availableCount = priorSteps.length;

  return (
    <div style={{
      marginTop: 'var(--space-3)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-2)',
      background: 'var(--color-bg-elevated)',
    }}>
      {/* Panel header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-3)',
          cursor: 'pointer',
          borderBottom: isOpen ? '1px solid var(--color-border)' : 'none',
        }}
      >
        <span style={{
          fontSize: 10,
          transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
          display: 'inline-block',
        }}>▶</span>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Previous Step Responses</span>
        {availableCount > 0 && (
          <span style={{ fontSize: 10, color: 'var(--color-fg-muted)' }}>
            {availableCount} step{availableCount !== 1 ? 's' : ''} available
          </span>
        )}
      </div>

      {/* Panel content */}
      {isOpen && (
        <div style={{
          padding: 'var(--space-3)',
          overflowX: 'auto',
        }}>
          {priorSteps.length === 0 ? (
            <div style={{
              color: 'var(--color-fg-muted)',
              fontSize: 12,
              textAlign: 'center',
              padding: 'var(--space-4)',
            }}>
              No previous step data — Run earlier steps to populate data for reference expressions.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              {priorSteps.map(step => {
                const result = stepResults.get(step.stepIndex);
                if (!result?.response) return null;
                return (
                  <ChainStepColumn
                    key={step.stepIndex}
                    stepIndex={step.stepIndex}
                    method={step.request?.method ?? 'GET'}
                    url={step.request?.url ?? ''}
                    result={result.response}
                    onCopyPath={(path) => navigator.clipboard.writeText(path)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
