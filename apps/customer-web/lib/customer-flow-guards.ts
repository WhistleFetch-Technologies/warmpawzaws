/**
 * Home-route gates: profile creation → home.
 * Stage selection (have-pet / no-pet) is retired; pets can be added later from the app.
 * Includes legacy localStorage heuristics so existing users are not forced through /profile again.
 */

import {
  readGuestBookingIntent,
  transactionRequiresPet,
  type GuestBookingIntentV1,
} from './guest-booking-intent';

const NEEDS_PROFILE_CREATE_KEY = '_warmpawz_needs_profile_create';

function setCustomerOnboardingCompleteFromProfile(value: 'true' | 'false'): void {
  if (typeof window === 'undefined') return;
  if (value === 'false' && localStorage.getItem('onboarding_completed') === 'true') return;
  localStorage.setItem('customerOnboardingComplete', value);
}

function readNeedsProfileCreate(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(NEEDS_PROFILE_CREATE_KEY) === 'true';
  } catch {
    return false;
  }
}

function placeholderCustomerName(phoneDigits10: string): string {
  const last4 = phoneDigits10.replace(/\D/g, '').slice(-4);
  return last4 ? `Customer ${last4}` : '';
}

/** True when unified/OTP profile already belongs to a returning customer. */
export function profileIndicatesExistingCustomer(
  profile: Record<string, unknown> | null | undefined,
  phoneDigits10: string
): boolean {
  if (!profile) return false;

  const onboardingStatus = String(profile.onboarding_status || profile.onboardingStatus || 'INIT');
  const profileCompletedFlag =
    profile.profile_completed === true || profile.onboardingComplete === true;
  if (onboardingStatus === 'COMPLETED' || profileCompletedFlag) return true;

  const nameVal = String(profile.name || profile.full_name || '').trim();
  const hasName = !!nameVal && nameVal !== placeholderCustomerName(phoneDigits10);
  const bookings = profile.bookings;
  const hasBookings = Array.isArray(bookings) && bookings.length > 0;
  const orders = profile.orders;
  const orderList = Array.isArray(orders)
    ? orders
    : orders && typeof orders === 'object' && Array.isArray((orders as { all?: unknown[] }).all)
      ? ((orders as { all?: unknown[] }).all as unknown[])
      : [];
  const hasOrders = orderList.length > 0;
  const hasProfileId = !!profile.id;

  return hasProfileId && (hasName || hasBookings || hasOrders);
}

/**
 * Align localStorage flow flags with unified profile API (same rules as OTP verify in auth).
 * Call after password login or whenever unified profile is loaded so / gates match the backend.
 */
export function applyUnifiedProfileToCustomerLocalStorage(
  profile: Record<string, unknown> | null | undefined,
  phoneDigits10: string
): void {
  if (typeof window === 'undefined' || !profile) return;

  if (profileIndicatesExistingCustomer(profile, phoneDigits10)) {
    if (readNeedsProfileCreate()) return;
    markOnboardingCompleteAfterProfile();
  } else {
    setCustomerOnboardingCompleteFromProfile('false');
  }
}

/** OTP / login created a customer who still needs the profile form. Clears leftover guest flags. */
export function markProfileCreationRequired(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('profile_completed', 'false');
  localStorage.setItem('onboarding_completed', 'false');
  localStorage.setItem('customerOnboardingComplete', 'false');
  try {
    sessionStorage.setItem(NEEDS_PROFILE_CREATE_KEY, 'true');
  } catch {
    /* private mode */
  }
}

export function extractOtpAuthState(payload: unknown): 'new' | 'existing' | null {
  const walk = (value: unknown, depth = 0): 'new' | 'existing' | null => {
    if (!value || typeof value !== 'object' || depth > 3) return null;
    const rec = value as Record<string, unknown>;
    if (rec.state === 'new' || rec.state === 'existing') return rec.state;
    return walk(rec.data, depth + 1);
  };
  return walk(payload);
}

/** After OTP: brand-new users create a profile; returning customers go home. */
export function applyOtpVerifyProfileFlags(opts: {
  authState?: 'new' | 'existing' | null;
  profile?: Record<string, unknown> | null;
  phoneDigits10: string;
}): 'create-profile' | 'home' {
  if (typeof window === 'undefined') return 'create-profile';

  // OTP `state: new` means onboarding flags are incomplete, not "no account".
  if (opts.authState === 'new') {
    if (profileIndicatesExistingCustomer(opts.profile, opts.phoneDigits10)) {
      markOnboardingCompleteAfterProfile();
      return 'home';
    }
    markProfileCreationRequired();
    return 'create-profile';
  }

  if (opts.authState === 'existing') {
    try {
      sessionStorage.removeItem(NEEDS_PROFILE_CREATE_KEY);
    } catch {
      /* private mode */
    }
    if (opts.profile) {
      applyUnifiedProfileToCustomerLocalStorage(opts.profile, opts.phoneDigits10);
    }
    if (!readProfileCompleted()) {
      markOnboardingCompleteAfterProfile();
    }
    return 'home';
  }

  if (opts.profile) {
    applyUnifiedProfileToCustomerLocalStorage(opts.profile, opts.phoneDigits10);
    if (readNeedsProfileCreate()) return 'create-profile';
    if (readProfileCompleted()) return 'home';
  }

  markProfileCreationRequired();
  return 'create-profile';
}

/** Profile is the last required signup step; mark stage-selection complete too. */
export function markOnboardingCompleteAfterProfile(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(NEEDS_PROFILE_CREATE_KEY);
  } catch {
    /* private mode */
  }
  localStorage.setItem('profile_completed', 'true');
  localStorage.setItem('onboarding_completed', 'true');
  setCustomerOnboardingCompleteFromProfile('true');
}

export function readProfileCompleted(): boolean {
  if (typeof window === 'undefined') return false;
  if (readNeedsProfileCreate()) return false;
  if (localStorage.getItem('profile_completed') === 'true') return true;
  try {
    const raw = localStorage.getItem('customerData');
    if (!raw) return false;
    const p = JSON.parse(raw) as { id?: string; name?: string; full_name?: string };
    const phone = (localStorage.getItem('customerPhone') || '').replace(/\D/g, '').slice(-4);
    const name = String(p.name || p.full_name || '').trim();
    if (!p.id || !name) return false;
    if (name === `Customer ${phone}`) return false;
    return true;
  } catch {
    return false;
  }
}

export function readOnboardingCompleted(): boolean {
  if (typeof window === 'undefined') return false;
  if (localStorage.getItem('onboarding_completed') === 'true') return true;
  if (localStorage.getItem('customerOnboardingComplete') === 'true') return true;
  // Profile creation is enough; do not send users through stage selection.
  if (readProfileCompleted()) return true;
  // Cached unified profile (e.g. right after password login before async home refresh)
  try {
    const raw = localStorage.getItem('customerData');
    if (!raw) return false;
    const p = JSON.parse(raw) as Record<string, unknown>;
    const onboardingStatus = String(p.onboarding_status || p.onboardingStatus || '');
    const profileCompletedFlag =
      p.profile_completed === true || p.onboardingComplete === true;
    if (onboardingStatus === 'COMPLETED' || profileCompletedFlag) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * After OTP/login: send new customers to profile creation before resuming checkout/booking.
 * Existing users with a completed profile pass through to `intendedPath`.
 */
export function resolvePostAuthRedirectPath(intendedPath: string | null | undefined): string {
  const fallback = '/';
  const safe =
    intendedPath && intendedPath.startsWith('/') ? intendedPath : fallback;

  if (typeof window === 'undefined') return safe;
  if (readProfileCompleted()) return safe;

  if (safe === '/profile' || safe.startsWith('/profile?')) return safe;
  if (safe === '/' || safe.startsWith('/?')) return '/profile';

  return `/profile?next=${encodeURIComponent(safe)}`;
}

/**
 * Home restore must wait until profile creation finishes.
 * Consuming the snapshot while still on `/` (isGuest flip) then navigating
 * to /profile leaves new customers on Home with no journey left.
 */
export function shouldRestoreGuestJourneyOnHome(): boolean {
  if (typeof window === 'undefined') return false;
  if (!readGuestBookingIntent()) return false;
  return readProfileCompleted();
}

/** After profile creation: pending journey / next= beats generic Home. */
export function resolvePostProfileRedirectPath(
  nextParam?: string | null,
  intent?: GuestBookingIntentV1 | null
): string {
  if (nextParam && nextParam.startsWith('/')) return nextParam;
  const pending = intent ?? (typeof window !== 'undefined' ? readGuestBookingIntent() : null);
  if (pending && transactionRequiresPet(pending) && pending.kind === 'add_pet') {
    return '/?open=add-pet';
  }
  if (pending?.returnPath && pending.returnPath.startsWith('/')) {
    return pending.returnPath;
  }
  return '/';
}
