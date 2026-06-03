const SECRET_PATTERNS = [
  /authorization\s*[:=]\s*([^\s,;}\]]+)/gi,
  /cookie\s*[:=]\s*([^\s,;}\]]+)/gi,
  /x-api-key\s*[:=]\s*([^\s,;}\]]+)/gi,
  /proxy-authorization\s*[:=]\s*([^\s,;}\]]+)/gi,
];

export function redact(line: string): string {
  let result = line;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '$&: ••••••');
  }
  return result;
}