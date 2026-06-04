import type { RequestSpec } from '../ipc/channels.js';

/**
 * Generate a cURL command from a RequestSpec.
 * Produces a stable, copy-paste-ready cURL string.
 * Uses single quotes for argument values; escapes embedded single quotes.
 */
export function generateCurl(spec: RequestSpec): string {
  const parts: string[] = ['curl'];

  // Method
  if (spec.method !== 'GET') {
    parts.push(`-X ${spec.method}`);
  }

  // URL (with query + path params merged)
  const u = new URL(spec.url);
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

  // Auth
  if (spec.auth.type === 'bearer') {
    headersToInclude.push({ key: 'Authorization', value: `Bearer ${spec.auth.token}`, enabled: true });
  } else if (spec.auth.type === 'basic') {
    // Use -u flag instead of header for Basic auth
    const basicPart = `-u ${escapeShellArg(`${spec.auth.username}:${spec.auth.password}`)}`;
    // Insert before URL
    parts.splice(parts.length - 1, 0, basicPart);
  } else if (spec.auth.type === 'api-key' && spec.auth.in === 'header') {
    headersToInclude.push({ key: spec.auth.key, value: spec.auth.value, enabled: true });
  }

  for (const h of headersToInclude) {
    if (h.enabled && h.key) {
      // Skip Content-Type for form-data (curl adds its own)
      if (spec.body.mode === 'form-data' && h.key.toLowerCase() === 'content-type') continue;
      parts.push(`-H ${escapeShellArg(`${h.key}: ${h.value}`)}`);
    }
  }

  // Body
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
 * If the value contains single quotes, escape them as '\''.
 */
function escapeShellArg(value: string): string {
  if (!value.includes("'")) {
    return `'${value}'`;
  }
  // Replace each ' with '\'' (close quote, escaped quote, open quote)
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Parse a cURL command string into a RequestSpec.
 * Supports: -X/--request, -H/--header, -d/--data/--data-raw/--data-binary,
 *           -u/--user, -F/--form, -G/--get, --url.
 * Returns RequestSpec on success, or {error: string} on unparseable input.
 */
export function parseCurl(text: string): RequestSpec | { error: string } {
  // Normalize: collapse whitespace, handle line continuations
  let input = text.replace(/\\\n/g, ' ').replace(/\\\r\n/g, ' ');
  // Remove leading "curl " if present
  input = input.replace(/^\s*curl\s+/i, '');

  const spec: RequestSpec = {
    requestId: crypto.randomUUID(),
    method: 'GET',
    url: '',
    headers: [],
    queryParams: [],
    pathParams: [],
    body: { mode: 'none' },
    auth: { type: 'none' },
    settings: {
      timeoutMs: 30_000,
      followRedirects: true,
      maxRedirects: 10,
      sslVerify: true,
      saveCookiesToJar: false,
    },
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
            spec.method = m as RequestSpec['method'];
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
            spec.headers.push({ key, value, enabled: true });
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
            // -G flag converts -d into query params
            const params = new URLSearchParams(data);
            params.forEach((value, key) => {
              spec.queryParams.push({ key, value, enabled: true });
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
            urlencodedParts.push({
              key: data.slice(0, eqIdx),
              value: data.slice(eqIdx + 1),
            });
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
            spec.auth = {
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
            formParts.push({
              key,
              value: isFile ? value.slice(1) : value,
              isFile,
            });
          }
        }
        break;
      }

      case '-G':
      case '--get': {
        isGetQueryMode = true;
        if (spec.method === 'GET') {
          // Keep GET
        }
        break;
      }

      case '--url': {
        if (i + 1 < tokens.length) {
          spec.url = tokens[++i];
        }
        break;
      }

      default: {
        // Could be a bare URL
        if (isProbablyUrl(token)) {
          spec.url = token;
        }
        break;
      }
    }
  }

  // Post-processing: determine body mode
  if (formParts.length > 0) {
    spec.body = {
      mode: 'form-data',
      fields: formParts.map((f) => ({
        key: f.key,
        value: f.isFile ? '' : f.value,
        type: f.isFile ? ('file' as const) : ('text' as const),
        ...(f.isFile ? { filePath: f.value } : {}),
      })),
    };
  } else if (urlencodedParts.length > 0) {
    spec.body = {
      mode: 'urlencoded',
      fields: urlencodedParts,
    };
  } else if (rawBodyParts.length > 0) {
    // Determine content type from headers
    const ctHeader = spec.headers.find(
      (h) => h.key.toLowerCase() === 'content-type'
    );
    let contentType = 'application/json' as 'application/json' | 'application/xml' | 'text/plain' | 'application/graphql';
    if (ctHeader) {
      const ct = ctHeader.value.toLowerCase();
      if (ct.includes('xml')) contentType = 'application/xml';
      else if (ct.includes('graphql')) contentType = 'application/graphql';
      else if (ct.includes('text/plain')) contentType = 'text/plain';
    }
    spec.body = {
      mode: 'raw' as const,
      contentType,
      text: rawBodyParts.join('&'),
    };
    // Auto-detect method from body
    if (spec.method === 'GET') {
      spec.method = 'POST';
    }
  }

  if (!spec.url) {
    return { error: 'Could not parse cURL: no URL found' };
  }

  // Validate URL
  try {
    new URL(spec.url);
  } catch {
    return { error: `Could not parse cURL: invalid URL "${spec.url}"` };
  }

  return spec;
}

/**
 * Tokenize a cURL command string into arguments.
 * Handles single-quoted, double-quoted, and unquoted arguments.
 */
function tokenizeCurl(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < input.length) {
    // Skip whitespace
    while (i < input.length && /\s/.test(input[i])) i++;
    if (i >= input.length) break;

    let token = '';

    if (input[i] === "'") {
      // Single-quoted string
      i++; // skip opening '
      while (i < input.length && input[i] !== "'") {
        token += input[i];
        i++;
      }
      if (i < input.length) i++; // skip closing '
      tokens.push(token);
    } else if (input[i] === '"') {
      // Double-quoted string
      i++; // skip opening "
      while (i < input.length && input[i] !== '"') {
        if (input[i] === '\\' && i + 1 < input.length) {
          token += input[i + 1];
          i += 2;
        } else {
          token += input[i];
          i++;
        }
      }
      if (i < input.length) i++; // skip closing "
      tokens.push(token);
    } else {
      // Unquoted argument
      while (i < input.length && !/\s/.test(input[i])) {
        token += input[i];
        i++;
      }
      tokens.push(token);
    }
  }

  return tokens;
}

/**
 * Heuristic: is this token likely a URL?
 */
function isProbablyUrl(token: string): boolean {
  return token.startsWith('http://') || token.startsWith('https://');
}
