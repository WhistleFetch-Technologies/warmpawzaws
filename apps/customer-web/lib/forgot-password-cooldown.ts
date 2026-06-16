export const CUSTOMER_FORGOT_COOLDOWN_STORAGE_KEY = 'warmpawz_customer_forgot_cooldown_until';

/** Do not retry 429 on forgot-password OTP requests; still retry transient 5xx. */
export const FORGOT_PASSWORD_RETRY_CONFIG = {
  retryableStatusCodes: [502, 503, 504],
} as const;

const DEFAULT_COOLDOWN_SEC = 60;

export function persistForgotCooldown(storageKey: string, seconds: number): void {
  if (typeof window === 'undefined') return;
  const sec = Math.max(1, Math.ceil(seconds));
  sessionStorage.setItem(storageKey, String(Date.now() + sec * 1000));
}

export function readForgotCooldownRemaining(storageKey: string): number {
  if (typeof window === 'undefined') return 0;
  const until = Number(sessionStorage.getItem(storageKey) || 0);
  if (!Number.isFinite(until) || until <= 0) return 0;
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

export function readRetryAfterSecondsFromSuccess(res: unknown): number {
  const outer = res as { data?: { data?: { retryAfterSeconds?: number } } } | null;
  const nested = outer?.data?.data?.retryAfterSeconds;
  if (typeof nested === 'number' && nested > 0) return Math.ceil(nested);
  const flat = (res as { retryAfterSeconds?: number } | null)?.retryAfterSeconds;
  if (typeof flat === 'number' && flat > 0) return Math.ceil(flat);
  return DEFAULT_COOLDOWN_SEC;
}

export function readRetryAfterSecondsFromError(err: unknown): number {
  const e = err as {
    retryAfterSeconds?: number;
    responseData?: { retryAfterSeconds?: number };
    response?: { retryAfterSeconds?: number };
  };
  const sec =
    e?.retryAfterSeconds ?? e?.responseData?.retryAfterSeconds ?? e?.response?.retryAfterSeconds;
  if (typeof sec === 'number' && sec > 0) return Math.ceil(sec);
  return DEFAULT_COOLDOWN_SEC;
}

export function formatForgotCooldownMessage(seconds: number, context: 'request' | 'resend'): string {
  if (context === 'request') {
    return `You can request another code in ${seconds}s`;
  }
  return `Resend code in ${seconds}s`;
}
