/**
 * Lightweight guest → login appointment/booking intent (sessionStorage).
 * Survives /auth navigation; cleared after successful restore.
 */

import { buildAuthUrlWithReturn } from './auth-redirect';
import { WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY } from './go-back-or-replace';

export const GUEST_BOOKING_INTENT_KEY = 'warmpawz_guest_booking_intent_v1';
/** Live draft updated as guest picks vendor/date/slot (merged into auth redirect). */
export const GUEST_BOOKING_PROGRESS_KEY = 'warmpawz_guest_booking_progress_v1';

export type GuestBookingIntentV1 = {
  v: 1;
  savedAt: number;
  vendorId?: string;
  serviceId?: string;
  serviceStyle?: string;
  category?: string;
  date?: string;
  time?: string;
  appointmentType?: string;
  wapptMode?: boolean;
  price?: number;
  offerId?: string;
  promotionId?: string;
  /** Shell screen / restore hint */
  resumeScreen?: string;
  returnPath: string;
  /** Open add-pet after restore */
  openAddPet?: boolean;
};

export function saveGuestBookingIntent(
  intent: Omit<GuestBookingIntentV1, 'v' | 'savedAt'>
): void {
  if (typeof window === 'undefined') return;
  const payload: GuestBookingIntentV1 = {
    ...intent,
    v: 1,
    savedAt: Date.now(),
  };
  try {
    sessionStorage.setItem(GUEST_BOOKING_INTENT_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

/** Merge partial booking progress while guest browses (date/slot/vendor). */
export function updateGuestBookingProgress(
  partial: Partial<Omit<GuestBookingIntentV1, 'v' | 'savedAt'>>
): void {
  if (typeof window === 'undefined') return;
  try {
    let prev: Partial<GuestBookingIntentV1> = {};
    const raw = sessionStorage.getItem(GUEST_BOOKING_PROGRESS_KEY);
    if (raw) {
      try {
        prev = JSON.parse(raw) as Partial<GuestBookingIntentV1>;
      } catch {
        prev = {};
      }
    }
    const next = { ...prev, ...partial, v: 1 as const, savedAt: Date.now() };
    sessionStorage.setItem(GUEST_BOOKING_PROGRESS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function readGuestBookingProgress(): Partial<GuestBookingIntentV1> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(GUEST_BOOKING_PROGRESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<GuestBookingIntentV1>;
  } catch {
    return null;
  }
}

export function readGuestBookingIntent(): GuestBookingIntentV1 | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(GUEST_BOOKING_INTENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestBookingIntentV1;
    if (parsed?.v !== 1 || !parsed.returnPath) return null;
    // 2h TTL
    if (Date.now() - (parsed.savedAt || 0) > 2 * 60 * 60 * 1000) {
      clearGuestBookingIntent();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearGuestBookingIntent(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(GUEST_BOOKING_INTENT_KEY);
    sessionStorage.removeItem(GUEST_BOOKING_PROGRESS_KEY);
  } catch {
    // ignore
  }
}

/**
 * Persist intent (+ progress merge), seed shell screen resume, return safe /auth?redirect= URL.
 */
export function buildGuestAuthUrlForBooking(
  intent: Omit<GuestBookingIntentV1, 'v' | 'savedAt'>
): string {
  const progress = readGuestBookingProgress() || {};
  const merged: Omit<GuestBookingIntentV1, 'v' | 'savedAt'> = {
    ...progress,
    ...intent,
    returnPath: intent.returnPath || progress.returnPath || '/',
  };
  saveGuestBookingIntent(merged);
  if (typeof window !== 'undefined' && merged.resumeScreen) {
    try {
      sessionStorage.setItem(WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY, merged.resumeScreen);
    } catch {
      // ignore
    }
  }
  return buildAuthUrlWithReturn(merged.returnPath || '/');
}

/**
 * After login: apply shell resume + emit booking_resumed once.
 * Returns intent for routers to restore date/time (caller should clear after apply).
 */
export function consumeGuestBookingIntentForRestore(): GuestBookingIntentV1 | null {
  const intent = readGuestBookingIntent();
  if (!intent) return null;
  if (intent.resumeScreen && typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY, intent.resumeScreen);
    } catch {
      // ignore
    }
  }
  return intent;
}
