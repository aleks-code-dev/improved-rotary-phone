export function maskForStorage(value: string): { mask: '***'; last4: string } {
  const last4 = value.length < 4 ? value : value.slice(-4);
  return { mask: '***', last4 };
}

export function maskHeadersForStorage(headers: Array<{ key: string; value: string }>): Array<{ key: string; value: string }> {
  const secretKeys = /^(authorization|cookie|x-api-key|proxy-authorization)$/i;
  return headers.map(h => secretKeys.test(h.key)
    ? { key: h.key, value: JSON.stringify(maskForStorage(h.value)) }
    : h
  );
}

export type AuthConfig =
  | { type: 'none' }
  | { type: 'bearer'; token: string }
  | { type: 'basic'; username: string; password: string }
  | { type: 'api-key'; key: string; value: string; in: 'header' | 'query' };

export function maskAuthForStorage(auth: AuthConfig): AuthConfig {
  switch (auth.type) {
    case 'none':
      return auth;
    case 'bearer': {
      const masked = maskForStorage(auth.token);
      return { ...auth, token: JSON.stringify(masked) };
    }
    case 'basic': {
      const maskedPass = maskForStorage(auth.password);
      return { ...auth, password: JSON.stringify(maskedPass) };
    }
    case 'api-key': {
      const maskedVal = maskForStorage(auth.value);
      return { ...auth, value: JSON.stringify(maskedVal) };
    }
    default:
      return auth;
  }
}

export const SECRET_HEADER_NAMES = ['authorization', 'cookie', 'x-api-key', 'proxy-authorization'] as const;