import { fetch, Agent, ProxyAgent } from 'undici';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { RequestSpec, ResponseResult } from '../ipc/channels.js';
import { applyBasicAuth } from '../auth/basic.js';
import { applyBearerAuth } from '../auth/bearer.js';
import { applyApiKeyAuth } from '../auth/api-key.js';

/**
 * Send an HTTP request using undici with a pre-resolved RequestSpec.
 * Auth is already applied at the IPC level (variables:resolve → sendResolvedRequest).
 * This function is the post-resolution send path used by request:send after
 * variable resolution completes.
 */
export async function sendResolvedRequest(
  spec: RequestSpec,
  signal: AbortSignal
): Promise<ResponseResult> {
  return sendRequest(spec, signal);
}

/**
 * Send an HTTP request using undici with full RequestSpec support.
 *
 * Implementation follows PITFALLS M-8 (per-request isolated Agent),
 * PITFALLS C-7 (Origin header deliberately set to target host),
 * and PITFALLS m-1 (1MB body cap with bodyTruncated flag).
 *
 * v1 timing limitation: DNS/Connect/TLS are always 0.
 * Detailed breakdown requires undici's dispatch API with a custom
 * Connector — deferred to v1.1. Total, wait, and response are populated.
 */
export async function sendRequest(
  spec: RequestSpec,
  signal: AbortSignal
): Promise<ResponseResult> {
  const startedAt = Date.now();

  try {
    // 1. Build URL with query and path params
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

    // 2. Build headers
    const headers: Record<string, string> = {};
    headers['Origin'] = `${u.protocol}//${u.host}`; // PITFALLS C-7

    for (const h of spec.headers) {
      if (h.enabled && h.key) {
        headers[h.key] = h.value;
      }
    }

    // 3. Apply auth
    if (spec.auth.type === 'bearer') {
      headers['Authorization'] = `Bearer ${spec.auth.token}`;
    } else if (spec.auth.type === 'basic') {
      const encoded = Buffer.from(`${spec.auth.username}:${spec.auth.password}`).toString('base64');
      headers['Authorization'] = `Basic ${encoded}`;
    } else if (spec.auth.type === 'api-key') {
      if (spec.auth.in === 'header') {
        headers[spec.auth.key] = spec.auth.value;
      } else {
        u.searchParams.append(spec.auth.key, spec.auth.value);
        finalUrl = u.toString();
      }
    }

    // 4. Build body
    let body: BodyInit | undefined;
    const contentTypeHeader = Object.keys(headers).find(
      (k) => k.toLowerCase() === 'content-type'
    );

    if (spec.body.mode === 'none') {
      body = undefined;
    } else if (spec.body.mode === 'raw') {
      body = spec.body.text;
      if (!contentTypeHeader) {
        headers['Content-Type'] = spec.body.contentType;
      }
    } else if (spec.body.mode === 'urlencoded') {
      const params = new URLSearchParams();
      for (const f of spec.body.fields) {
        if (f.key) params.append(f.key, f.value);
      }
      body = params.toString();
      if (!contentTypeHeader) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
    } else if (spec.body.mode === 'form-data') {
      const formData = new FormData();
      for (const f of spec.body.fields) {
        if (f.type === 'text') {
          formData.append(f.key, f.value);
        } else if (f.filePath) {
          const fileBuffer = await readFile(f.filePath);
          const blob = new Blob([fileBuffer]);
          formData.append(f.key, blob, basename(f.filePath));
        }
      }
      body = formData;
      // Let Node set Content-Type with boundary automatically
    } else if (spec.body.mode === 'binary') {
      const fileBuffer = await readFile(spec.body.filePath);
      body = new Blob([fileBuffer]);
      if (!contentTypeHeader && spec.body.contentType) {
        headers['Content-Type'] = spec.body.contentType;
      }
    }

    // 5. Create per-request isolated Agent (PITFALLS M-8)
    let dispatcher: Agent | ProxyAgent;
    if (spec.proxy) {
      dispatcher = new ProxyAgent({
        uri: spec.proxy,
        requestTls: { rejectUnauthorized: spec.settings.sslVerify },
      });
    } else {
      dispatcher = new Agent({
        keepAliveTimeout: 5000,
        keepAliveMaxTimeout: 15000,
        connect: { rejectUnauthorized: spec.settings.sslVerify },
      });
    }

    // 6. Send request
    const response = await fetch(finalUrl, {
      method: spec.method,
      headers,
      body: body as any,
      signal,
      dispatcher: dispatcher as any,
      redirect: spec.settings.followRedirects ? 'follow' : 'manual',
    } as any);

    const responseStartMs = Date.now();
    const wait = responseStartMs - startedAt;

    // 7. Read response body with 1MB cap (PITFALLS m-1)
    const arrayBuffer = await response.arrayBuffer();
    const bodySizeBytes = arrayBuffer.byteLength;
    const completedAt = Date.now();
    const responseTime = completedAt - responseStartMs;
    const total = completedAt - startedAt;

    let bodyBase64: string;
    let bodyTruncated: boolean;
    if (bodySizeBytes > 1_048_576) {
      bodyTruncated = true;
      bodyBase64 = Buffer.from(arrayBuffer.slice(0, 1_048_576)).toString('base64');
    } else {
      bodyTruncated = false;
      bodyBase64 = Buffer.from(arrayBuffer).toString('base64');
    }

    // 8. Map response headers
    const respHeaders: Array<{ key: string; value: string }> = [];
    response.headers.forEach((value, key) => {
      respHeaders.push({ key, value });
    });

    // 9. Map cookies from Set-Cookie headers
    const cookies: ResponseResult['cookies'] = [];
    const setCookieHeaders = response.headers.getSetCookie?.() ?? [];
    for (const sc of setCookieHeaders) {
      const parsed = parseSetCookie(sc);
      if (parsed) cookies.push(parsed);
    }

    // 10. Close dispatcher
    try { await dispatcher.close(); } catch { /* ignore */ }

    return {
      requestId: spec.requestId,
      status: response.status,
      statusText: response.statusText,
      httpVersion: 'HTTP/1.1', // fetch doesn't expose HTTP version precisely in undici v7
      headers: respHeaders,
      bodyBase64,
      bodyTruncated,
      bodySizeBytes,
      timing: {
        dns: 0,
        connect: 0,
        tls: 0,
        request: 0, // v1: not separately measured
        wait,
        response: responseTime,
        total,
      },
      cookies,
      startedAt,
      completedAt,
    };
  } catch (err: any) {
    const total = Date.now() - startedAt;
    const isAborted = signal.aborted || err.name === 'AbortError' || err.message?.includes('aborted');
    const isTimeout = err.name === 'TimeoutError' || err.message?.includes('timed out') || err.code === 'UND_ERR_HEADERS_TIMEOUT';

    let code = 'UNKNOWN';
    let message = err.message || 'Unknown error occurred';

    if (isAborted) {
      code = signal.reason instanceof Error ? 'CANCELLED' : 'CANCELLED';
      message = signal.reason instanceof Error ? signal.reason.message : 'Request cancelled by user';
    } else if (isTimeout) {
      code = 'TIMEOUT';
      message = `Request timed out after ${spec.settings.timeoutMs}ms`;
    } else if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      code = 'NETWORK_ERROR';
      message = `Could not connect to ${spec.url}: ${err.message}`;
    } else if (err.code === 'CERT_HAS_EXPIRED' || err.message?.includes('certificate')) {
      code = 'SSL_ERROR';
      message = `SSL verification failed: ${err.message}`;
    }

    // NEVER throw raw — return structured error (PITFALLS C-7 follow-on)
    return {
      requestId: spec.requestId,
      status: 0,
      statusText: code,
      httpVersion: '',
      headers: [],
      bodyBase64: '',
      bodyTruncated: false,
      bodySizeBytes: 0,
      timing: {
        dns: 0,
        connect: 0,
        tls: 0,
        request: 0,
        wait: 0,
        response: 0,
        total,
      },
      cookies: [],
      startedAt,
      completedAt: Date.now(),
    };
  }
}

/**
 * Parse a Set-Cookie header value into a cookie object.
 */
function parseSetCookie(header: string): ResponseResult['cookies'][number] | null {
  try {
    const parts = header.split(';').map((s) => s.trim());
    const [nameValue, ...attrs] = parts;
    const eqIdx = nameValue.indexOf('=');
    if (eqIdx === -1) return null;

    const name = nameValue.slice(0, eqIdx).trim();
    const value = nameValue.slice(eqIdx + 1).trim();
    const cookie: ResponseResult['cookies'][number] = { name, value };

    for (const attr of attrs) {
      const lattr = attr.toLowerCase();
      if (lattr.startsWith('domain=')) cookie.domain = attr.slice(7);
      else if (lattr.startsWith('path=')) cookie.path = attr.slice(5);
      else if (lattr.startsWith('expires=')) cookie.expires = attr.slice(8);
      else if (lattr === 'httponly') cookie.httpOnly = true;
      else if (lattr === 'secure') cookie.secure = true;
    }

    return cookie;
  } catch {
    return null;
  }
}

/**
 * Lightweight HTTP probe for the Diagnose Connection feature.
 * Sends a GET request and returns timing info only.
 */
export async function probeRequest(
  url: string,
  timeoutMs: number,
  signal: AbortSignal
): Promise<{
  ok: boolean;
  error?: { code: string; message: string };
  timing: { dns: number; connect: number; tls: number; request: number; wait: number; response: number; total: number };
  target: { url: string; host: string; port: number };
}> {
  const startedAt = Date.now();
  const u = new URL(url);

  try {
    const agent = new Agent({
      keepAliveTimeout: 5000,
      keepAliveMaxTimeout: 15000,
    });

    const response = await fetch(url, {
      signal,
      dispatcher: agent as any,
      headers: { Origin: `${u.protocol}//${u.host}` },
    } as any);

    const total = Date.now() - startedAt;
    try { await agent.close(); } catch { /* ignore */ }

    return {
      ok: true,
      timing: { dns: 0, connect: 0, tls: 0, request: 0, wait: 0, response: 0, total },
      target: { url, host: u.hostname, port: u.port ? parseInt(u.port) : (u.protocol === 'https:' ? 443 : 80) },
    };
  } catch (err: any) {
    const total = Date.now() - startedAt;
    return {
      ok: false,
      error: { code: err.code || 'CONNECT_REFUSED', message: err.message },
      timing: { dns: 0, connect: 0, tls: 0, request: 0, wait: 0, response: 0, total },
      target: { url, host: u.hostname, port: 0 },
    };
  }
}
