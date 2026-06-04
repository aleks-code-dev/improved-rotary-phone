const SECRET_PATTERNS: Array<{ header: RegExp; value: RegExp }> = [
  { header: /authorization\s*[:=]\s*/gi, value: /([^\s,;}\]]+)/gi },
  { header: /cookie\s*[:=]\s*/gi, value: /([^\s,;}\]]+)/gi },
  { header: /x-api-key\s*[:=]\s*/gi, value: /([^\s,;}\]]+)/gi },
  { header: /proxy-authorization\s*[:=]\s*/gi, value: /([^\s,;}\]]+)/gi },
];

export function redact(line: string): string {
  let result = line;
  for (const { header, value } of SECRET_PATTERNS) {
    // Reset lastIndex since we're reusing the regex with the global flag
    header.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = header.exec(result)) !== null) {
      const valueStart = match.index + match[0].length;
      value.lastIndex = valueStart;
      const valueMatch = value.exec(result);
      if (valueMatch) {
        const secret = valueMatch[1];
        const masked = secret.length <= 4
          ? '••••'
          : '••••' + secret.slice(-4);
        result = result.slice(0, valueMatch.index + valueMatch[0].indexOf(secret)) +
          masked +
          result.slice(valueMatch.index + valueMatch[0].length);
      }
    }
  }
  return result;
}