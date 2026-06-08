import { spawn, ChildProcess } from 'child_process';
import log from '../logging/log.js';

export interface JsonRpcClient {
  request(method: string, params?: object): Promise<any>;
  notify(method: string, params?: object): void;
  on(method: string, handler: (params: any) => void): void;
  close(): void;
}

export class JsonRpcClientImpl implements JsonRpcClient {
  private child: ChildProcess;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();
  private handlers = new Map<string, Array<(params: any) => void>>();
  private nextId = 1;
  private writing = false;
  private writeQueue: string[] = [];
  private stdoutBuffer = '';

  constructor(child: ChildProcess) {
    this.child = child;
    child.stdout?.on('data', (chunk: Buffer) => {
      this.stdoutBuffer += chunk.toString();
      const lines = this.stdoutBuffer.split('\n');
      this.stdoutBuffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim()) this.handleLine(line);
      }
    });
    child.on('error', (err) => log.error('helper process error', err));
  }

  private handleLine(line: string) {
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        if (msg.error) reject(msg.error); else resolve(msg.result);
      } else if (msg.method && this.handlers.has(msg.method)) {
        for (const h of this.handlers.get(msg.method)!) h(msg.params);
      }
    } catch (e) {
      console.error('[jsonrpc] Failed to parse helper line:', line.substring(0, 200), 'error:', e);
    }
  }

  async request(method: string, params?: object): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params });
      console.log(`[jsonrpc] Sending request id=${id} method=${method}`);
      this.send(msg);
    });
  }

  notify(method: string, params?: object): void {
    this.send(JSON.stringify({ jsonrpc: '2.0', method, params }));
  }

  on(method: string, handler: (params: any) => void): void {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method)!.push(handler);
  }

  private send(msg: string): void {
    if (this.writing) {
      this.writeQueue.push(msg);
    } else {
      this.writing = true;
      console.log(`[jsonrpc] Writing to stdin: ${msg.substring(0, 200)}`);
      this.child.stdin?.write(msg + '\n', () => { this.writing = false; });
    }
  }

  close(): void {
    this.child.kill();
  }
}