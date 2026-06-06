import React, { useEffect } from 'react';
import { useRequest } from '../../state/useRequest';
import { MethodPicker } from '../RequestEditor/MethodPicker';
import { SubTabs, type SubTab } from '../RequestEditor/SubTabs';
import { BodyTab } from '../RequestEditor/BodyTab';
import { HeadersTab } from '../RequestEditor/HeadersTab';
import { AuthTab } from '../RequestEditor/AuthTab';
import { SettingsTab } from '../RequestEditor/SettingsTab';
import { ParamsTab } from '../RequestEditor/ParamsTab';
import { useState } from 'react';

interface ChainStep {
  stepIndex: number;
  name: string;
  request: {
    requestId: string;
    method: string;
    url: string;
    headers: Array<{ key: string; value: string; enabled: boolean }>;
    queryParams: Array<{ key: string; value: string; enabled: boolean }>;
    pathParams: Array<{ key: string; value: string }>;
    body: any;
    auth: any;
    settings: any;
  };
}

interface ChainRequestBuilderProps {
  chainId: string;
  step: ChainStep;
  totalSteps: number;
  priorStepsWithResults: Array<{ stepIndex: number; method: string; url: string; status: number }>;
  onStepChange: (updated: ChainStep) => void;
}

export function ChainRequestBuilder({ chainId, step, totalSteps, priorStepsWithResults, onStepChange }: ChainRequestBuilderProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('Params');
  const tabId = `chain-${chainId}-${step.stepIndex}`;
  const spec = useRequest((s) => s.specs[tabId]);
  const setMethod = useRequest((s) => s.setMethod);
  const setUrl = useRequest((s) => s.setUrl);

  // Load step's request spec into the store on mount / step change
  useEffect(() => {
    const req = step.request;
    useRequest.getState().setSpec(tabId, {
      requestId: req.requestId || crypto.randomUUID(),
      method: req.method,
      url: req.url,
      headers: req.headers ?? [],
      queryParams: req.queryParams ?? [],
      pathParams: req.pathParams ?? [],
      body: req.body ?? { mode: 'none' },
      auth: req.auth ?? { type: 'none' },
      settings: req.settings ?? { timeoutMs: 30000, followRedirects: true, maxRedirects: 10, sslVerify: true, saveCookiesToJar: false },
    });
  }, [chainId, step.stepIndex]);

  // Sync method/url changes back to the chain step
  const handleMethodChange = (newMethod: string) => {
    setMethod(tabId, newMethod);
    onStepChange({ ...step, request: { ...step.request, method: newMethod } });
  };

  const handleUrlChange = (newUrl: string) => {
    setUrl(tabId, newUrl);
    onStepChange({ ...step, request: { ...step.request, url: newUrl } });
  };

  const method = spec?.method ?? step.request?.method ?? 'GET';
  const url = spec?.url ?? step.request?.url ?? '';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Chain context info bar */}
      <div style={{
        fontSize: 10,
        fontFamily: 'var(--font-mono)',
        color: 'var(--color-fg-muted)',
        padding: 'var(--space-1) var(--space-3)',
        background: 'var(--color-chain-bar-bg)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        Step {step.stepIndex} of {totalSteps}
        {priorStepsWithResults.length > 0 && (
          <span> · Available references: {priorStepsWithResults.map(p =>
            `step${p.stepIndex} (${p.method} ${p.url} ✓ ${p.status})`
          ).join(', ')}</span>
        )}
        {priorStepsWithResults.length === 0 && (
          <span> · No previous step data available — run earlier steps first.</span>
        )}
      </div>

      {/* Method + URL bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: 'var(--space-2) var(--space-3)',
        gap: 'var(--space-2)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <MethodPicker value={method} onChange={handleMethodChange} />
        <input
          value={url}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="Enter request URL or paste cURL"
          style={{
            flex: 1,
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            padding: 'var(--space-1) var(--space-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-1)',
            background: 'var(--color-bg)',
            color: 'var(--color-fg)',
            outline: 'none',
          }}
        />
      </div>

      {/* Sub tabs */}
      <SubTabs active={activeSubTab} onChange={setActiveSubTab} />

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-3)' }}>
        {activeSubTab === 'Params' && <ParamsTab tabId={tabId} />}
        {activeSubTab === 'Headers' && <HeadersTab tabId={tabId} />}
        {activeSubTab === 'Body' && <BodyTab tabId={tabId} />}
        {activeSubTab === 'Auth' && <AuthTab tabId={tabId} />}
        {activeSubTab === 'Settings' && <SettingsTab tabId={tabId} />}
      </div>
    </div>
  );
}
