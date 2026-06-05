import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'node:fs';
import path from 'path';
import log from '../logging/log.js';
import { findJava } from './jdkDetect.js';
import { getBundledHelperJarPath, getHelperJarPath, getLogsDir } from '../storage/paths.js';
import { JsonRpcClientImpl } from './client.js';
import type { HelperStatus } from '../ipc/channels.js';

const BACKOFF_STEPS = [1000, 2000, 4000, 8000, 16000, 30000];
const MAX_RESTARTS = 3;
const WINDOW_MS = 60000;

export class Supervisor extends EventEmitter {
  private client: JsonRpcClientImpl | null = null;
  private child: ChildProcess | null = null;
  private status: HelperStatus = { state: 'starting' };
  private restartCount = 0;
  private restartWindow: number[] = [];
  private restartTimeout: ReturnType<typeof setTimeout> | null = null;
  private manualRestartRequired = false;

  on(event: 'status', listener: (status: HelperStatus) => void): this {
    return super.on(event, listener);
  }

  getStatus(): HelperStatus {
    return this.status;
  }

  getClient(): JsonRpcClientImpl | null {
    return this.client;
  }

  async init(): Promise<void> {
    const jdk = findJava();
    if (!jdk) {
      this.setStatus({ state: 'offline', reason: 'JDK not found', since: Date.now() });
      return;
    }

    const jarPath = getHelperJarPath();
    const bundledJar = getBundledHelperJarPath();

    const fs = await import('node:fs');
    if (fs.existsSync(bundledJar)) {
      const dir = path.dirname(jarPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(bundledJar, jarPath);
    }

    this.spawnHelper();
  }

  private spawnHelper(): void {
    const jdk = findJava();
    if (!jdk) {
      this.setStatus({ state: 'offline', reason: 'JDK not found', since: Date.now() });
      return;
    }
    const jarPath = getHelperJarPath();

    this.setStatus({ state: 'starting' });

    try {
      this.child = spawn(jdk.path, ['-jar', jarPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });

      if (this.child.stderr) {
        const helperLogPath = path.join(getLogsDir(), 'helper.log');
        const helperLogStream = fs.createWriteStream(helperLogPath, { flags: 'a' });
        this.child.stderr.pipe(helperLogStream);
      }

      this.client = new JsonRpcClientImpl(this.child);

      this.client.request('initialize').then((result: any) => {
        this.setStatus({ state: 'healthy', pid: this.child!.pid!, version: result.version });
        this.restartCount = 0;
        this.restartWindow = [];
      }).catch((err) => {
        log.error('helper initialize failed', err);
        this.handleCrash('initialize failed');
      });

      this.child.on('exit', (code) => {
        if (!this.manualRestartRequired) {
          this.handleCrash(`helper exited with code ${code}`);
        }
      });
    } catch (err: any) {
      this.setStatus({ state: 'offline', reason: err.message, since: Date.now() });
    }
  }

  private handleCrash(reason: string): void {
    this.restartWindow.push(Date.now());
    this.restartWindow = this.restartWindow.filter(t => t > Date.now() - WINDOW_MS);

    if (this.restartWindow.length >= MAX_RESTARTS) {
      this.setStatus({ state: 'offline', reason, since: Date.now() });
      this.manualRestartRequired = true;
      return;
    }

    const delay = BACKOFF_STEPS[Math.min(this.restartCount, BACKOFF_STEPS.length - 1)];
    this.restartCount++;
    this.setStatus({ state: 'restarting', attempt: this.restartCount, nextInMs: delay });

    this.restartTimeout = setTimeout(() => {
      if (!this.manualRestartRequired) this.spawnHelper();
    }, delay);
  }

  async restart(): Promise<HelperStatus> {
    this.manualRestartRequired = false;
    this.restartCount = 0;
    this.restartWindow = [];
    if (this.child) { this.child.kill(); this.child = null; }
    if (this.restartTimeout) { clearTimeout(this.restartTimeout); this.restartTimeout = null; }
    this.spawnHelper();
    return this.status;
  }

  shutdown(): void {
    this.manualRestartRequired = true;
    this.client?.notify('shutdown');
    setTimeout(() => { this.child?.kill(); }, 1000);
  }

  private setStatus(status: HelperStatus): void {
    this.status = status;
    this.emit('status', status);
  }
}

const supervisor = new Supervisor();

export async function restartHelper(): Promise<HelperStatus> {
  return supervisor.restart();
}

export function getHelperStatus(): HelperStatus {
  return supervisor.getStatus();
}

export { supervisor };
