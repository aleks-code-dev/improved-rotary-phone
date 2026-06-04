import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function writeFileAtomic(targetPath: string, data: string | Uint8Array): Promise<void> {
  return atomicWrite(targetPath, data);
}

export async function atomicWrite(targetPath: string, data: string | Uint8Array): Promise<void> {
  const isWindows = process.platform === 'win32';
  const normalizedTarget = isWindows && targetPath.length > 240
    ? '\\\\?\\' + path.resolve(targetPath)
    : targetPath;

  const tmpPath = normalizedTarget + '.tmp';
  const normalizedTmp = isWindows && tmpPath.length > 240 ? '\\\\?\\' + path.resolve(tmpPath) : tmpPath;

  const fh = await fs.open(normalizedTmp, 'wx');
  try {
    await fh.writeFile(data);
    await fh.sync();
  } finally {
    await fh.close();
  }
  await fs.rename(normalizedTmp, normalizedTarget);
}