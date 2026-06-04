/**
 * Apply Bearer Auth to headers object.
 * Sets Authorization: Bearer <token>
 */
export function applyBearerAuth(headers: Record<string, string>, token: string): void {
  headers['Authorization'] = `Bearer ${token}`;
}
