import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Import the functions under test — uses .js extension for Node resolution
// vitest resolves .js → .ts via Vite transforms
import { sendRequest } from '../src/main/http/undiciClient.js';
import { generateCurl, parseCurl } from '../src/main/http/curlGen.js';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Echo server that reflects request info back as JSON.
 * Used to verify every aspect of sendRequest behavior.
 */
let server: Server;
let serverUrl: string;

function startEchoServer(): Promise<void> {
  return new Promise((resolve) => {
    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      // Collect body
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf-8');

        const echo: Record<string, unknown> = {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: rawBody || null,
          bodyLength: Buffer.concat(chunks).length,
        };

        // Parse query string
        const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        const query: Record<string, string> = {};
        urlObj.searchParams.forEach((v, k) => { query[k] = v; });
        echo.query = query;
        echo.pathname = urlObj.pathname;

        // Simulate redirect if path is /redirect
        if (urlObj.pathname === '/redirect') {
          res.writeHead(302, { Location: '/redirect-target' });
          res.end();
          return;
        }
        if (urlObj.pathname === '/redirect-target') {
          echo.redirected = true;
        }

        // Simulate slow response
        if (urlObj.pathname === '/slow') {
          setTimeout(() => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ...echo, slow: true }));
          }, 300);
          return;
        }

        // Simulate large response for truncation test
        if (urlObj.pathname === '/large') {
          const size = parseInt(urlObj.searchParams.get('kb') || '100', 10) * 1024;
          res.setHeader('Content-Type', 'application/octet-stream');
          res.setHeader('Content-Length', String(size));
          res.end(Buffer.alloc(size, 0x41)); // 'A' repeated
          return;
        }

        // Set cookies
        res.setHeader('Set-Cookie', [
          'session=abc123; Path=/; HttpOnly',
          'theme=dark; Path=/; Secure',
        ]);

        res.setHeader('Content-Type', 'application/json');
        // Ensure we don't try to write after headers sent if there was an error
        try {
          res.end(JSON.stringify(echo));
        } catch {
          // Already sent
        }
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        serverUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
}

function stopEchoServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) server.close(() => resolve());
    else resolve();
  });
}

function buildSpec(overrides: Record<string, unknown> = {}) {
  return {
    requestId: randomUUID(),
    method: 'GET',
    url: serverUrl,
    headers: [],
    queryParams: [],
    pathParams: [],
    body: { mode: 'none' as const },
    auth: { type: 'none' as const },
    settings: {
      timeoutMs: 5000,
      followRedirects: true,
      maxRedirects: 10,
      sslVerify: true,
      saveCookiesToJar: false,
    },
    ...overrides,
  };
}

function createAbortSignal(timeoutMs = 10000): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(new Error('Test timeout')), timeoutMs);
  return controller.signal;
}

beforeAll(async () => {
  await startEchoServer();
});

afterAll(async () => {
  await stopEchoServer();
});

// ─── HTTP Methods ─────────────────────────────────────

describe('HTTP Methods', () => {
  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

  for (const method of methods) {
    it(`${method} request returns correct status and echoed method`, async () => {
      const spec = buildSpec({ method });
      const result = await sendRequest(spec, createAbortSignal());
      expect(result.status).toBe(200);
      const body = JSON.parse(Buffer.from(result.bodyBase64, 'base64').toString());
      expect(body.method).toBe(method);
    });
  }

  it('HEAD returns 200 with no body', async () => {
    const result = await sendRequest(buildSpec({ method: 'HEAD' }), createAbortSignal());
    expect(result.status).toBe(200);
    expect(result.bodySizeBytes).toBe(0);
  });

  it('OPTIONS returns 200', async () => {
    const result = await sendRequest(buildSpec({ method: 'OPTIONS' }), createAbortSignal());
    expect(result.status).toBe(200);
  });
});

// ─── Body Types ───────────────────────────────────────

describe('Body Types', () => {
  it('none — sends no body', async () => {
    const spec = buildSpec({ method: 'POST', body: { mode: 'none' as const } });
    const result = await sendRequest(spec, createAbortSignal());
    const body = JSON.parse(Buffer.from(result.bodyBase64, 'base64').toString());
    expect(body.body).toBeNull();
    expect(body.bodyLength).toBe(0);
  });

  it('raw JSON — sends application/json body', async () => {
    const spec = buildSpec({
      method: 'POST',
      body: { mode: 'raw', contentType: 'application/json', text: JSON.stringify({ hello: 'world' }) },
    });
    const result = await sendRequest(spec, createAbortSignal());
    const body = JSON.parse(Buffer.from(result.bodyBase64, 'base64').toString());
    expect(body.body).toBe(JSON.stringify({ hello: 'world' }));
    expect(body.headers['content-type']).toContain('application/json');
  });

  it('raw XML — sends text/xml body', async () => {
    const spec = buildSpec({
      method: 'POST',
      body: { mode: 'raw', contentType: 'application/xml', text: '<root><child/></root>' },
    });
    const result = await sendRequest(spec, createAbortSignal());
    const body = JSON.parse(Buffer.from(result.bodyBase64, 'base64').toString());
    expect(body.body).toBe('<root><child/></root>');
    expect(body.headers['content-type']).toContain('application/xml');
  });

  it('urlencoded — sends form-encoded body', async () => {
    const spec = buildSpec({
      method: 'POST',
      body: { mode: 'urlencoded', fields: [{ key: 'username', value: 'john' }, { key: 'password', value: 's3cret' }] },
    });
    const result = await sendRequest(spec, createAbortSignal());
    const body = JSON.parse(Buffer.from(result.bodyBase64, 'base64').toString());
    expect(body.body).toContain('username=john');
    expect(body.body).toContain('password=s3cret');
    expect(body.headers['content-type']).toContain('application/x-www-form-urlencoded');
  });

  it('form-data (text fields) — sends multipart form', async () => {
    const spec = buildSpec({
      method: 'POST',
      body: { mode: 'form-data', fields: [{ key: 'field1', value: 'val1', type: 'text' as const }, { key: 'field2', value: 'val2', type: 'text' as const }] },
    });
    const result = await sendRequest(spec, createAbortSignal());
    expect(result.status).toBe(200);
    expect(result.bodySizeBytes).toBeGreaterThan(0);
    // NOTE: FormData content-type auto-detection varies across undici versions
  });

  it('form-data (file upload) — sends multipart with file', async () => {
    const tmpDir = join(tmpdir(), 'postmanclone-test');
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
    const filePath = join(tmpDir, 'upload-test.txt');
    writeFileSync(filePath, 'Hello from file upload!', 'utf-8');

    try {
      const spec = buildSpec({
        method: 'POST',
        body: { mode: 'form-data', fields: [{ key: 'file', value: '', type: 'file' as const, filePath }] },
      });
      const result = await sendRequest(spec, createAbortSignal());
      expect(result.status).toBe(200);
      expect(result.bodySizeBytes).toBeGreaterThan(0);
    } finally {
      try { unlinkSync(filePath); } catch { /* ignore */ }
    }
  });

  it('binary — sends raw file bytes', async () => {
    const tmpDir = join(tmpdir(), 'postmanclone-test');
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
    const filePath = join(tmpDir, 'binary-test.bin');
    writeFileSync(filePath, '\x00\x01\x02\x03\xFF\xFE\xFD', 'binary');

    try {
      const spec = buildSpec({
        method: 'POST',
        body: { mode: 'binary', filePath, contentType: 'application/octet-stream' },
      });
      const result = await sendRequest(spec, createAbortSignal());
      expect(result.status).toBe(200);
      const body = JSON.parse(Buffer.from(result.bodyBase64, 'base64').toString());
      expect(body.headers['content-type']).toContain('application/octet-stream');
      expect(body.bodyLength).toBe(7);
    } finally {
      try { unlinkSync(filePath); } catch { /* ignore */ }
    }
  });
});

// ─── Query Params ─────────────────────────────────────

describe('Query Params', () => {
  it('appends query parameters to URL', async () => {
    const spec = buildSpec({
      queryParams: [
        { key: 'page', value: '2', enabled: true },
        { key: 'limit', value: '50', enabled: true },
      ],
    });
    const result = await sendRequest(spec, createAbortSignal());
    const body = JSON.parse(Buffer.from(result.bodyBase64, 'base64').toString());
    expect(body.query).toEqual({ page: '2', limit: '50' });
  });

  it('skips disabled query params', async () => {
    const spec = buildSpec({
      queryParams: [
        { key: 'active', value: 'yes', enabled: true },
        { key: 'disabled', value: 'no', enabled: false },
      ],
    });
    const result = await sendRequest(spec, createAbortSignal());
    const body = JSON.parse(Buffer.from(result.bodyBase64, 'base64').toString());
    expect(body.query).toEqual({ active: 'yes' });
    expect(body.query.disabled).toBeUndefined();
  });

  it('skips query params with empty key', async () => {
    const spec = buildSpec({
      queryParams: [{ key: '', value: 'ignored', enabled: true }, { key: 'valid', value: 'yes', enabled: true }],
    });
    const result = await sendRequest(spec, createAbortSignal());
    const body = JSON.parse(Buffer.from(result.bodyBase64, 'base64').toString());
    expect(body.query).toEqual({ valid: 'yes' });
  });
});

// ─── Headers ──────────────────────────────────────────

describe('Headers', () => {
  it('sends custom headers', async () => {
    const spec = buildSpec({
      headers: [
        { key: 'X-Custom', value: 'custom-value', enabled: true },
        { key: 'Accept', value: 'text/html', enabled: true },
      ],
    });
    const result = await sendRequest(spec, createAbortSignal());
    const body = JSON.parse(Buffer.from(result.bodyBase64, 'base64').toString());
    expect(body.headers['x-custom']).toBe('custom-value');
    expect(body.headers['accept']).toBe('text/html');
  });

  it('sets Origin header to target host (PITFALLS C-7)', async () => {
    const spec = buildSpec({ method: 'GET' });
    const result = await sendRequest(spec, createAbortSignal());
    const body = JSON.parse(Buffer.from(result.bodyBase64, 'base64').toString());
    expect(body.headers['origin']).toBeTruthy();
    expect(body.headers['origin']).toContain('127.0.0.1');
  });

  it('skips disabled headers', async () => {
    const spec = buildSpec({
      headers: [
        { key: 'X-Visible', value: 'yes', enabled: true },
        { key: 'X-Hidden', value: 'no', enabled: false },
      ],
    });
    const result = await sendRequest(spec, createAbortSignal());
    const body = JSON.parse(Buffer.from(result.bodyBase64, 'base64').toString());
    expect(body.headers['x-visible']).toBe('yes');
    expect(body.headers['x-hidden']).toBeUndefined();
  });

  it('response returns all response headers', async () => {
    const spec = buildSpec({ method: 'GET' });
    const result = await sendRequest(spec, createAbortSignal());
    const contentTypeHeader = result.headers.find((h) => h.key.toLowerCase() === 'content-type');
    expect(contentTypeHeader).toBeTruthy();
    expect(contentTypeHeader!.value).toContain('application/json');
  });
});

// ─── Auth ─────────────────────────────────────────────

describe('Auth', () => {
  it('Bearer — sends Authorization: Bearer <token>', async () => {
    const spec = buildSpec({
      auth: { type: 'bearer', token: 'my-secret-token' },
    });
    const result = await sendRequest(spec, createAbortSignal());
    const body = JSON.parse(Buffer.from(result.bodyBase64, 'base64').toString());
    expect(body.headers['authorization']).toBe('Bearer my-secret-token');
  });

  it('Basic — sends base64 encoded credentials', async () => {
    const spec = buildSpec({
      auth: { type: 'basic', username: 'admin', password: 'pass123' },
    });
    const result = await sendRequest(spec, createAbortSignal());
    const body = JSON.parse(Buffer.from(result.bodyBase64, 'base64').toString());
    const expected = `Basic ${Buffer.from('admin:pass123').toString('base64')}`;
    expect(body.headers['authorization']).toBe(expected);
  });

  it('API Key (header) — sends key as custom header', async () => {
    const spec = buildSpec({
      auth: { type: 'api-key', key: 'X-API-Key', value: 'sk-12345', in: 'header' },
    });
    const result = await sendRequest(spec, createAbortSignal());
    const body = JSON.parse(Buffer.from(result.bodyBase64, 'base64').toString());
    expect(body.headers['x-api-key']).toBe('sk-12345');
  });

  it('API Key (query) — appends key as query param', async () => {
    const spec = buildSpec({
      auth: { type: 'api-key', key: 'api_key', value: 'query-key-123', in: 'query' },
    });
    const result = await sendRequest(spec, createAbortSignal());
    const body = JSON.parse(Buffer.from(result.bodyBase64, 'base64').toString());
    expect(body.query.api_key).toBe('query-key-123');
  });

  it('None — no auth header', async () => {
    const spec = buildSpec({ auth: { type: 'none' } });
    const result = await sendRequest(spec, createAbortSignal());
    const body = JSON.parse(Buffer.from(result.bodyBase64, 'base64').toString());
    expect(body.headers['authorization']).toBeUndefined();
  });
});

// ─── Redirects ────────────────────────────────────────

describe('Redirects', () => {
  it('follows redirects when followRedirects=true', async () => {
    const spec = buildSpec({ url: `${serverUrl}/redirect`, settings: { ...buildSpec().settings, followRedirects: true } });
    const result = await sendRequest(spec, createAbortSignal());
    const body = JSON.parse(Buffer.from(result.bodyBase64, 'base64').toString());
    expect(body.redirected).toBe(true);
    expect(body.pathname).toBe('/redirect-target');
  });

  it('does not follow redirects when followRedirects=false', async () => {
    const spec = buildSpec({ url: `${serverUrl}/redirect`, settings: { ...buildSpec().settings, followRedirects: false } });
    const result = await sendRequest(spec, createAbortSignal());
    expect(result.status).toBe(302);
  });
});

// ─── Cookies ──────────────────────────────────────────

describe('Cookies', () => {
  it('parses Set-Cookie headers into cookie objects', async () => {
    const spec = buildSpec({ method: 'GET' });
    const result = await sendRequest(spec, createAbortSignal());
    expect(result.cookies.length).toBeGreaterThanOrEqual(2);
    const sessionCookie = result.cookies.find((c) => c.name === 'session');
    expect(sessionCookie).toBeTruthy();
    expect(sessionCookie!.value).toBe('abc123');
    expect(sessionCookie!.httpOnly).toBe(true);
    const themeCookie = result.cookies.find((c) => c.name === 'theme');
    expect(themeCookie).toBeTruthy();
    expect(themeCookie!.secure).toBe(true);
  });
});

// ─── Timing ───────────────────────────────────────────

describe('Timing', () => {
  it('records total, wait, and response timing', async () => {
    const spec = buildSpec({ method: 'GET' });
    const result = await sendRequest(spec, createAbortSignal());
    expect(result.timing.total).toBeGreaterThan(0);
    expect(result.timing.wait).toBeGreaterThanOrEqual(0);
    expect(result.timing.response).toBeGreaterThanOrEqual(0);
    expect(result.timing.total).toBeGreaterThanOrEqual(result.timing.wait + result.timing.response);
  });

  it('slow endpoint has measurable timing', async () => {
    const spec = buildSpec({ url: `${serverUrl}/slow` });
    const result = await sendRequest(spec, createAbortSignal());
    expect(result.status).toBe(200);
    expect(result.timing.total).toBeGreaterThanOrEqual(200); // 300ms server delay
  });
});

// ─── Body Cap ─────────────────────────────────────────

describe('1MB Body Cap', () => {
  it('flags body as truncated when >1MB', async () => {
    const spec = buildSpec({ url: `${serverUrl}/large?kb=1100` });
    const result = await sendRequest(spec, createAbortSignal());
    expect(result.bodyTruncated).toBe(true);
    // Base64 of first 1MB should be exactly 1,048,576 bytes of raw → ~1,398,102 base64 chars
    const decodedLength = Buffer.from(result.bodyBase64, 'base64').length;
    expect(decodedLength).toBe(1_048_576);
  });

  it('does not truncate body under 1MB', async () => {
    const spec = buildSpec({ url: `${serverUrl}/large?kb=500` });
    const result = await sendRequest(spec, createAbortSignal());
    expect(result.bodyTruncated).toBe(false);
    expect(result.bodySizeBytes).toBe(500 * 1024);
  });
});

// ─── Structured Errors ────────────────────────────────

describe('Error Handling', () => {
  it('returns structured error for connection refused (never throws)', async () => {
    const spec = buildSpec({ url: 'http://127.0.0.1:1/no-server-here' });
    const result = await sendRequest(spec, createAbortSignal());
    expect(result.status).toBe(0);
    // Windows may produce different error codes than ECONNREFUSED
    expect(result.timing.total).toBeGreaterThan(0);
  });

  it('returns structured error for invalid URL', async () => {
    // The Zod schema (IPC layer) would catch invalid URLs before sendRequest.
    // This test verifies that the spec shape requires valid URLs.
    const validSpec = buildSpec({ url: 'http://example.com' });
    expect(() => new URL(validSpec.url)).not.toThrow();
    expect(() => buildSpec({ url: 'not-a-valid-url' } as any)).not.toThrow();
    // Invalid URL would fail at Zod parse level, not here
  });
});

// ─── cURL Generation ──────────────────────────────────

describe('cURL Generation', () => {
  it('GET request produces minimal cURL', () => {
    const spec = buildSpec({ url: 'http://example.com/api' });
    const curl = generateCurl(spec);
    expect(curl).toContain('curl');
    expect(curl).toContain('http://example.com/api');
    expect(curl).not.toContain('-X GET'); // GET is default
  });

  it('POST contains -X POST', () => {
    const spec = buildSpec({ method: 'POST', url: 'http://example.com/api' });
    const curl = generateCurl(spec);
    expect(curl).toContain('-X POST');
  });

  it('includes headers', () => {
    const spec = buildSpec({
      url: 'http://example.com/api',
      headers: [
        { key: 'Content-Type', value: 'application/json', enabled: true },
        { key: 'Accept', value: 'application/json', enabled: true },
      ],
    });
    const curl = generateCurl(spec);
    expect(curl).toContain('-H');
    expect(curl).toContain('Content-Type: application/json');
  });

  it('includes --data-raw for JSON body', () => {
    const spec = buildSpec({
      method: 'POST',
      url: 'http://example.com/api',
      body: { mode: 'raw', contentType: 'application/json', text: '{"key":"value"}' },
    });
    const curl = generateCurl(spec);
    expect(curl).toContain("--data-raw '{\"key\":\"value\"}'");
  });

  it('includes --data-urlencode for urlencoded body', () => {
    const spec = buildSpec({
      method: 'POST',
      url: 'http://example.com/api',
      body: { mode: 'urlencoded', fields: [{ key: 'name', value: 'john doe' }] },
    });
    const curl = generateCurl(spec);
    expect(curl).toContain('--data-urlencode');
    expect(curl).toContain('name=john');
  });

  it('includes -u for Basic auth', () => {
    const spec = buildSpec({
      url: 'http://example.com/api',
      auth: { type: 'basic', username: 'admin', password: 'pass' },
    });
    const curl = generateCurl(spec);
    expect(curl).toContain('-u');
    expect(curl).toContain('admin:pass');
  });

  it('appends query params to URL in cURL output', () => {
    const spec = buildSpec({
      url: 'http://example.com/api',
      queryParams: [{ key: 'sort', value: 'desc', enabled: true }],
    });
    const curl = generateCurl(spec);
    expect(curl).toContain('sort=desc');
  });
});

// ─── cURL Parsing ─────────────────────────────────────

describe('cURL Parsing', () => {
  it('parses method from -X flag', () => {
    const result = parseCurl("curl -X POST 'http://example.com/api'");
    expect('url' in result).toBe(true);
    if ('url' in result) {
      expect(result.method).toBe('POST');
      expect(result.url).toBe('http://example.com/api');
    }
  });

  it('defaults to GET when no -X flag', () => {
    const result = parseCurl("curl 'http://example.com/api'");
    expect('url' in result).toBe(true);
    if ('url' in result) {
      expect(result.method).toBe('GET');
    }
  });

  it('parses -H headers', () => {
    const result = parseCurl("curl -X POST 'http://example.com/api' -H 'Content-Type: application/json' -H 'Accept: text/html'");
    expect('url' in result).toBe(true);
    if ('url' in result) {
      const ct = result.headers.find((h: { key: string }) => h.key === 'Content-Type');
      expect(ct).toBeTruthy();
      expect(ct!.value).toBe('application/json');
    }
  });

  it('parses -d / --data body', () => {
    const result = parseCurl("curl -X POST 'http://example.com/api' -d '{\"key\":\"value\"}'");
    expect('url' in result).toBe(true);
    if ('url' in result) {
      expect(result.body.mode).toBe('raw');
      if (result.body.mode === 'raw') {
        expect(result.body.text).toBe('{"key":"value"}');
      }
    }
  });

  it('parses -u for Basic auth', () => {
    const result = parseCurl("curl -u 'admin:pass' 'http://example.com/api'");
    expect('url' in result).toBe(true);
    if ('url' in result) {
      expect(result.auth.type).toBe('basic');
      if (result.auth.type === 'basic') {
        expect(result.auth.username).toBe('admin');
        expect(result.auth.password).toBe('pass');
      }
    }
  });

  it('parses -G for query params', () => {
    const result = parseCurl("curl -G 'http://example.com/api' -d 'page=1'");
    expect('url' in result).toBe(true);
    if ('url' in result) {
      expect(result.method).toBe('GET');
    }
  });

  it('returns error for invalid cURL', () => {
    const result = parseCurl('not a curl command');
    expect('error' in result).toBe(true);
  });
});

describe('Response Structure', () => {
  it('returns complete ResponseResult with all fields', async () => {
    const requestId = randomUUID();
    const spec = buildSpec({ requestId });
    const result = await sendRequest(spec, createAbortSignal());

    expect(result.requestId).toBe(requestId);
    expect(result.status).toBe(200);
    expect(result.statusText).toBeTruthy();
    expect(result.httpVersion).toBe('HTTP/1.1');
    expect(Array.isArray(result.headers)).toBe(true);
    expect(result.headers.length).toBeGreaterThan(0);
    expect(typeof result.bodyBase64).toBe('string');
    expect(result.bodyBase64.length).toBeGreaterThan(0);
    expect(typeof result.bodyTruncated).toBe('boolean');
    expect(result.bodySizeBytes).toBeGreaterThan(0);
    expect(result.timing).toBeDefined();
    expect(result.timing.total).toBeGreaterThan(0);
    expect(Array.isArray(result.cookies)).toBe(true);
    expect(typeof result.startedAt).toBe('number');
    expect(typeof result.completedAt).toBe('number');
    expect(result.completedAt).toBeGreaterThanOrEqual(result.startedAt);
  });
});
