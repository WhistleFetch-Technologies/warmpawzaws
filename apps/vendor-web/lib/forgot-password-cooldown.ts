/** @deprecated Legacy global key — cleared on read; use per-username keys instead. */
export const VENDOR_FORGOT_COOLDOWN_STORAGE_KEY = 'warmpawz_vendor_forgot_cooldown_until';

export const FORGOT_PASSWORD_SEND_COOLDOWN_SEC = 60;

const LEGACY_GLOBAL_KEYS = [
  VENDOR_FORGOT_COOLDOWN_STORAGE_KEY,
  'warmpawz_customer_forgot_cooldown_until',
] as const;

function normalizeUsernameForCooldown(username: string): string {
  return username.trim().toLowerCase();
}

/** Stable sessionStorage key scoped to the username (not shared across numbers on one browser). */
export function forgotCooldownStorageKey(username: string, namespace: 'customer' | 'vendor' = 'vendor'): string {
  const normalized = normalizeUsernameForCooldown(username);
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) | 0;
  }
  const suffix = Math.abs(hash).toString(36);
  return `warmpawz_${namespace}_forgot_cooldown_${suffix}`;
}

function clearLegacyGlobalCooldownKeys(): void {
  if (typeof sessionStorage === 'undefined') return;
  for (const key of LEGACY_GLOBAL_KEYS) {
    sessionStorage.removeItem(key);
  }
}

export function readForgotCooldownRemaining(storageKey: string): number {
  if (typeof sessionStorage === 'undefined') return 0;
  clearLegacyGlobalCooldownKeys();
  const raw = sessionStorage.getItem(storageKey);
  if (!raw) return 0;
  const until = Number(raw);
  if (!Number.isFinite(until)) {
    sessionStorage.removeItem(storageKey);
    return 0;
  }
  const remainingMs = until - Date.now();
  if (remainingMs <= 0) {
    sessionStorage.removeItem(storageKey);
    return 0;
  }
  return Math.ceil(remainingMs / 1000);
}

/** UI resend spacing — cap at 60s even when backend returns longer reset-window retry. */
export function forgotResendCooldownSeconds(retryAfterSeconds: number): number {
  const n = Number(retryAfterSeconds);
  if (!Number.isFinite(n) || n <= 0) return FORGOT_PASSWORD_SEND_COOLDOWN_SEC;
  return Math.min(Math.ceil(n), FORGOT_PASSWORD_SEND_COOLDOWN_SEC);
}

export function persistForgotCooldown(storageKey: string, retryAfterSeconds: number): void {
  if (typeof sessionStorage === 'undefined') return;
  const seconds = forgotResendCooldownSeconds(retryAfterSeconds);
  if (seconds <= 0) return;
  sessionStorage.setItem(storageKey, String(Date.now() + seconds * 1000));
}

/** Do not retry 429 on forgot-password OTP requests; still retry transient 5xx. */
export const FORGOT_PASSWORD_RETRY_CONFIG = {
  retryableStatusCodes: [502, 503, 504],
} as const;

const DEFAULT_COOLDOWN_SEC = 60;

export function readRetryAfterSecondsFromSuccess(res: unknown): number {
  const outer = res as { data?: { data?: { retryAfterSeconds?: number } } } | null;
  const nested = outer?.data?.data?.retryAfterSeconds;
  if (typeof nested === 'number' && nested > 0) return forgotResendCooldownSeconds(nested);
  const flat = (res as { retryAfterSeconds?: number } | null)?.retryAfterSeconds;
  if (typeof flat === 'number' && flat > 0) return forgotResendCooldownSeconds(flat);
  return FORGOT_PASSWORD_SEND_COOLDOWN_SEC;
}

export function readRetryAfterSecondsFromError(err: unknown): number {
  const e = err as {
    retryAfterSeconds?: number;
    responseData?: { retryAfterSeconds?: number };
    retryAfter?: number;
  };
  const sec =
    e?.retryAfterSeconds ??
    e?.responseData?.retryAfterSeconds ??
    e?.retryAfter;
  if (typeof sec === 'number' && sec > 0) return Math.ceil(sec);
  return DEFAULT_COOLDOWN_SEC;
}

export function formatForgotCooldownMessage(seconds: number, context: 'request' | 'resend'): string {
  if (context === 'request') {
    return `You can request another code in ${seconds}s`;
  }
  return `Resend code in ${seconds}s`;
}

export function formatResetRecentlyMessage(retryAfterSeconds: number): string {
  const hours = Math.max(1, Math.ceil(retryAfterSeconds / 3600));
  return `Password reset already completed recently. Try again in about ${hours} hour${hours === 1 ? '' : 's'}.`;
}
