/** Per-account minimum gap between password-reset OTP sends (matches assert*SendRate). */
export const PASSWORD_RESET_SEND_COOLDOWN_MS = 60_000;
export const PASSWORD_RESET_SEND_COOLDOWN_SEC = 60;

/** Max OTP sends per hour while a reset is in progress (before password change). */
export const PASSWORD_RESET_SEND_HOURLY_CAP = 6;

/** Rolling window after a successful password reset. */
export const PASSWORD_RESET_ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000;

const SEND_HOURLY_CAP_RETRY_SEC = 300;
const UNRESOLVED_HOURLY_CAP_RETRY_SEC = 120;
const VERIFY_HOURLY_CAP_RETRY_SEC = 120;

export const RESET_RECENTLY_ERROR_CODE = 'RESET_RECENTLY';

export function computeRemainingCooldownSec(
  last: Date,
  cooldownMs = PASSWORD_RESET_SEND_COOLDOWN_MS
): number {
  return Math.max(1, Math.ceil((cooldownMs - (Date.now() - last.getTime())) / 1000));
}

export function rolling24hRetrySeconds(lastResetAt: Date): number {
  const endsAt = lastResetAt.getTime() + PASSWORD_RESET_ROLLING_WINDOW_MS;
  return Math.max(1, Math.ceil((endsAt - Date.now()) / 1000));
}

export function rateLimitError(retryAfterSeconds: number, code = 'RATE_LIMIT'): Error {
  const err = new Error('RATE_LIMIT');
  (err as any).code = code;
  (err as any).retryAfterSeconds = retryAfterSeconds;
  return err;
}

export function rateLimitErrorForCooldown(last: Date): Error {
  return rateLimitError(computeRemainingCooldownSec(last));
}

export function rateLimitErrorForResetRecently(lastResetAt: Date): Error {
  return rateLimitError(rolling24hRetrySeconds(lastResetAt), RESET_RECENTLY_ERROR_CODE);
}

export function rateLimitErrorForSendHourlyCap(): Error {
  return rateLimitError(SEND_HOURLY_CAP_RETRY_SEC);
}

export function rateLimitErrorForUnresolvedHourlyCap(): Error {
  return rateLimitError(UNRESOLVED_HOURLY_CAP_RETRY_SEC);
}

export function rateLimitErrorForVerifyHourlyCap(): Error {
  return rateLimitError(VERIFY_HOURLY_CAP_RETRY_SEC);
}

/** @deprecated Use rateLimitErrorForResetRecently for completed-reset caps. */
export function rateLimitErrorForHourlyCap(): Error {
  return rateLimitErrorForSendHourlyCap();
}

/** @deprecated Use rateLimitErrorForResetRecently for completed-reset caps. */
export function rateLimitErrorForDailyCap(): Error {
  return rateLimitErrorForResetRecently(new Date(Date.now() - 60_000));
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
  const { retryAfterSeconds, errorBody } = params;
  return {
    status: 429,
    headers: { 'Retry-After': String(retryAfterSeconds) },
    body: {
      ...errorBody,
      retryAfterSeconds,
    },
  };
}
