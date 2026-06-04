/**
 * Apply Basic Auth to headers object.
 * Sets Authorization: Basic <base64(user:pass)>
 */
export function applyBasicAuth(headers: Record<string, string>, username: string, password: string): void {
  const encoded = Buffer.from(`${username}:${password}`).toString('base64');
  headers['Authorization'] = `Basic ${encoded}`;
}
