/**
 * Compact guest → auth journey snapshot (sessionStorage + short-lived localStorage).
 * Survives /auth navigation on web and Capacitor WebView. Cleared after restore.
 * Price / availability / promo eligibility are display hints only — revalidate server-side.
 */

import { buildAuthUrlWithReturn, resolveSafeAuthReturnPath } from './auth-redirect';
import { emitGuestAuthAnalytics } from './guest-auth-gate';
import { WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY } from './go-back-or-replace';

export const GUEST_BOOKING_INTENT_KEY = 'warmpawz_guest_booking_intent_v1';
export const GUEST_BOOKING_PROGRESS_KEY = 'warmpawz_guest_booking_progress_v1';
/** Capacitor-safe TTL backup — same payload, not a second mechanism. */
export const GUEST_JOURNEY_BACKUP_KEY = 'warmpawz_guest_booking_intent_backup_v1';
export const GUEST_JOURNEY_PROGRESS_BACKUP_KEY = 'warmpawz_guest_booking_progress_backup_v1';

export const GUEST_JOURNEY_TTL_MS = 2 * 60 * 60 * 1000;

export type GuestJourneyKind = 'booking' | 'search' | 'vendor' | 'cart' | 'add_pet';

export type GuestSearchSnapshot = {
  q?: string;
  category?: string;
  subcategory?: string;
  filters?: string;
  sort?: string;
};

export type GuestBookingIntentV1 = {
  v: 1;
  savedAt: number;
  kind?: GuestJourneyKind;
  vendorId?: string;
  serviceId?: string;
  serviceStyle?: string;
  category?: string;
  persona?: string;
  packageId?: string;
  variantId?: string;
  date?: string;
  time?: string;
  slotId?: string;
  appointmentType?: string;
  wapptMode?: boolean;
  price?: number;
  offerId?: string;
  promotionId?: string;
  resumeScreen?: string;
  returnPath: string;
  openAddPet?: boolean;
  /** Explicit transaction pet requirement. Cart/WPay default false unless set. */
  requiresPet?: boolean;
  search?: GuestSearchSnapshot;
  /** Set when a meaningful conversion started — used for TTL abandonment only. */
  funnelStarted?: 'booking' | 'checkout';
};

const INTENT_TTL_MS = GUEST_JOURNEY_TTL_MS;

function canUseStorage(): boolean {
  return typeof window !== 'undefined';
}

function writeJson(storage: Storage, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

function readJson<T>(storage: Storage, key: string): T | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function persistPair(sessionKey: string, backupKey: string, value: unknown): void {
  if (!canUseStorage()) return;
  writeJson(sessionStorage, sessionKey, value);
  writeJson(localStorage, backupKey, value);
}

function readPair<T>(sessionKey: string, backupKey: string): T | null {
  if (!canUseStorage()) return null;
  return readJson<T>(sessionStorage, sessionKey) ?? readJson<T>(localStorage, backupKey);
}

function removePair(sessionKey: string, backupKey: string): void {
  if (!canUseStorage()) return;
  try {
    sessionStorage.removeItem(sessionKey);
    localStorage.removeItem(backupKey);
  } catch {
    /* ignore */
  }
}

function isExpired(savedAt: number | undefined): boolean {
  return Date.now() - (savedAt || 0) > INTENT_TTL_MS;
}

function emitAbandonmentIfDue(intent: Partial<GuestBookingIntentV1> | null | undefined): void {
  if (!intent?.funnelStarted) return;
  if (intent.funnelStarted === 'booking') {
    emitGuestAuthAnalytics('booking_abandoned', { kind: intent.kind || 'booking' });
  }
  if (intent.funnelStarted === 'checkout') {
    emitGuestAuthAnalytics('cart_abandoned', { kind: 'cart' });
  }
}

export function saveGuestBookingIntent(
  intent: Omit<GuestBookingIntentV1, 'v' | 'savedAt'>
): void {
  if (!canUseStorage()) return;
  const safeReturn = resolveSafeAuthReturnPath(`redirect=${encodeURIComponent(intent.returnPath || '/')}`) || '/';
  const payload: GuestBookingIntentV1 = {
    ...intent,
    returnPath: safeReturn,
    v: 1,
    savedAt: Date.now(),
  };
  persistPair(GUEST_BOOKING_INTENT_KEY, GUEST_JOURNEY_BACKUP_KEY, payload);
}

export function updateGuestBookingProgress(
  partial: Partial<Omit<GuestBookingIntentV1, 'v' | 'savedAt'>>
): void {
  if (!canUseStorage()) return;
  const prev = readPair<Partial<GuestBookingIntentV1>>(
    GUEST_BOOKING_PROGRESS_KEY,
    GUEST_JOURNEY_PROGRESS_BACKUP_KEY
  ) || {};
  const next = { ...prev, ...partial, v: 1 as const, savedAt: Date.now() };
  persistPair(GUEST_BOOKING_PROGRESS_KEY, GUEST_JOURNEY_PROGRESS_BACKUP_KEY, next);
}

export function readGuestBookingProgress(): Partial<GuestBookingIntentV1> | null {
  const parsed = readPair<Partial<GuestBookingIntentV1>>(
    GUEST_BOOKING_PROGRESS_KEY,
    GUEST_JOURNEY_PROGRESS_BACKUP_KEY
  );
  if (!parsed) return null;
  if (isExpired(parsed.savedAt)) {
    emitAbandonmentIfDue(parsed);
    removePair(GUEST_BOOKING_PROGRESS_KEY, GUEST_JOURNEY_PROGRESS_BACKUP_KEY);
    return null;
  }
  return parsed;
}

export function readGuestBookingIntent(): GuestBookingIntentV1 | null {
  const parsed = readPair<GuestBookingIntentV1>(GUEST_BOOKING_INTENT_KEY, GUEST_JOURNEY_BACKUP_KEY);
  if (!parsed || parsed.v !== 1 || !parsed.returnPath) return null;
  if (isExpired(parsed.savedAt)) {
    emitAbandonmentIfDue(parsed);
    clearGuestBookingIntent();
    return null;
  }
  return parsed;
}

export function hasPendingGuestJourney(): boolean {
  return readGuestBookingIntent() != null;
}

export function shouldDeferHomeOnboarding(): boolean {
  return hasPendingGuestJourney();
}

/** Pet is required only for explicit Add Pet or marketplace bookings that need a pet. */
export function transactionRequiresPet(intent: GuestBookingIntentV1 | null | undefined): boolean {
  if (!intent) return false;
  if (intent.kind === 'cart' || intent.kind === 'search' || intent.kind === 'vendor') return false;
  if (intent.kind === 'add_pet' || intent.openAddPet === true) return true;
  if (intent.requiresPet === false) return false;
  if (intent.requiresPet === true) return true;
  if (intent.wapptMode === true) return false;
  const persona = String(intent.persona || intent.category || '').toLowerCase();
  return ['vet', 'grooming', 'training', 'walker', 'sitting', 'boarding', 'nutrition', 'nutritionist'].includes(
    persona
  );
}

export function resolveResumeScreen(intent: GuestBookingIntentV1): string | undefined {
  const raw = intent.resumeScreen;
  if (raw === 'vet') return 'vet-booking';
  if (raw === 'nutritionist') return 'nutritionist-booking';
  return raw;
}

export function clearGuestBookingIntent(): void {
  removePair(GUEST_BOOKING_INTENT_KEY, GUEST_JOURNEY_BACKUP_KEY);
  removePair(GUEST_BOOKING_PROGRESS_KEY, GUEST_JOURNEY_PROGRESS_BACKUP_KEY);
}

/**
 * Persist intent (+ progress merge), seed shell screen resume.
 * Shared by full-page /auth redirect and in-app guest auth modal.
 */
export function persistGuestBookingIntentForAuth(
  intent: Omit<GuestBookingIntentV1, 'v' | 'savedAt'>
): Omit<GuestBookingIntentV1, 'v' | 'savedAt'> {
  const progress = readGuestBookingProgress() || {};
  const merged: Omit<GuestBookingIntentV1, 'v' | 'savedAt'> = {
    ...progress,
    ...intent,
    kind: intent.kind || progress.kind || (intent.resumeScreen === 'add-pet' ? 'add_pet' : 'booking'),
    search: intent.search || progress.search,
    returnPath: intent.returnPath || progress.returnPath || '/',
    funnelStarted:
      intent.funnelStarted ||
      progress.funnelStarted ||
      (intent.kind === 'cart' || progress.kind === 'cart' ? 'checkout' : 'booking'),
  };
  saveGuestBookingIntent(merged);
  if (merged.kind === 'booking') {
    emitGuestAuthAnalytics('booking_started', { persona: merged.persona || merged.category });
  }
  if (canUseStorage() && merged.resumeScreen) {
    try {
      sessionStorage.setItem(WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY, merged.resumeScreen);
    } catch {
      /* ignore */
    }
  }
  return merged;
}

/**
 * Persist intent (+ progress merge), seed shell screen resume, return safe /auth?redirect= URL.
 */
export function buildGuestAuthUrlForBooking(
  intent: Omit<GuestBookingIntentV1, 'v' | 'savedAt'>
): string {
  const merged = persistGuestBookingIntentForAuth(intent);
  return buildAuthUrlWithReturn(merged.returnPath || '/');
}

export const buildGuestAuthUrlForJourney = buildGuestAuthUrlForBooking;

export function consumeGuestBookingIntentForRestore(): GuestBookingIntentV1 | null {
  const intent = readGuestBookingIntent();
  if (!intent) return null;
  const resume = resolveResumeScreen(intent);
  if (resume && canUseStorage()) {
    try {
      sessionStorage.setItem(WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY, resume);
    } catch {
      /* ignore */
    }
  }
  return intent;
}
