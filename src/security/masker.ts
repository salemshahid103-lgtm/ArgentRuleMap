/**
 * Masks a secret string to prevent leakage in terminal outputs, logs, or JSON reports.
 * e.g. "sk-proj-1234567890abcdef" -> "sk-p...cdef" or "[REDACTED_API_KEY]"
 */
export function maskSecret(secret: string): string {
  if (!secret) return '[EMPTY]';
  const trimmed = secret.trim();
  if (trimmed.length <= 8) {
    return '***REDACTED***';
  }
  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return `${prefix}...${suffix}`;
}

export function maskMatchedContent(text: string, pattern: RegExp): string {
  return text.replace(pattern, (match) => maskSecret(match));
}
