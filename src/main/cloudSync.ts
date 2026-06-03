import { app } from 'electron';

type CloudProvider = 'dropbox' | 'onedrive' | 'icloud' | 'googledrive' | null;

export function detectCloudSync(p: string): CloudProvider {
  const lower = p.toLowerCase();

  if (process.platform === 'darwin') {
    if (lower.includes('/dropbox/')) return 'dropbox';
    if (lower.includes('/library/mobile documents/com~apple~clouddocs/')) return 'icloud';
    if (lower.includes('/onedrive/') || lower.includes('/library/cloudstorage/onedrive-')) return 'onedrive';
    if (lower.includes('/library/cloudstorage/googledrive')) return 'googledrive';
  } else if (process.platform === 'win32') {
    const userprofile = process.env.USERPROFILE || '';
    if (lower.includes('\\dropbox\\') || lower.includes(userprofile + '\\dropbox')) return 'dropbox';
    if (lower.includes('\\onedrive\\') || lower.includes(process.env.OneDrive || '')) return 'onedrive';
    if (lower.includes('\\google drive\\') || lower.includes(process.env.GOOGLE_DRIVE || '')) return 'googledrive';
  } else {
    if (lower.includes('.dropbox') || lower.includes('/dropbox/')) return 'dropbox';
    if (lower.includes('.onedrive') || lower.includes('/onedrive/')) return 'onedrive';
    if (lower.includes('.gdrive') || lower.includes('/.gdrive/')) return 'googledrive';
  }

  return null;
}