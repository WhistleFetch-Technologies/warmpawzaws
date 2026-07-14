/**
 * Central intervals for customer home / shell background polls (PR1 + Phase 1.5).
 * Tele incoming stays aggressive (5s) until FCM data path is validated.
 */

export const HOME_POLL_PROFILE = {
  /** Meal footer when no active order. */
  mealIdleMs: 60_000,
  /** Meal footer while an active order is shown. */
  mealLiveMs: 15_000,
  /** Bookings / pharmacy / reviews home tick (not tele). */
  homeTickMs: 30_000,
  /** Incoming tele_call_incoming discovery — keep snappy in PR1. */
  teleIncomingMs: 5_000,
  /** In-app toast poll (push is primary on Capacitor). */
  notifToastMs: 60_000,
  /** Bell unread badge. */
  notifBadgeMs: 90_000,
  /** Chat + support message badge. */
  messageBadgeMs: 90_000,
  /** GPS / video when no active session (Phase 1.5 optional use). */
  presenceIdleMs: 30_000,
  /** GPS / video while session live. */
  presenceLiveMs: 10_000,
  /** Max jitter applied to non-tele intervals (±). */
  jitterMs: 3_000,
  /** Backoff ceiling after consecutive failures. */
  backoffMaxMs: 120_000,
} as const;

export type HomePollProfileKey = keyof typeof HOME_POLL_PROFILE;

/** Spread timer starts so CAU does not align on the same second. */
export function withPollJitter(baseMs: number, jitterMs = HOME_POLL_PROFILE.jitterMs): number {
  if (baseMs <= 0) return baseMs;
  const j = Math.min(jitterMs, Math.floor(baseMs / 3));
  if (j <= 0) return baseMs;
  return baseMs + Math.floor(Math.random() * (2 * j + 1)) - j;
}

/**
 * Expand delay after failures: base, 2x, 4x… capped.
 * successResets: pass consecutiveFailures=0 after a successful poll.
 */
export function pollBackoffMs(
  baseMs: number,
  consecutiveFailures: number,
  maxMs = HOME_POLL_PROFILE.backoffMaxMs
): number {
  if (consecutiveFailures <= 0) return withPollJitter(baseMs);
  const mult = Math.min(2 ** Math.min(consecutiveFailures, 5), Math.ceil(maxMs / baseMs));
  return withPollJitter(Math.min(baseMs * mult, maxMs));
}

export function isDocumentHidden(): boolean {
  if (typeof document === 'undefined') return false;
  return document.hidden || document.visibilityState === 'hidden';
}
