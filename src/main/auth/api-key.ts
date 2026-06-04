/**
 * Apply API Key Auth to headers or URL.
 * If location='header': sets headers[key] = value
 * If location='query': appends key=value to URL search params
 */
export function applyApiKeyAuth(
  headers: Record<string, string>,
  url: URL,
  key: string,
  value: string,
  location: 'header' | 'query',
): { headers: Record<string, string>; url: URL } {
  if (location === 'header') {
    headers[key] = value;
  } else {
    url.searchParams.append(key, value);
  }
  return { headers, url };
}
