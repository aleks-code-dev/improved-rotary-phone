import type { RequestSpec } from '../../shared/schemas/collection.js';

/**
 * Generate a cURL command from a RequestSpec.
 * Uses the post-variable-resolution URL when resolvedUrl is provided (D-16).
 * Produces a stable, copy-paste-ready cURL string.
 * D-16: same spec always produces the same string.
 */
export function generateCurl(spec: RequestSpec, resolvedUrl?: string): string {
  const parts: string[] = ['curl'];

  // Method
  if (spec.method !== 'GET') {
    parts.push(`-X ${spec.method}`);
  }

  // URL (use resolved URL if provided — D-16)
  const url = resolvedUrl ?? spec.url;
  const u = new URL(url);
  for (const p of spec.queryParams) {
    if (p.enabled && p.key) {
      u.searchParams.append(p.key, p.value);
    }
  }
  let finalUrl = u.toString();
  for (const p of spec.pathParams) {
    finalUrl = finalUrl.replace(`{${p.key}}`, encodeURIComponent(p.value));
  }
  parts.push(escapeShellArg(finalUrl));

  // Headers
  const headersToInclude = [...spec.headers];

  // Auth (D-16)
  if (spec.auth.type === 'bearer') {
    const token = spec.auth.token.startsWith('{"mask"')
      ? '__MASKED__'
      : spec.auth.token;
    headersToInclude.push({ key: 'Authorization', value: `Bearer ${token}`, enabled: true });
  } else if (spec.auth.type === 'basic') {
    const pass = spec.auth.password.startsWith('{"mask"')
      ? '__MASKED__'
      : spec.auth.password;
    const basicPart = `-u ${escapeShellArg(`${spec.auth.username}:${pass}`)}`;
    parts.splice(parts.length - 1, 0, basicPart);
  } else if (spec.auth.type === 'api-key' && spec.auth.in === 'header') {
    headersToInclude.push({ key: spec.auth.key, value: spec.auth.value, enabled: true });
  }

  for (const h of headersToInclude) {
    if (h.enabled && h.key) {
      if (spec.body.mode === 'form-data' && h.key.toLowerCase() === 'content-type') continue;
      parts.push(`-H ${escapeShellArg(`${h.key}: ${h.value}`)}`);
    }
  }

  // Body (D-16)
  if (spec.body.mode === 'raw' && spec.body.text) {
    parts.push(`--data-raw ${escapeShellArg(spec.body.text)}`);
  } else if (spec.body.mode === 'urlencoded') {
    for (const f of spec.body.fields) {
      if (f.key) {
        parts.push(`--data-urlencode ${escapeShellArg(`${f.key}=${f.value}`)}`);
      }
    }
  } else if (spec.body.mode === 'form-data') {
    for (const f of spec.body.fields) {
      if (f.type === 'text') {
        parts.push(`-F ${escapeShellArg(`${f.key}=${f.value}`)}`);
      } else if (f.filePath) {
        parts.push(`-F ${escapeShellArg(`${f.key}=@${f.filePath}`)}`);
      }
    }
  } else if (spec.body.mode === 'binary' && spec.body.filePath) {
    parts.push(`--data-binary ${escapeShellArg(`@${spec.body.filePath}`)}`);
  }

  return parts.join(' \\\n  ');
}

/**
 * Escape a value for use as a single-quoted shell argument.
 */
function escapeShellArg(value: string): string {
  if (!value.includes("'")) {
    return `'${value}'`;
  }
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Parse a cURL command string into a RequestSpec.
 * D-17: Handles -X, -H, -d/--data/--data-raw/--data-binary, -u, -F, -G/--get, --url,
 *       --insecure, --max-time, -L, --max-redirs.
 * Returns {ok: true, spec: RequestSpec} or {ok: false, error: string}.
 */
export function parseCurl(text: string): { ok: true; spec: RequestSpec } | { ok: false; error: string } {
  // Normalize: collapse whitespace, handle line continuations
  let input = text.replace(/\\\n/g, ' ').replace(/\\\r\n/g, ' ');
  input = input.replace(/^\s*curl\s+/i, '');

  const headers: Array<{ key: string; value: string; enabled: boolean }> = [];
  const queryParams: Array<{ key: string; value: string; enabled: boolean }> = [];
  let method = 'GET' as RequestSpec['method'];
  let url = '';
  let auth: RequestSpec['auth'] = { type: 'none' };
  let settings: RequestSpec['settings'] = {
    timeoutMs: 30_000,
    followRedirects: true,
    maxRedirects: 10,
    sslVerify: true,
    saveCookiesToJar: false,
  };

  const rawBodyParts: string[] = [];
  const formParts: Array<{ key: string; value: string; isFile: boolean }> = [];
  const urlencodedParts: Array<{ key: string; value: string }> = [];
  let isGetQueryMode = false;

  const tokens = tokenizeCurl(input);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    switch (token) {
      case '-X':
      case '--request': {
        if (i + 1 < tokens.length) {
          const m = tokens[++i].toUpperCase();
          if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(m)) {
            method = m as RequestSpec['method'];
          }
        }
        break;
      }

      case '-H':
      case '--header': {
        if (i + 1 < tokens.length) {
          const headerStr = tokens[++i];
          const colonIdx = headerStr.indexOf(':');
          if (colonIdx > 0) {
            const key = headerStr.slice(0, colonIdx).trim();
            const value = headerStr.slice(colonIdx + 1).trim();
            headers.push({ key, value, enabled: true });
          }
        }
        break;
      }

      case '-d':
      case '--data':
      case '--data-raw':
      case '--data-binary': {
        if (i + 1 < tokens.length) {
          const data = tokens[++i];
          if (isGetQueryMode) {
            const params = new URLSearchParams(data);
            params.forEach((value, key) => {
              queryParams.push({ key, value, enabled: true });
            });
          } else {
            rawBodyParts.push(data);
          }
        }
        break;
      }

      case '--data-urlencode': {
        if (i + 1 < tokens.length) {
          const data = tokens[++i];
          const eqIdx = data.indexOf('=');
          if (eqIdx > 0) {
            urlencodedParts.push({ key: data.slice(0, eqIdx), value: data.slice(eqIdx + 1) });
          }
        }
        break;
      }

      case '-u':
      case '--user': {
        if (i + 1 < tokens.length) {
          const userPass = tokens[++i];
          const colonIdx = userPass.indexOf(':');
          if (colonIdx > 0) {
            auth = {
              type: 'basic',
              username: userPass.slice(0, colonIdx),
              password: userPass.slice(colonIdx + 1),
            };
          }
        }
        break;
      }

      case '-F':
      case '--form': {
        if (i + 1 < tokens.length) {
          const formStr = tokens[++i];
          const eqIdx = formStr.indexOf('=');
          if (eqIdx > 0) {
            const key = formStr.slice(0, eqIdx);
            const value = formStr.slice(eqIdx + 1);
            const isFile = value.startsWith('@');
            formParts.push({ key, value: isFile ? value.slice(1) : value, isFile });
          }
        }
        break;
      }

      case '-G':
      case '--get': {
        isGetQueryMode = true;
        break;
      }

      case '--url': {
        if (i + 1 < tokens.length) {
          url = tokens[++i];
        }
        break;
      }

      case '--insecure': {
        settings = { ...settings, sslVerify: false };
        break;
      }

      case '--max-time': {
        if (i + 1 < tokens.length) {
          const seconds = parseFloat(tokens[++i]);
          if (!isNaN(seconds) && seconds > 0) {
            settings = { ...settings, timeoutMs: Math.round(seconds * 1000) };
          }
        }
        break;
      }

      case '-L':
      case '--location': {
        settings = { ...settings, followRedirects: true };
        break;
      }

      case '--max-redirs': {
        if (i + 1 < tokens.length) {
          const n = parseInt(tokens[++i], 10);
          if (!isNaN(n) && n >= 0) {
            settings = { ...settings, maxRedirects: n };
          }
        }
        break;
      }

      default: {
        if (isProbablyUrl(token)) {
          url = token;
        }
        break;
      }
    }
  }

  // Post-processing: determine body mode
  let body: RequestSpec['body'];
  if (formParts.length > 0) {
    body = {
      mode: 'form-data' as const,
      fields: formParts.map(f => ({
        key: f.key,
        value: f.isFile ? '' : f.value,
        type: f.isFile ? ('file' as const) : ('text' as const),
        ...(f.isFile ? { filePath: f.value } : {}),
      })),
    };
  } else if (urlencodedParts.length > 0) {
    body = {
      mode: 'urlencoded' as const,
      fields: urlencodedParts,
    };
  } else if (rawBodyParts.length > 0) {
    const ctHeader = headers.find(h => h.key.toLowerCase() === 'content-type');
    let contentType = 'application/json' as 'application/json' | 'application/xml' | 'text/plain' | 'application/graphql';
    if (ctHeader) {
      const ct = ctHeader.value.toLowerCase();
      if (ct.includes('xml')) contentType = 'application/xml';
      else if (ct.includes('graphql')) contentType = 'application/graphql';
      else if (ct.includes('text/plain')) contentType = 'text/plain';
    }
    body = { mode: 'raw' as const, contentType, text: rawBodyParts.join('&') };
    if (method === 'GET') method = 'POST';
  } else {
    body = { mode: 'none' as const };
  }

  if (!url) {
    return { ok: false, error: 'Could not parse cURL: no URL found' };
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    return { ok: false, error: `Could not parse cURL: invalid URL "${url}"` };
  }

  const spec: RequestSpec = {
    requestId: crypto.randomUUID(),
    method,
    url,
    headers,
    queryParams,
    pathParams: [],
    body,
    auth,
    settings,
  };

  return { ok: true, spec };
}

/**
 * Tokenize a cURL command string into arguments.
 */
function tokenizeCurl(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < input.length) {
    while (i < input.length && /\s/.test(input[i])) i++;
    if (i >= input.length) break;

    let token = '';

    if (input[i] === "'") {
      i++;
      while (i < input.length && input[i] !== "'") {
        token += input[i];
        i++;
      }
      if (i < input.length) i++;
      tokens.push(token);
    } else if (input[i] === '"') {
      i++;
      while (i < input.length && input[i] !== '"') {
        if (input[i] === '\\' && i + 1 < input.length) {
          token += input[i + 1];
          i += 2;
        } else {
          token += input[i];
          i++;
        }
      }
      if (i < input.length) i++;
      tokens.push(token);
    } else {
      while (i < input.length && !/\s/.test(input[i])) {
        token += input[i];
        i++;
      }
      tokens.push(token);
    }
  }

  return tokens;
}

function isProbablyUrl(token: string): boolean {
  return token.startsWith('http://') || token.startsWith('https://');
}
