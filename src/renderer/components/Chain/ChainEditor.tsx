import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useChain } from '../../state/useChain';
import { useCollection } from '../../hooks/useCollections';
import { ChainHeader } from './ChainHeader';
import { StepSequence } from './StepSequence';
import { ChainRequestBuilder } from './ChainRequestBuilder';

interface ChainEditorProps {
  collectionId: string;
  chainId: string;
}

export function ChainEditor({ collectionId, chainId }: ChainEditorProps) {
  const { data: collection } = useCollection(collectionId);
  const chain = collection?.chains?.find((c: any) => c.id === chainId);
  const queryClient = useQueryClient();

  const {
    selectedStepIndex,
    isRunning,
    isStopping,
    progress,
    stepResults,
    openChain,
    selectStep,
    setRunning,
    setStopping,
    updateProgress,
    updateStepResult,
    setComplete,
    setValidationFailed,
  } = useChain();

  const unsubProgress = useRef<(() => void) | null>(null);
  const unsubStepResult = useRef<(() => void) | null>(null);
  const unsubComplete = useRef<(() => void) | null>(null);
  const unsubValidation = useRef<(() => void) | null>(null);

  // Open chain on mount
  useEffect(() => {
    openChain(collectionId, chainId);
    return () => {
      unsubProgress.current?.();
      unsubStepResult.current?.();
      unsubComplete.current?.();
      unsubValidation.current?.();
    };
  }, [collectionId, chainId]);

  // Subscribe to IPC events
  useEffect(() => {
    unsubProgress.current = window.api.chains.onProgress((data: any) => {
      if (data.chainId === chainId) updateProgress(data);
    });
    unsubStepResult.current = window.api.chains.onStepResult((data: any) => {
      if (data.chainId === chainId) updateStepResult(data);
    });
    unsubComplete.current = window.api.chains.onComplete((data: any) => {
      if (data.chainId === chainId) setComplete(data);
    });
    unsubValidation.current = window.api.chains.onValidationFailed((data: any) => {
      if (data.chainId === chainId) setValidationFailed(data);
    });

    return () => {
      unsubProgress.current?.();
      unsubStepResult.current?.();
      unsubComplete.current?.();
      unsubValidation.current?.();
    };
  }, [chainId]);

  const steps = chain?.steps ?? [];
  const selectedStep = steps.find((s: any) => s.stepIndex === selectedStepIndex) ?? steps[0];
  const runningStepIndex = progress?.stepIndex ?? null;

  // Compute prior steps with results for the info bar
  const priorStepsWithResults = steps
    .filter((s: any) => s.stepIndex < selectedStepIndex && stepResults.has(s.stepIndex))
    .map((s: any) => ({
      stepIndex: s.stepIndex,
      method: s.request?.method ?? 'GET',
      url: s.request?.url ?? '',
      status: stepResults.get(s.stepIndex)?.status ?? 0,
    }));

  const handleSave = useCallback(async () => {
    if (!chain) return;
    await window.api.chains.update({ collectionId, chainId, chain });
    queryClient.invalidateQueries({ queryKey: ['collections', collectionId] });
  }, [chain, collectionId, chainId]);

  const handleRun = useCallback(async () => {
    setRunning(true);
    try {
      await window.api.chains.run({ collectionId, chainId });
    } catch {
      setRunning(false);
    }
  }, [collectionId, chainId]);

  const handleStop = useCallback(async () => {
    setStopping(true);
    await window.api.chains.stop({ chainId });
  }, [chainId]);

  const handleAddStep = useCallback(async () => {
    if (!chain) return;
    const newStep = {
      stepIndex: chain.steps.length + 1,
      name: '',
      request: {
        requestId: crypto.randomUUID(),
        method: 'GET',
        url: '',
        headers: [],
        queryParams: [],
        pathParams: [],
        body: { mode: 'none' },
        auth: { type: 'none' },
        settings: { timeoutMs: 30000, followRedirects: true, maxRedirects: 10, sslVerify: true, saveCookiesToJar: false },
      },
      timeoutMs: 30000,
      retryCount: 0,
      retryDelayMs: 1000,
    };
    const updated = { ...chain, steps: [...chain.steps, newStep] };
    await window.api.chains.update({ collectionId, chainId, chain: updated });
    queryClient.invalidateQueries({ queryKey: ['collections', collectionId] });
  }, [chain, collectionId, chainId]);

  const handleRemoveStep = useCallback(async (stepIndex: number) => {
    if (!chain) return;
    const updated = {
      ...chain,
      steps: chain.steps
        .filter((s: any) => s.stepIndex !== stepIndex)
        .map((s: any, i: number) => ({ ...s, stepIndex: i + 1 })),
    };
    await window.api.chains.update({ collectionId, chainId, chain: updated });
    queryClient.invalidateQueries({ queryKey: ['collections', collectionId] });
    if (selectedStepIndex >= stepIndex && selectedStepIndex > 1) {
      selectStep(selectedStepIndex - 1);
    }
  }, [chain, collectionId, chainId, selectedStepIndex]);

  const handleReRunFromStep = useCallback(async (stepIndex: number) => {
    setRunning(true);
    try {
      await window.api.chains.run({ collectionId, chainId, startFromStep: stepIndex });
    } catch {
      setRunning(false);
    }
  }, [collectionId, chainId]);

  const handleStepChange = useCallback(async (updated: any) => {
    if (!chain) return;
    const updatedChain = {
      ...chain,
      steps: chain.steps.map((s: any) => s.stepIndex === updated.stepIndex ? updated : s),
    };
    await window.api.chains.update({ collectionId, chainId, chain: updatedChain });
  }, [chain, collectionId, chainId]);

  const handleNameChange = useCallback(async (name: string) => {
    if (!chain) return;
    await window.api.chains.update({ collectionId, chainId, chain: { ...chain, name } });
    queryClient.invalidateQueries({ queryKey: ['collections', collectionId] });
  }, [chain, collectionId, chainId]);

  if (!chain) {
    return <div style={{ padding: 'var(--space-4)', color: 'var(--color-fg-muted)' }}>Loading chain...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <ChainHeader
        chain={chain}
        isRunning={isRunning}
        isStopping={isStopping}
        progress={progress}
        onSave={handleSave}
        onRun={handleRun}
        onStop={handleStop}
        onNameChange={handleNameChange}
      />

      {steps.length === 0 ? (
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
      ) : (
        <>
          <StepSequence
            steps={steps}
            selectedStepIndex={selectedStepIndex}
            results={stepResults}
            runningStepIndex={runningStepIndex}
            onSelectStep={selectStep}
            onAddStep={handleAddStep}
            onRemoveStep={handleRemoveStep}
            onReRunFromStep={handleReRunFromStep}
          />

          {selectedStep && (
            <ChainRequestBuilder
              chainId={chainId}
              step={selectedStep}
              totalSteps={steps.length}
              priorStepsWithResults={priorStepsWithResults}
              onStepChange={handleStepChange}
            />
          )}
        </>
      )}
    </div>
  );
}
