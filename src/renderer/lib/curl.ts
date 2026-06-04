/**
 * Client-side cURL parser for the "Import cURL" modal preview.
 * Mirrors `src/main/http/curlGen.ts` parseCurl().
 * Both should produce equivalent results.
 */

export interface RequestSpec {
  requestId: string;
  method: string;
  url: string;
  headers: Array<{ key: string; value: string; enabled: boolean }>;
  queryParams: Array<{ key: string; value: string; enabled: boolean }>;
  pathParams: Array<{ key: string; value: string }>;
  body: { mode: 'none' } | { mode: 'raw'; contentType: string; text: string } | { mode: 'urlencoded'; fields: Array<{ key: string; value: string }> } | { mode: 'form-data'; fields: Array<{ key: string; value: string; type: 'text' | 'file'; filePath?: string }> } | { mode: 'binary'; filePath: string; contentType: string };
  auth: { type: 'none' } | { type: 'bearer'; token: string } | { type: 'basic'; username: string; password: string } | { type: 'api-key'; key: string; value: string; in: 'header' | 'query' };
  settings: { timeoutMs: number; followRedirects: boolean; maxRedirects: number; sslVerify: boolean; saveCookiesToJar: boolean };
  proxy?: string;
}

export function parseCurl(text: string): RequestSpec | { error: string } {
  let input = text.replace(/\\\n/g, ' ').replace(/\\\r\n/g, ' ');
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
    settings: { timeoutMs: 30000, followRedirects: true, maxRedirects: 10, sslVerify: true, saveCookiesToJar: false },
  };

  const rawBodyParts: string[] = [];
  const formParts: Array<{ key: string; value: string; isFile: boolean }> = [];
  const urlencodedParts: Array<{ key: string; value: string }> = [];
  let isGetQueryMode = false;

  const tokens = tokenizeCurl(input);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    switch (token) {
      case '-X': case '--request': {
        if (i + 1 < tokens.length) {
          const m = tokens[++i].toUpperCase();
          if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(m)) spec.method = m;
        }
        break;
      }
      case '-H': case '--header': {
        if (i + 1 < tokens.length) {
          const hs = tokens[++i];
          const ci = hs.indexOf(':');
          if (ci > 0) spec.headers.push({ key: hs.slice(0, ci).trim(), value: hs.slice(ci + 1).trim(), enabled: true });
        }
        break;
      }
      case '-d': case '--data': case '--data-raw': case '--data-binary': {
        if (i + 1 < tokens.length) {
          const data = tokens[++i];
          if (isGetQueryMode) {
            try { new URLSearchParams(data).forEach((v, k) => spec.queryParams.push({ key: k, value: v, enabled: true })); } catch { /* ignore */ }
          } else {
            rawBodyParts.push(data);
          }
        }
        break;
      }
      case '--data-urlencode': {
        if (i + 1 < tokens.length) {
          const data = tokens[++i];
          const ei = data.indexOf('=');
          if (ei > 0) urlencodedParts.push({ key: data.slice(0, ei), value: data.slice(ei + 1) });
        }
        break;
      }
      case '-u': case '--user': {
        if (i + 1 < tokens.length) {
          const up = tokens[++i];
          const ci = up.indexOf(':');
          if (ci > 0) spec.auth = { type: 'basic', username: up.slice(0, ci), password: up.slice(ci + 1) };
        }
        break;
      }
      case '-F': case '--form': {
        if (i + 1 < tokens.length) {
          const fs = tokens[++i];
          const ei = fs.indexOf('=');
          if (ei > 0) {
            const k = fs.slice(0, ei);
            const v = fs.slice(ei + 1);
            formParts.push({ key: k, value: v.startsWith('@') ? v.slice(1) : v, isFile: v.startsWith('@') });
          }
        }
        break;
      }
      case '-G': case '--get': isGetQueryMode = true; break;
      case '--url': if (i + 1 < tokens.length) spec.url = tokens[++i]; break;
      default: if (/^https?:\/\//.test(token)) spec.url = token; break;
    }
  }

  if (formParts.length > 0) {
    spec.body = { mode: 'form-data', fields: formParts.map(f => ({ key: f.key, value: f.isFile ? '' : f.value, type: f.isFile ? 'file' as const : 'text' as const, ...(f.isFile ? { filePath: f.value } : {}) })) };
  } else if (urlencodedParts.length > 0) {
    spec.body = { mode: 'urlencoded', fields: urlencodedParts };
  } else if (rawBodyParts.length > 0) {
    let ct: string = 'application/json';
    const cth = spec.headers.find(h => h.key.toLowerCase() === 'content-type');
    if (cth) {
      const c = cth.value.toLowerCase();
      if (c.includes('xml')) ct = 'application/xml';
      else if (c.includes('graphql')) ct = 'application/graphql';
      else if (c.includes('text/plain')) ct = 'text/plain';
    }
    spec.body = { mode: 'raw', contentType: ct, text: rawBodyParts.join('&') };
    if (spec.method === 'GET') spec.method = 'POST';
  }

  if (!spec.url) return { error: 'Could not parse cURL: no URL found' };
  try { new URL(spec.url); } catch { return { error: `Could not parse cURL: invalid URL "${spec.url}"` }; }
  return spec;
}

function tokenizeCurl(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < input.length) {
    while (i < input.length && /\s/.test(input[i])) i++;
    if (i >= input.length) break;
    let token = '';
    if (input[i] === "'") { i++; while (i < input.length && input[i] !== "'") token += input[i++]; if (i < input.length) i++; tokens.push(token); }
    else if (input[i] === '"') { i++; while (i < input.length && input[i] !== '"') { if (input[i] === '\\' && i + 1 < input.length) { token += input[++i]; i++; } else { token += input[i++]; } } if (i < input.length) i++; tokens.push(token); }
    else { while (i < input.length && !/\s/.test(input[i])) token += input[i++]; tokens.push(token); }
  }
  return tokens;
}
