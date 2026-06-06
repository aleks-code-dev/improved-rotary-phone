import jsonata from 'jsonata';
import type { RequestSpec } from '../../shared/schemas/collection.js';

interface StepRunResult {
  stepIndex: number;
  status: string;
  response?: {
    status: number;
    statusText: string;
    headers: Array<{ key: string; value: string }>;
    bodyBase64: string;
  };
  unresolvedRefs: string[];
}

interface ResolvedRequest {
  request: RequestSpec;
  warnings: Array<{ reference: string; reason: string }>;
}

const REF_REGEX = /\{\{step(\d+)\.response\.(body|headers|status)(.*?)\}\}/g;

export function resolveReferences(
  spec: RequestSpec,
  priorResults: StepRunResult[]
): ResolvedRequest {
  const warnings: Array<{ reference: string; reason: string }> = [];

  function resolveString(template: string): string {
    return template.replace(REF_REGEX, (match, stepNum, source, path) => {
      const stepIndex = parseInt(stepNum, 10);
      const result = priorResults.find(r => r.stepIndex === stepIndex);

      if (!result || !result.response) {
        warnings.push({ reference: match, reason: `Step ${stepNum} has not run` });
        return '';
      }

      try {
        let data: unknown;

        if (source === 'body') {
          const bodyStr = Buffer.from(result.response.bodyBase64, 'base64').toString('utf-8');
          data = JSON.parse(bodyStr);
        } else if (source === 'headers') {
          data = Object.fromEntries(
            result.response.headers.map(h => [h.key, h.value])
          );
        } else if (source === 'status') {
          return String(result.response.status);
        }

        const jsonataPath = path.startsWith('.') ? path.slice(1) : path;
        if (!jsonataPath) {
          return typeof data === 'string' ? data : JSON.stringify(data);
        }

        const expr = jsonata(jsonataPath);
        const value = expr.evaluate(data);

        if (value === undefined || value === null) {
          warnings.push({ reference: match, reason: `Path not found: ${jsonataPath}` });
          return '';
        }

        return typeof value === 'object' ? JSON.stringify(value) : String(value);
      } catch (err) {
        warnings.push({
          reference: match,
          reason: `JSONata error: ${err instanceof Error ? err.message : 'Unknown error'}`
        });
        return '';
      }
    });
  }

  const resolvedUrl = resolveString(spec.url);
  const resolvedHeaders = spec.headers.map(h => ({
    ...h,
    value: resolveString(h.value),
  }));

  let resolvedBody = spec.body;
  if (spec.body.mode === 'raw') {
    resolvedBody = { ...spec.body, text: resolveString(spec.body.text) };
  }

  return {
    request: {
      ...spec,
      url: resolvedUrl,
      headers: resolvedHeaders,
      body: resolvedBody,
    },
    warnings,
  };
}
