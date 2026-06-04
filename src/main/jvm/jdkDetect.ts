import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

interface JavaInfo {
  path: string;
  version: number;
}

const isWindows = process.platform === 'win32';

function execVersion(javaExe: string): { major: number; raw: string } | null {
  try {
    const output = execSync(`"${javaExe}" -version 2>&1`, {
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).toString();
    const match = output.match(/version\s+"(\d+)\./);
    if (!match) return null;
    return { major: parseInt(match[1], 10), raw: output };
  } catch {
    return null;
  }
}

function fileExists(p: string): boolean {
  try { return fs.existsSync(p); } catch { return false; }
}

function userHomeScoop(): string {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  if (!home) return '';
  return path.join(home, 'scoop', 'apps');
}

export function findJava(): JavaInfo | null {
  const exe = isWindows ? 'java.exe' : 'java';
  const candidates: string[] = [];

  if (process.env.JAVA_HOME) {
    candidates.push(path.join(process.env.JAVA_HOME, 'bin', exe));
  }

  if (process.env.PATH) {
    for (const p of process.env.PATH.split(isWindows ? ';' : ':')) {
      if (p) candidates.push(path.join(p, exe));
    }
  }

  try {
    const which = isWindows ? 'where' : 'which';
    const out = execSync(`${which} ${exe}`, {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    for (const line of out.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed) candidates.push(trimmed);
    }
  } catch {}

  if (isWindows) {
    candidates.push('C:\\Program Files\\Eclipse Adoptium\\' + exe);
    candidates.push('C:\\Program Files\\Java\\' + exe);
    candidates.push('C:\\Program Files\\Amazon Corretto\\' + exe);

    const scoopRoot = userHomeScoop();
    if (scoopRoot) {
      try {
        for (const app of fs.readdirSync(scoopRoot)) {
          if (/^openjdk/i.test(app) || /^temurin/i.test(app) || /^corretto/i.test(app)) {
            candidates.push(path.join(scoopRoot, app, 'current', 'bin', exe));
            const verDirs = fs.readdirSync(path.join(scoopRoot, app)).filter(d => d !== 'current');
            for (const v of verDirs) {
              candidates.push(path.join(scoopRoot, app, v, 'bin', exe));
            }
          }
        }
      } catch {}
    }

    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    for (const base of [programFiles, programFilesX86]) {
      try {
        for (const d of fs.readdirSync(base)) {
          if (/jdk|jre|java/i.test(d)) {
            candidates.push(path.join(base, d, 'bin', exe));
          }
        }
      } catch {}
    }
  } else if (process.platform === 'darwin') {
    try {
      const home = process.env.HOME || '';
      const jvmRoot = path.join(home, 'Library', 'Java', 'JavaVirtualMachines');
      for (const d of fs.readdirSync(jvmRoot)) {
        candidates.push(path.join(jvmRoot, d, 'Contents', 'Home', 'bin', exe));
      }
    } catch {}
  } else {
    for (const root of ['/usr/lib/jvm', '/usr/java', '/opt/java']) {
      try {
        for (const d of fs.readdirSync(root)) {
          candidates.push(path.join(root, d, 'bin', exe));
        }
      } catch {}
    }
  }

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    if (!fileExists(candidate)) continue;
    const v = execVersion(candidate);
    if (v && v.major >= 17) {
      return { path: candidate, version: v.major };
    }
  }

  return null;
}
