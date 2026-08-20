/**
 * Session Management Utilities
 * Handles session persistence, expiry, and hard refresh detection
 */

import { ensureCustomerIdStorageReconciledOnce } from './customer-id-storage';
import { getCognitoTokens, clearCognitoTokens } from './cognito-auth';
import { clearCachedPetsForPhone } from './customer-pets-cache';
import { clearCheckoutAddressId } from './ecommerce/checkout-address-storage';
import { isGuestBrowsingEnabled } from './guest-browsing-flag';

/** After OTP, customer must set password before treating login as complete (first-time / legacy OTP-only). */
export const SESSION_KEY_NEEDS_PASSWORD_SETUP = 'warmpawz_needs_password_setup';

export function setNeedsPasswordSetupAfterOtp(): void {
  if (typeof window !== 'undefined') sessionStorage.setItem(SESSION_KEY_NEEDS_PASSWORD_SETUP, '1');
}

export function clearNeedsPasswordSetup(): void {
  if (typeof window !== 'undefined') sessionStorage.removeItem(SESSION_KEY_NEEDS_PASSWORD_SETUP);
}

export function needsPasswordSetupAfterOtp(): boolean {
  return typeof window !== 'undefined' && sessionStorage.getItem(SESSION_KEY_NEEDS_PASSWORD_SETUP) === '1';
}

/** Prefer Cognito bundle (`customerCognitoTokens`), then legacy `authToken` / `cognitoAccessToken`. */
export function getStoredCustomerJwtForSession(): string | null {
  if (typeof window === 'undefined') return null;
  const c = getCognitoTokens();
  if (c?.idToken) return c.idToken;
  if (c?.accessToken) return c.accessToken;
  return localStorage.getItem('authToken') || localStorage.getItem('cognitoAccessToken');
}

/**
 * Whether the current page load is a "hard refresh" (F5 / Ctrl-R / browser
 * reload button).
 *
 * IMPORTANT: This used to clear the customer's session on every hard refresh
 * when an auth token was already present — which kicked users out frequently,
 * especially after every deploy. With the 90-day persistent-login requirement
 * we no longer clear on reload. The token-refresh path (`cognito-auth.ts`)
 * already handles short-lived access tokens by silently exchanging the
 * refresh token whenever the access/id token is close to expiry, so a reload
 * never needs to drop credentials.
 *
 * The function is retained (and still detects reloads) so callers can branch
 * on the navigation type, but it always returns `false` to match the product
 * requirement that "logout should only happen when the user explicitly taps
 * Logout".
 */
export function isHardRefresh(): boolean {
  if (typeof window === 'undefined') return false;

  // Best-effort logging only — never clear the session here.
  try {
    const perfEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (perfEntries.length > 0) {
      const navType = perfEntries[0].type;
      const hasToken = !!getStoredCustomerJwtForSession();
      if (navType === 'reload') {
        console.log(
          `[Session] Reload detected (hasToken=${hasToken}) — keeping session; refresh-token flow will renew expired access tokens automatically.`,
        );
      }
    }
  } catch {
    /* Performance API unavailable — nothing to do. */
  }

  return false;
}

const PAYMENT_METHODS_LS_PREFIX = 'warmpawz_payments_v2_';
const LAST_PET_SESSION_PREFIX = 'warmpawz_last_pet_';
const HOME_SESSION_PREFIX = 'warmpawz_home_';
const HOME_GUEST_PREFIX = 'warmpawz_home_guest_';
const HOME_GLOBAL_TRENDING_KEY = 'warmpawz_home_global_trending';

let customerQueryClientReset: (() => void) | null = null;

/** Smallest existing cache hook — Providers registers QueryClient.clear(). */
export function registerCustomerQueryClientReset(reset: (() => void) | null): void {
  customerQueryClientReset = reset;
}

function removeStorageKeysByPrefix(
  storage: Storage,
  prefix: string,
  keep?: (key: string) => boolean
): void {
  const toRemove: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && key.startsWith(prefix) && (!keep || !keep(key))) {
      toRemove.push(key);
    }
  }
  for (const key of toRemove) {
    storage.removeItem(key);
  }
}

function departingCustomerPhone(): string {
  return (
    localStorage.getItem('customerPhone') ||
    localStorage.getItem('customer_phone') ||
    localStorage.getItem('phone') ||
    ''
  );
}

/**
 * After JWT teardown, send the user to guest Marketplace when browsing is on.
 * Auth-required mode keeps the existing /auth destination.
 */
export function getPostLogoutHref(): string {
  return isGuestBrowsingEnabled() ? '/' : '/auth';
}

/**
 * Clear customer authentication and customer-scoped runtime state.
 * Targeted key removal only — guest cart, location, and anonymous_id stay.
 */
export function clearCustomerSession(): void {
  if (typeof window === 'undefined') return;

  const phone = departingCustomerPhone();

  try {
    clearCognitoTokens();
  } catch {
    /* ignore */
  }

  localStorage.removeItem('customerPhone');
  localStorage.removeItem('customerId');
  localStorage.removeItem('customer_id');
  localStorage.removeItem('warmpawz_customer_id');
  localStorage.removeItem('authToken');
  localStorage.removeItem('customerData');
  localStorage.removeItem('customerProfile');
  localStorage.removeItem('customerPets');
  localStorage.removeItem('customerPetsOwnerPhone');
  clearCachedPetsForPhone();
  localStorage.removeItem('customerOnboardingComplete');
  localStorage.removeItem('onboarding_completed');
  localStorage.removeItem('profile_completed');
  localStorage.removeItem('customerJourneyStage');

  localStorage.removeItem('cognitoAccessToken');
  localStorage.removeItem('cognitoIdToken');
  localStorage.removeItem('cognitoRefreshToken');
  localStorage.removeItem('cognitoTokenExpiry');
  localStorage.removeItem('cognitoUserInfo');
  localStorage.removeItem('customerRefreshTokenExpiry');
  localStorage.removeItem('customerTokenExpiry');
  localStorage.removeItem('customerCognitoTokens');
  localStorage.removeItem('customerUser');

  localStorage.removeItem('customer_phone');
  localStorage.removeItem('phone');
  localStorage.removeItem('refreshToken');

  localStorage.removeItem('warmpawz_review_submitted_booking_ids');
  localStorage.removeItem('warmpawz_review_skipped_booking_ids');
  localStorage.removeItem('warmpawz_cust_push_registered_at');
  localStorage.removeItem('warmpawz_cust_push_registered_user_id');

  try {
    removeStorageKeysByPrefix(localStorage, PAYMENT_METHODS_LS_PREFIX);
    if (phone) {
      const digits = phone.replace(/\D/g, '');
      const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
      if (last10) localStorage.removeItem(PAYMENT_METHODS_LS_PREFIX + last10);
    }
  } catch {
    /* ignore */
  }

  try {
    clearCheckoutAddressId();
    removeStorageKeysByPrefix(sessionStorage, LAST_PET_SESSION_PREFIX);
    removeStorageKeysByPrefix(
      sessionStorage,
      HOME_SESSION_PREFIX,
      (key) => key.startsWith(HOME_GUEST_PREFIX) || key === HOME_GLOBAL_TRENDING_KEY
    );
  } catch {
    /* ignore */
  }

  sessionStorage.removeItem('_warmpawz_has_session');
  sessionStorage.removeItem('_warmpawz_just_logged_in');
  sessionStorage.removeItem(SESSION_KEY_NEEDS_PASSWORD_SETUP);

  try {
    const { stripAuthFromGuestJourneySnapshots } = require('./guest-booking-intent');
    stripAuthFromGuestJourneySnapshots();
  } catch {
    /* ignore */
  }

  try {
    const { resetHomeBootstrapForPhone } = require('./customer-home-bootstrap');
    resetHomeBootstrapForPhone(null);
  } catch {
    /* ignore */
  }

  try {
    customerQueryClientReset?.();
  } catch {
    /* ignore */
  }
}

/**
 * Sign out: unregister push device, then clear session.
 * Call from explicit logout handlers (not stale-session cleanup on page load).
 */
export async function signOutCustomer(): Promise<void> {
  if (typeof window === 'undefined') return;
  const { getResolvedCustomerId } = await import('./customer-id-storage');
  const userId = getResolvedCustomerId();
  if (userId) {
    const { teardownPushNotifications } = await import('./push-bootstrap');
    await teardownPushNotifications({ userId, userType: 'customer' });
  }
  clearCustomerSession();
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  
  // UAT tokens are always valid (they don't expire)
  // Format: uat-token-customer-{timestamp} or uat-token-vendor-{timestamp}
  if (token.startsWith('uat-token-')) {
    return false;
  }
  
  try {
    // Decode JWT token to check expiry
    const parts = token.split('.');
    if (parts.length !== 3) return true; // Not a valid JWT
    
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return true;
    
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  } catch (error) {
    // If we can't decode, assume expired
    return true;
  }
}

/**
 * Initialize session.
 *
 * MUST be called synchronously before any component logic.
 *
 * Behaviour change (90-day persistent login):
 *   - We NEVER clear the session here. Reloads, deploys and new tabs simply
 *     restore whatever is in `localStorage` and kick off a silent refresh if
 *     the access/id token has expired.
 *   - The only path that clears the session is `clearCustomerSession()` (used
 *     by the explicit logout flow).
 *   - If the refresh token itself has expired or the server rejects it, the
 *     refresh helper in `cognito-auth.ts` is the one that decides whether to
 *     drop credentials — not this function.
 */
export function initializeSession(): void {
  if (typeof window === 'undefined') return;

  // Best-effort detection only; we deliberately do NOT clear on reload.
  isHardRefresh();

  const wasCleared = sessionStorage.getItem('_warmpawz_session_cleared');
  if (wasCleared === 'true') {
    sessionStorage.removeItem('_warmpawz_session_cleared');
  }

  const token = getStoredCustomerJwtForSession();
  if (token && isTokenExpired(token)) {
    console.log('[Session] Access/id token expired - attempting silent refresh (90-day refresh window)');
    import('./cognito-auth').then(({ refreshCognitoTokensIfNeeded }) => {
      refreshCognitoTokensIfNeeded().catch(() => {
        /* silent refresh failures are swallowed here so we don't kick the user
         * out on a transient error; the next authenticated API call will
         * trigger another refresh attempt. */
      });
    });
  }

  ensureCustomerIdStorageReconciledOnce();
}
