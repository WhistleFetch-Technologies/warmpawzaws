/** Per-account minimum gap between password-reset OTP sends (matches assert*SendRate). */
export const PASSWORD_RESET_SEND_COOLDOWN_MS = 60_000;
export const PASSWORD_RESET_SEND_COOLDOWN_SEC = 60;

const HOURLY_CAP_RETRY_SEC = 3600;
const DAILY_CAP_RETRY_SEC = 86400;

export function computeRemainingCooldownSec(
  last: Date,
  cooldownMs = PASSWORD_RESET_SEND_COOLDOWN_MS
): number {
  return Math.max(1, Math.ceil((cooldownMs - (Date.now() - last.getTime())) / 1000));
}

export function rateLimitError(retryAfterSeconds: number): Error {
  const err = new Error('RATE_LIMIT');
  (err as any).code = 'RATE_LIMIT';
  (err as any).retryAfterSeconds = retryAfterSeconds;
  return err;
}

export function rateLimitErrorForCooldown(last: Date): Error {
  return rateLimitError(computeRemainingCooldownSec(last));
}

export function rateLimitErrorForHourlyCap(): Error {
  return rateLimitError(HOURLY_CAP_RETRY_SEC);
}

export function rateLimitErrorForDailyCap(): Error {
  return rateLimitError(DAILY_CAP_RETRY_SEC);
}

export function readRateLimitRetryAfterSeconds(error: unknown): number {
  const sec = Number((error as any)?.retryAfterSeconds);
  if (Number.isFinite(sec) && sec > 0) return Math.ceil(sec);
  return PASSWORD_RESET_SEND_COOLDOWN_SEC;
}

export type ForgotPasswordHandlerResult = {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
};

export function buildRateLimitResponse(params: {
  requestId: string;
  retryAfterSeconds: number;
  message: string;
  errorBody: Record<string, unknown>;
}): ForgotPasswordHandlerResult {
  const { requestId, retryAfterSeconds, message, errorBody } = params;
  return {
    status: 429,
    headers: { 'Retry-After': String(retryAfterSeconds) },
  body: {
    ...errorBody,
    retryAfterSeconds,
  },
};
}
