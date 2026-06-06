import React, { useState, useRef, useEffect } from 'react';
import { StepCard } from './StepCard';

interface Step {
  stepIndex: number;
  name: string;
  request: { method: string; url: string };
}

interface StepSequenceProps {
  steps: Step[];
  selectedStepIndex: number;
  results: Map<number, any>;
  runningStepIndex: number | null;
  onSelectStep: (index: number) => void;
  onAddStep: () => void;
  onRemoveStep: (index: number) => void;
  onReRunFromStep: (index: number) => void;
}

export function StepSequence({
  steps,
  selectedStepIndex,
  results,
  runningStepIndex,
  onSelectStep,
  onAddStep,
  onRemoveStep,
  onReRunFromStep,
}: StepSequenceProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; stepIndex: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  return (
    <div style={{
      display: 'flex',
      overflowX: 'auto',
      gap: 'var(--space-1)',
      padding: 'var(--space-3) var(--space-4)',
      alignItems: 'center',
      background: 'var(--color-bg)',
      borderBottom: '1px solid var(--color-border)',
      minHeight: 80,
    }}>
      {steps.map((step, i) => (
        <React.Fragment key={step.stepIndex}>
          {i > 0 && (
            <span style={{
              color: 'var(--color-fg-muted)',
              fontSize: 18,
              padding: '0 var(--space-1)',
              flexShrink: 0,
            }}>→</span>
          )}
          <StepCard
            stepIndex={step.stepIndex}
            method={step.request?.method ?? 'GET'}
            url={step.request?.url ?? ''}
            isSelected={step.stepIndex === selectedStepIndex}
            isActive={step.stepIndex === runningStepIndex}
            result={results.get(step.stepIndex)}
            onClick={() => onSelectStep(step.stepIndex)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, stepIndex: step.stepIndex });
            }}
          />
        </React.Fragment>
      ))}

      {steps.length > 0 && (
        <span style={{
          color: 'var(--color-fg-muted)',
          fontSize: 18,
          padding: '0 var(--space-1)',
          flexShrink: 0,
        }}>→</span>
      )}

      {/* Add step button */}
      <div
        onClick={onAddStep}
        style={{
          minWidth: 150,
          flexShrink: 0,
          border: '2px dashed var(--color-border)',
          borderRadius: 'var(--radius-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: 20,
          color: 'var(--color-fg-muted)',
          minHeight: 80,
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLElement).style.borderColor = 'var(--color-step-active)';
          (e.target as HTMLElement).style.color = 'var(--color-step-active)';
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLElement).style.borderColor = 'var(--color-border)';
          (e.target as HTMLElement).style.color = 'var(--color-fg-muted)';
        }}
      >
        +
      </div>

      {steps.length === 0 && (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-fg-muted)',
          fontSize: 12,
        }}>
          Add your first step — Click '+' to add a request step to this chain.
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-2)',
            padding: 'var(--space-1) 0',
            zIndex: 1000,
            minWidth: 160,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          <ContextMenuItem label="Re-run from here" onClick={() => { onReRunFromStep(contextMenu.stepIndex); setContextMenu(null); }} />
          <ContextMenuItem label="Remove Step" onClick={() => { onRemoveStep(contextMenu.stepIndex); setContextMenu(null); }} danger />
        </div>
      )}
    </div>
  );
}

function ContextMenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: 'var(--space-1) var(--space-3)',
        fontSize: 12,
        cursor: 'pointer',
        color: danger ? 'var(--color-danger)' : 'var(--color-fg)',
      }}
      onMouseEnter={(e) => {
        (e.target as HTMLElement).style.background = 'var(--color-bg-hover, rgba(255,255,255,0.05))';
      }}
      onMouseLeave={(e) => {
        (e.target as HTMLElement).style.background = 'transparent';
      }}
    >
      {label}
    </div>
  );
}
