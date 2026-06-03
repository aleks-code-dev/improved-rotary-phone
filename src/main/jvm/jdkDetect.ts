import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

interface JavaInfo {
  path: string;
  version: number;
}

const JAVA_HOME = process.env.JAVA_HOME;
const PATH = process.env.PATH || '';

export function findJava(): JavaInfo | null {
  const candidates: string[] = [];

  if (JAVA_HOME) {
    candidates.push(path.join(JAVA_HOME, 'bin', 'java'));
  }

  for (const p of PATH.split(process.platform === 'win32' ? ';' : ':')) {
    if (p) candidates.push(path.join(p, 'java'));
  }

  const commonPaths = process.platform === 'win32'
    ? ['C:\\Program Files\\Eclipse Adoptium\\', 'C:\\Program Files\\Java\\', 'C:\\Program Files\\Amazon Corretto\\']
    : ['/usr/lib/jvm/', '/Library/Java/JavaVirtualMachines/'];

  for (const cp of commonPaths) {
    try {
      const entries = fs.readdirSync(cp);
      for (const e of entries) {
        candidates.push(path.join(cp, e, 'bin', 'java'));
      }
    } catch {}
  }

  for (const candidate of candidates) {
    try {
      const output = execSync(`"${candidate}" -version 2>&1`, { timeout: 5000 }).toString();
      const match = output.match(/version\s+"(\d+)\./);
      if (match) {
        const version = parseInt(match[1], 10);
        if (version >= 17 && fs.existsSync(candidate)) {
          return { path: path.dirname(candidate), version };
        }
      }
    } catch {}
  }

  return null;
}