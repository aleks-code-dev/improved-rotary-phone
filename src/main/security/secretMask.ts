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

export const SECRET_HEADER_NAMES = ['authorization', 'cookie', 'x-api-key', 'proxy-authorization'] as const;