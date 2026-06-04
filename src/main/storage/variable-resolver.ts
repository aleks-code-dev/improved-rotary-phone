import type { RequestSpec } from '../../shared/schemas/collection.js';
import log from 'electron-log/main.js';

// D-08: 4 scope precedence — Local > Data > Env > Collection > Global
// First match wins.
export interface VariableScopes {
  local: Map<string, string>;
  data: Map<string, string>;
  env: Map<string, string>;
  collection: Map<string, string>;
  global: Map<string, string>;
  proxy?: string;
}

export interface ResolvedRequest {
  resolved: RequestSpec;
  unresolved: string[];
}

/**
 * Resolve {{name}} template variables in a RequestSpec against 4 scopes.
 * D-09: Unknown tokens remain literal and are listed in unresolved[].
 */
export function resolveVariables(spec: RequestSpec, scopes: VariableScopes): ResolvedRequest {
  const unresolvedSet = new Set<string>();

  const resolveString = (input: string): string => {
    return input.replace(/{{\s*([\w.-]+)\s*}}/g, (_match, name: string) => {
      // D-08 precedence: Local > Data > Env > Collection > Global
      const value =
        scopes.local.get(name) ??
        scopes.data.get(name) ??
        scopes.env.get(name) ??
        scopes.collection.get(name) ??
        scopes.global.get(name);

      if (value !== undefined && value !== null) {
        return value;
      }
      // D-09: unknown variable — keep literal, add to unresolved
      unresolvedSet.add(name);
      return `{{${name}}}`;
    });
  };

  // Resolve URL
  const resolvedUrl = resolveString(spec.url);

  // Resolve query params (key and value)
  const resolvedQueryParams = spec.queryParams.map(p => ({
    ...p,
    key: resolveString(p.key),
    value: resolveString(p.value),
  }));

  // Resolve path params (key and value)
  const resolvedPathParams = spec.pathParams.map(p => ({
    ...p,
    key: resolveString(p.key),
    value: resolveString(p.value),
  }));

  // Resolve headers (value only — key not resolved per Postman v2.1 convention)
  const resolvedHeaders = spec.headers.map(h => ({
    ...h,
    value: resolveString(h.value),
  }));

  // Resolve body
  let resolvedBody = spec.body;
  if (spec.body.mode === 'raw') {
    resolvedBody = {
      ...spec.body,
      text: resolveString(spec.body.text),
    };
  } else if (spec.body.mode === 'urlencoded') {
    resolvedBody = {
      ...spec.body,
      fields: spec.body.fields.map(f => ({
        ...f,
        key: resolveString(f.key),
        value: resolveString(f.value),
      })),
    };
  } else if (spec.body.mode === 'form-data') {
    resolvedBody = {
      ...spec.body,
      fields: spec.body.fields.map(f => ({
        ...f,
        key: resolveString(f.key),
        value: f.type === 'text' ? resolveString(f.value) : f.value,
      })),
    };
  }
  // binary: no resolution

  // Resolve auth credentials D-25/D-26
  let resolvedAuth = spec.auth;
  if (spec.auth.type === 'bearer') {
    resolvedAuth = {
      ...spec.auth,
      token: resolveString(spec.auth.token),
    };
  } else if (spec.auth.type === 'basic') {
    resolvedAuth = {
      ...spec.auth,
      username: resolveString(spec.auth.username),
      password: resolveString(spec.auth.password),
    };
  } else if (spec.auth.type === 'api-key') {
    resolvedAuth = {
      ...spec.auth,
      key: resolveString(spec.auth.key),
      value: resolveString(spec.auth.value),
    };
  }

  const unresolved = [...unresolvedSet];

  if (unresolved.length > 0) {
    log.warn('variables: unresolved tokens', { url: spec.url, unresolved });
  }

  return {
    resolved: {
      ...spec,
      url: resolvedUrl,
      queryParams: resolvedQueryParams,
      pathParams: resolvedPathParams,
      headers: resolvedHeaders,
      body: resolvedBody as RequestSpec['body'],
      auth: resolvedAuth as RequestSpec['auth'],
    },
    unresolved,
  };
}

/**
 * Resolve proxy from scopes (D-33).
 */
export function resolveProxy(scopes: VariableScopes): string | undefined {
  return scopes.proxy;
}
