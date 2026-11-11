/**
 * Redact sensitive substrings before logging (PII, bearer tokens).
 * Batch 4: delegates string scrubbing to Stage 1 `redactSecretsForLog` and
 * exception logging to `secureLogError`.
 */

import { redactSecretsForLog } from './safe-hono-error';
import { secureLogError } from './secure-logger';

const PHONE_LIKE = /\b\+?\d[\d\s\-().]{7,}\b/g;

export function redactForLog(input: string | undefined | null, maxLen = 500): string {
  if (input == null) return '';
  let s = redactSecretsForLog(String(input));
  // Extra bare phone scrub for free-form ops logs (status codes left to Stage 1 rules).
  s = s.replace(PHONE_LIKE, '[REDACTED_PHONE]');
  if (s.length > maxLen) s = `${s.slice(0, maxLen)}…`;
  return s;
}

export function logErrorSafe(prefix: string, err: unknown): void {
  secureLogError(prefix, err);
}
