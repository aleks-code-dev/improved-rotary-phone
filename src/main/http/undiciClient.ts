import { fetch, Agent } from 'undici';

interface Timing {
  dns: number; connect: number; tls: number;
  request: number; wait: number; response: number; total: number;
}

interface DiagnoseResult {
  ok: boolean;
  error?: { code: string; message: string };
  timing: Timing;
  target: { url: string; host: string; port: number };
}

export async function sendRequest(
  spec: { url: string; timeoutMs?: number },
  signal: AbortSignal
): Promise<DiagnoseResult> {
  const startMs = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      try { controller.abort(); } catch {}
    }, spec.timeoutMs || 30000);

    const agent = new Agent({ keepAliveTimeout: 5000, keepAliveMaxTimeout: 15000 });
    const url = new URL(spec.url);

    const response = await fetch(spec.url, {
      signal: controller.signal,
      dispatcher: agent,
      headers: { Origin: url.protocol + '//' + url.host },
    });

    clearTimeout(timeout);
    const total = Date.now() - startMs;

    return {
      ok: true,
      timing: { dns: 0, connect: 0, tls: 0, request: 0, wait: 0, response: 0, total },
      target: { url: spec.url, host: url.hostname, port: url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80) },
    };
  } catch (err: any) {
    const total = Date.now() - startMs;
    return {
      ok: false,
      error: { code: 'CONNECT_REFUSED', message: err.message },
      timing: { dns: 0, connect: 0, tls: 0, request: 0, wait: 0, response: 0, total },
      target: { url: spec.url, host: new URL(spec.url).hostname, port: 0 },
    };
  }
}