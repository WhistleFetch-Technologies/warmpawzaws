/**
 * Redact sensitive substrings before logging (PII, bearer tokens).
 * Does not guarantee log safety for all encodings; use for dev/ops logs only.
 */

const PHONE_LIKE = /\b\+?\d[\d\s\-().]{7,}\b/g;
const EMAIL_LIKE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const BEARER = /Bearer\s+[\w-._~+/]+=*/gi;

export function redactForLog(input: string | undefined | null, maxLen = 500): string {
  if (input == null) return '';
  let s = String(input);
  if (s.length > maxLen) s = `${s.slice(0, maxLen)}…`;
  s = s.replace(BEARER, 'Bearer [REDACTED]');
  s = s.replace(EMAIL_LIKE, '[REDACTED_EMAIL]');
  s = s.replace(PHONE_LIKE, '[REDACTED_PHONE]');
  return s;
}

export function logErrorSafe(prefix: string, err: unknown): void {
  const e = err as { name?: string; message?: string; code?: string };
  const msg = redactForLog(e?.message || String(err), 400);
  console.error(`[${prefix}]`, e?.name || 'Error', e?.code || '', msg);
}
