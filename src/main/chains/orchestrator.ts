import type { BrowserWindow } from 'electron';
import type { Chain, ChainStep, StepResult } from '../../shared/schemas/collection.js';
import type { ResponseResult } from '../ipc/channels.js';
import { sendRequest } from '../http/undiciClient.js';
import { resolveReferences } from './resolver.js';
import { validateChain } from './validator.js';
import log from 'electron-log/main.js';

interface StepRunResult {
  stepIndex: number;
  status: 'success' | 'failed' | 'stopped' | 'skipped';
  response?: ResponseResult;
  error?: string;
  unresolvedRefs: string[];
  retryAttempts: number;
}

interface ChainRunResult {
  chainId: string;
  status: 'completed' | 'failed' | 'stopped';
  steps: StepRunResult[];
}

const activeChains = new Map<string, AbortController>();

export async function runChain(
  chain: Chain,
  mainWindow: BrowserWindow,
  startFromStep?: number
): Promise<ChainRunResult> {
  // Validate chain before running (D-22)
  const validation = validateChain(chain);
  if (!validation.valid) {
    mainWindow.webContents.send('chains:validationFailed', {
      chainId: chain.id,
      issues: validation.issues,
    });
    return { chainId: chain.id, status: 'failed', steps: [] };
  }

  const abortController = new AbortController();
  activeChains.set(chain.id, abortController);

  const stepResults: StepRunResult[] = [];
  const totalSteps = chain.steps.length;

  // Determine execution range (D-04: selective re-run)
  const executionStart = startFromStep ?? 1;
  const cachedResults: StepRunResult[] = [];

  // Load persisted results for steps before executionStart
  for (const step of chain.steps) {
    if (step.stepIndex < executionStart && step.lastResult) {
      cachedResults.push({
        stepIndex: step.stepIndex,
        status: 'success',
        response: {
          status: step.lastResult.status,
          statusText: step.lastResult.statusText,
          headers: step.lastResult.headers,
          bodyBase64: step.lastResult.bodyBase64,
        },
        unresolvedRefs: step.lastResult.unresolvedRefs,
        retryAttempts: step.lastResult.retryAttempts,
      });
    }
  }

  try {
    // Execute steps sequentially (D-01)
    for (let i = 0; i < chain.steps.length; i++) {
      const step = chain.steps[i];

      // Skip steps before executionStart (use cached results)
      if (step.stepIndex < executionStart) {
        stepResults.push(cachedResults.find(r => r.stepIndex === step.stepIndex) ?? {
          stepIndex: step.stepIndex,
          status: 'skipped',
          unresolvedRefs: [],
          retryAttempts: 0,
        });
        continue;
      }

      // Check abort signal (D-21: stop after current step)
      if (abortController.signal.aborted) {
        stepResults.push({
          stepIndex: step.stepIndex,
          status: 'stopped',
          unresolvedRefs: [],
          retryAttempts: 0,
        });
        // Mark remaining steps as skipped
        for (let j = i + 1; j < chain.steps.length; j++) {
          stepResults.push({
            stepIndex: chain.steps[j].stepIndex,
            status: 'skipped',
            unresolvedRefs: [],
            retryAttempts: 0,
          });
        }
        break;
      }

      // Emit progress
      mainWindow.webContents.send('chains:progress', {
        chainId: chain.id,
        stepIndex: step.stepIndex,
        totalSteps,
        status: 'running',
      });

      // Resolve references (D-13: resolve at run-time)
      const priorResults = [...cachedResults, ...stepResults];
      const resolved = resolveReferences(step.request, priorResults);

      // Execute with retry (D-02, D-23)
      let lastResult: ResponseResult | null = null;
      let attempts = 0;
      const maxAttempts = 1 + step.retryCount;

      while (attempts < maxAttempts) {
        if (abortController.signal.aborted && attempts > 0) break;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), step.timeoutMs);

        try {
          lastResult = await sendRequest(resolved.request, controller.signal);
          clearTimeout(timeout);

          if (lastResult.status >= 200 && lastResult.status < 300) {
            break; // Success, no more retries
          }

          // Non-2xx: retry if retries remaining
          attempts++;
          if (attempts < maxAttempts) {
            mainWindow.webContents.send('chains:progress', {
              chainId: chain.id,
              stepIndex: step.stepIndex,
              totalSteps,
              status: 'retrying',
              attempt: attempts,
              maxAttempts: step.retryCount,
            });
            await delay(step.retryDelayMs);
          }
        } catch (err) {
          clearTimeout(timeout);
          attempts++;
          if (attempts < maxAttempts) {
            await delay(step.retryDelayMs);
          }
        }
      }

      // Build step result
      const stepResult: StepRunResult = {
        stepIndex: step.stepIndex,
        status: lastResult && lastResult.status >= 200 && lastResult.status < 300
          ? 'success' : 'failed',
        response: lastResult ?? undefined,
        error: lastResult ? undefined : 'Request failed',
        unresolvedRefs: resolved.warnings.map(w => w.reference),
        retryAttempts: attempts - 1,
      };

      stepResults.push(stepResult);

      // Emit step completion
      mainWindow.webContents.send('chains:stepResult', {
        chainId: chain.id,
        stepIndex: step.stepIndex,
        result: stepResult,
      });

      // Halt chain on failure (D-03)
      if (stepResult.status === 'failed') {
        // Mark remaining steps as skipped
        for (let j = i + 1; j < chain.steps.length; j++) {
          stepResults.push({
            stepIndex: chain.steps[j].stepIndex,
            status: 'skipped',
            unresolvedRefs: [],
            retryAttempts: 0,
          });
        }
        break;
      }
    }

    // Determine overall status
    const overallStatus = stepResults.some(s => s.status === 'failed') ? 'failed'
      : stepResults.some(s => s.status === 'stopped') ? 'stopped'
      : 'completed';

    mainWindow.webContents.send('chains:complete', {
      chainId: chain.id,
      status: overallStatus,
    });

    return { chainId: chain.id, status: overallStatus, steps: stepResults };
  } finally {
    activeChains.delete(chain.id);
  }
}

export function stopChain(chainId: string): void {
  const controller = activeChains.get(chainId);
  if (controller) {
    controller.abort();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
