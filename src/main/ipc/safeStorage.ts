import { safeStorage } from 'electron';

export function isAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

export async function encryptCredential(plainText: string): Promise<Buffer> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption not available on this platform');
  }
  return safeStorage.encryptStringAsync(plainText);
}

export async function decryptCredential(encrypted: Buffer): Promise<string> {
  const { result } = await safeStorage.decryptStringAsync(encrypted);
  return result;
}
