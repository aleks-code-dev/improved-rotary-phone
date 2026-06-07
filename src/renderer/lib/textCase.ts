export function toCamelCase(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/[-_\s]+(.)?/g, (_m, c) => (c ? c.toUpperCase() : ''))
    .replace(/^[A-Z]/, (c) => c.toLowerCase());
}

/**
 * Build a reverse lookup: camelCase -> original DB key
 */
export function buildReverseCamelCaseMapping(
  dbRow: Record<string, unknown>
): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const key of Object.keys(dbRow)) {
    mapping[toCamelCase(key)] = key;
  }
  return mapping;
}