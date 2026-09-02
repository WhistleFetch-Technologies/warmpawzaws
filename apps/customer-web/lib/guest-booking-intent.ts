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

export type GuestJourneyKind =
  | 'booking'
  | 'search'
  | 'vendor'
  | 'cart'
  | 'add_pet'
  | 'pay_bill'
  | 'instant_tele'
  | 'profile_continue'
  | 'event'
  | 'other';

/**
 * Explicit collision ranks. Incoming replaces existing only when rank >= existing.
 * Appointment > Pay Bill > cart > Instant Tele > generic booking > add_pet > search.
 */
export function guestJourneyPriority(
  intent: Partial<Pick<GuestBookingIntentV1, 'kind' | 'resumeScreen' | 'persona' | 'category' | 'returnPath'>> | null | undefined
): number {
  if (!intent) return 0;
  const kind = intent.kind;
  if (kind === 'search') return 10;
  if (kind === 'add_pet') return 20;
  if (kind === 'instant_tele') return 25;
  if (kind === 'other' || kind === 'vendor') return 15;
  if (kind === 'cart') return 30;
  if (kind === 'event') return 36;
  if (kind === 'pay_bill') return 40;
  if (kind === 'profile_continue') return 45;
  if (kind === 'booking') {
    const resume = String(intent.resumeScreen || '');
    if (GUEST_APPOINTMENT_RESUME_SCREENS.has(resume) || GUEST_SERVICE_RESUME_SCREENS.has(resume)) {
      return 50;
    }
    return 35;
  }
  return 5;
}

export function shouldReplaceGuestJourney(
  existing: GuestBookingIntentV1 | null,
  incoming: Partial<GuestBookingIntentV1> | null | undefined
): boolean {
  if (!existing) return true;
  return guestJourneyPriority(incoming) >= guestJourneyPriority(existing);
}

export const GUEST_APPOINTMENT_RESUME_SCREENS = new Set([
  'grooming-booking',
  'vet-booking',
  'training-booking',
  'boarding-booking',
  'walker-booking',
  'pet-sitter-booking',
  'nutritionist-booking',
  'vet-tele-consultation',
]);

/** Live services that restore to an existing shell screen — not fabricated slots. */
export const GUEST_SERVICE_RESUME_SCREENS = new Set([
  'photography',
  'relocation',
  'sunset',
  'holiday',
  'cafe_reservation',
  'emergency-booking',
  'insurance',
]);

function mapPersonaBookingScreen(persona: string): string {
  const p = String(persona || '').toLowerCase();
  if (p === 'vet' || p === 'veterinary' || p === 'veterinarian') return 'vet-booking';
  if (p === 'grooming' || p === 'groomer') return 'grooming-booking';
  if (p === 'training' || p === 'trainer' || p === 'behaviorist' || p === 'behaviourist') {
    return 'training-booking';
  }
  if (p === 'walker' || p === 'walking') return 'walker-booking';
  if (p === 'boarding') return 'boarding-booking';
  if (p === 'sitting' || p === 'sitter' || p === 'pet_sitter') return 'pet-sitter-booking';
  if (p === 'nutrition' || p === 'nutritionist') return 'nutritionist-booking';
  return 'vet-booking';
}

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

/** Search/browse snapshots must not clobber appointment, WPay, or cart. */
export function saveGuestBookingIntentUnlessLowerPriority(
  intent: Omit<GuestBookingIntentV1, 'v' | 'savedAt'>
): boolean {
  const existing = readGuestBookingIntent();
  if (!shouldReplaceGuestJourney(existing, intent)) return false;
  saveGuestBookingIntent(intent);
  return true;
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
  if (intent.kind === 'cart' || intent.kind === 'search' || intent.kind === 'vendor' || intent.kind === 'instant_tele') {
    return false;
  }
  if (intent.kind === 'event') return true;
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
  if (raw === 'universal-provider-booking') {
    const style = String(intent.serviceStyle || '').toLowerCase();
    if (style === 'tele' || style === 'online' || style === 'video_consultation') {
      return 'vet-tele-consultation';
    }
    return mapPersonaBookingScreen(String(intent.persona || intent.category || ''));
  }
  if (raw === 'home-service-booking') {
    return mapPersonaBookingScreen(String(intent.persona || intent.category || ''));
  }
  return raw;
}

/** Appointment/slot booking only — never WPay, cart, search, or add-pet. */
export function isGuestAppointmentJourney(intent: GuestBookingIntentV1 | null | undefined): boolean {
  if (!intent) return false;
  if (
    intent.kind === 'cart' ||
    intent.kind === 'search' ||
    intent.kind === 'vendor' ||
    intent.kind === 'pay_bill' ||
    intent.kind === 'instant_tele' ||
    intent.kind === 'event' ||
    intent.kind === 'other'
  ) {
    return false;
  }
  if (intent.kind === 'add_pet') return false;
  const resume = resolveResumeScreen(intent);
  if (resume === 'warmpawz-pay-vendor' || resume?.startsWith('warmpawz-pay')) return false;
  if (String(intent.returnPath || '').startsWith('/warmpawz-pay')) return false;
  return !!resume && GUEST_APPOINTMENT_RESUME_SCREENS.has(resume);
}

export function clearGuestBookingIntent(): void {
  removePair(GUEST_BOOKING_INTENT_KEY, GUEST_JOURNEY_BACKUP_KEY);
  removePair(GUEST_BOOKING_PROGRESS_KEY, GUEST_JOURNEY_PROGRESS_BACKUP_KEY);
  restoreInFlightSavedAt = null;
}

/**
 * Persist intent (+ progress merge), seed shell screen resume.
 * Shared by full-page /auth redirect and in-app guest auth modal.
 */
export function persistGuestBookingIntentForAuth(
  intent: Omit<GuestBookingIntentV1, 'v' | 'savedAt'>
): Omit<GuestBookingIntentV1, 'v' | 'savedAt'> {
  const existing = readGuestBookingIntent();
  const incomingKind =
    intent.kind || (intent.resumeScreen === 'add-pet' ? 'add_pet' : existing?.kind || 'booking');
  if (existing && !shouldReplaceGuestJourney(existing, { ...intent, kind: incomingKind })) {
    if (canUseStorage() && existing.resumeScreen) {
      try {
        sessionStorage.setItem(WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY, existing.resumeScreen);
      } catch {
        /* ignore */
      }
    }
    return {
      ...existing,
      returnPath: existing.returnPath,
    };
  }
  const progress = readGuestBookingProgress() || {};
  const merged: Omit<GuestBookingIntentV1, 'v' | 'savedAt'> = {
    ...progress,
    ...intent,
    kind: incomingKind || progress.kind || (intent.resumeScreen === 'add-pet' ? 'add_pet' : 'booking'),
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

let restoreInFlightSavedAt: number | null = null;

function seedResumeScreen(intent: GuestBookingIntentV1): void {
  const resume = resolveResumeScreen(intent);
  if (resume && canUseStorage()) {
    try {
      sessionStorage.setItem(WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY, resume);
    } catch {
      /* ignore */
    }
  }
}

export function consumeGuestBookingIntentForRestore(): GuestBookingIntentV1 | null {
  return beginGuestJourneyRestore();
}

/** Peek + lock so React Strict Mode / remount cannot restore twice. */
export function beginGuestJourneyRestore(): GuestBookingIntentV1 | null {
  const intent = readGuestBookingIntent();
  if (!intent) return null;
  if (restoreInFlightSavedAt === intent.savedAt) return null;
  restoreInFlightSavedAt = intent.savedAt;
  seedResumeScreen(intent);
  return intent;
}

export function abortGuestJourneyRestore(): void {
  restoreInFlightSavedAt = null;
}

export function finishGuestJourneyRestore(): void {
  clearGuestBookingIntent();
  restoreInFlightSavedAt = null;
}

const GUEST_JOURNEY_AUTH_LEAK_KEYS = [
  'jwt',
  'idToken',
  'accessToken',
  'refreshToken',
  'access_token',
  'refresh_token',
  'id_token',
  'authToken',
  'token',
  'password',
  'otp',
  'customerPhone',
  'customerId',
  'phone',
] as const;

function stripAuthFieldsFromRecord(value: Record<string, unknown>): Record<string, unknown> {
  const next = { ...value };
  for (const key of GUEST_JOURNEY_AUTH_LEAK_KEYS) {
    delete next[key];
  }
  return next;
}

/** Logout isolation: drop leaked credentials, keep guest-safe journey fields. */
export function stripAuthFromGuestJourneySnapshots(): void {
  if (!canUseStorage()) return;
  for (const [sessionKey, backupKey] of [
    [GUEST_BOOKING_INTENT_KEY, GUEST_JOURNEY_BACKUP_KEY],
    [GUEST_BOOKING_PROGRESS_KEY, GUEST_JOURNEY_PROGRESS_BACKUP_KEY],
  ] as const) {
    const parsed = readPair<Record<string, unknown>>(sessionKey, backupKey);
    if (!parsed || typeof parsed !== 'object') continue;
    persistPair(sessionKey, backupKey, stripAuthFieldsFromRecord(parsed));
  }
}
