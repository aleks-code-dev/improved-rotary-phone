import type { Chain, ChainStep } from '../../shared/schemas/collection.js';

interface ValidationIssue {
  type: 'empty-url' | 'invalid-ref' | 'circular-ref' | 'invalid-step';
  message: string;
  stepIndex?: number;
}

export function validateChain(chain: Chain): { valid: boolean; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];

  // Check each step has a non-empty URL
  for (const step of chain.steps) {
    if (!step.request.url || step.request.url.trim() === '') {
      issues.push({
        type: 'empty-url',
        message: `Step ${step.stepIndex}: URL is empty`,
        stepIndex: step.stepIndex,
      });
    }
  }

  // Check all {{stepN...}} references point to existing step indices
  const refRegex = /\{\{step(\d+)\.response\./g;
  const stepIndices = new Set(chain.steps.map(s => s.stepIndex));

  for (const step of chain.steps) {
    const text = JSON.stringify(step.request);
    let match;
    while ((match = refRegex.exec(text)) !== null) {
      const targetStep = parseInt(match[1], 10);
      if (!stepIndices.has(targetStep)) {
        issues.push({
          type: 'invalid-ref',
          message: `Step ${step.stepIndex}: {{step${targetStep}...}} references non-existent step`,
          stepIndex: step.stepIndex,
        });
      }
    }
    refRegex.lastIndex = 0;
  }

  // Check no circular references via DFS
  const circularIssues = detectCircularReferences(chain.steps);
  issues.push(...circularIssues);

  return { valid: issues.length === 0, issues };
}

export function detectCircularReferences(steps: ChainStep[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const refRegex = /\{\{step(\d+)\.response\./g;

  // Build adjacency list
  const adjacency = new Map<number, Set<number>>();
  for (const step of steps) {
    adjacency.set(step.stepIndex, new Set());
    const text = JSON.stringify(step.request);
    let match;
    while ((match = refRegex.exec(text)) !== null) {
      const targetStep = parseInt(match[1], 10);
      if (targetStep !== step.stepIndex) {
        adjacency.get(step.stepIndex)!.add(targetStep);
      }
    }
    refRegex.lastIndex = 0;
  }

  // DFS with WHITE/GRAY/BLACK states
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<number, number>();
  const parent = new Map<number, number>();

  for (const step of steps) {
    color.set(step.stepIndex, WHITE);
  }

  function dfs(u: number): boolean {
    color.set(u, GRAY);
    const neighbors = adjacency.get(u) ?? new Set();

    for (const v of neighbors) {
      if (color.get(v) === GRAY) {
        const cyclePath = reconstructCycle(u, v, parent);
        issues.push({
          type: 'circular-ref',
          message: `Circular reference detected: ${cyclePath}`,
          stepIndex: u,
        });
        return true;
      }
      if (color.get(v) === WHITE) {
        parent.set(v, u);
        if (dfs(v)) return true;
      }
    }

    color.set(u, BLACK);
    return false;
  }

  for (const step of steps) {
    if (color.get(step.stepIndex) === WHITE) {
      if (dfs(step.stepIndex)) break;
    }
  }

  return issues;
}

function reconstructCycle(from: number, to: number, parent: Map<number, number>): string {
  const path: number[] = [to];
  let current = from;
  while (current !== to) {
    path.unshift(current);
    current = parent.get(current)!;
  }
  path.unshift(to);
  return path.map(i => `step${i}`).join(' → ');
}
