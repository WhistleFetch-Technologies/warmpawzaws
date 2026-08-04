/**
 * Session Management Utilities for Vendor Web
 */

import { getCognitoTokens, isAuthenticated } from './cognito-auth';

export function isHardRefresh(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const perfEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (perfEntries.length > 0 && perfEntries[0].type === 'reload') {
      const hasToken = !!getStoredVendorJwtForSession();
      console.log(
        `[Vendor Session] Reload detected (hasToken=${hasToken}) — keeping session; refresh-token flow will renew expired access tokens automatically.`,
      );
    }
  } catch {
    /* Performance API unavailable */
  }

  return false;
}

export function clearVendorSession(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem('vendorPhone');
  localStorage.removeItem('vendorId');
  localStorage.removeItem('authToken');
  localStorage.removeItem('vendorSessionToken');
  localStorage.removeItem('vendorAuthToken');
  localStorage.removeItem('vendorData');
  localStorage.removeItem('vendorUser');
  localStorage.removeItem('vendorApplicationStatus');
  localStorage.removeItem('vendorRole');
  localStorage.removeItem('vendorName');
  localStorage.removeItem('businessName');
  localStorage.removeItem('vendorCountryCode');

  localStorage.removeItem('vendorCognitoTokens');
  localStorage.removeItem('vendorTokenExpiry');
  localStorage.removeItem('vendorRefreshTokenExpiry');
  localStorage.removeItem('cognitoAccessToken');
  localStorage.removeItem('cognitoIdToken');
  localStorage.removeItem('cognitoRefreshToken');

  sessionStorage.removeItem('_warmpawz_vendor_has_session');
  sessionStorage.removeItem('_warmpawz_vendor_just_logged_in');
  sessionStorage.removeItem('_warmpawz_vendor_login_at');
  sessionStorage.removeItem('_warmpawz_vendor_session_cleared');
  sessionStorage.removeItem('_vendor_redirected_to_auth');

  try {
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith('vendor_capabilities_')) {
        sessionStorage.removeItem(key);
      }
    });
  } catch {
    /* ignore */
  }
}

export async function signOutVendor(): Promise<void> {
  if (typeof window === 'undefined') return;
  const raw = localStorage.getItem('vendorId')?.trim() || '';
  const userId = /^[0-9a-f-]{36}$/i.test(raw) ? raw : null;
  if (userId) {
    const { teardownPushNotifications } = await import('./push-bootstrap');
    await teardownPushNotifications({ userId, userType: 'vendor' });
  }
  clearVendorSession();
}

/**
 * JWT for bootstrap — reads active Cognito id token or legacy authToken even when access expiry passed locally.
 */
export function getStoredVendorJwtForSession(): string | null {
  if (typeof window === 'undefined') return null;
  const c = getCognitoTokens();
  if (c?.idToken) return c.idToken;
  if (c?.accessToken) return c.accessToken;
  return (
    localStorage.getItem('authToken') ||
    localStorage.getItem('vendorSessionToken') ||
    localStorage.getItem('vendorAuthToken')
  );
}

/** True when phone + credentials exist and the 90-day refresh window (or valid access token) allows recovery. */
export function hasRecoverableVendorSession(): boolean {
  if (typeof window === 'undefined') return false;
  const phone = localStorage.getItem('vendorPhone');
  if (!phone) return false;

  const token = getStoredVendorJwtForSession();
  if (token && token.length >= 10 && !isTokenExpired(token)) return true;

  return isAuthenticated();
}

export function isStaleTempVendorSession(token: string | null): boolean {
  if (typeof window === 'undefined') return false;
  const vendorId = localStorage.getItem('vendorId');
  const justLoggedIn = sessionStorage.getItem('_warmpawz_vendor_just_logged_in');
  if (!vendorId || !vendorId.startsWith('temp_vendor_')) return false;
  if (justLoggedIn === 'true') return false;
  if (token && token.length >= 10 && !isTokenExpired(token)) return false;
  if (hasRecoverableVendorSession()) return false;
  return true;
}

export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;

  try {
    if (token.startsWith('staff_session_') || token.startsWith('staff_refresh_')) {
      const parts = token.split('_');
      if (parts.length >= 3) {
        const timestamp = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(timestamp)) {
          return Date.now() - timestamp > 24 * 60 * 60 * 1000;
        }
      }
      return false;
    }

    if (token.startsWith('fallback_')) {
      try {
        const payloadPart = token.replace('fallback_', '').split('.')[0];
        const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(base64));
        if (payload.timestamp) {
          return Date.now() - payload.timestamp > 60 * 60 * 1000;
        }
      } catch {
        return false;
      }
      return false;
    }

    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const base64Payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padding = base64Payload.length % 4 ? '='.repeat(4 - (base64Payload.length % 4)) : '';
    const payload = JSON.parse(atob(base64Payload + padding));
    if (!payload.exp) return false;

    return payload.exp < Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function initializeSession(): void {
  if (typeof window === 'undefined') return;

  isHardRefresh();

  const wasCleared = sessionStorage.getItem('_warmpawz_vendor_session_cleared');
  if (wasCleared === 'true') {
    sessionStorage.removeItem('_warmpawz_vendor_session_cleared');
  }

  const token = getStoredVendorJwtForSession();
  if (token && isTokenExpired(token) && hasRecoverableVendorSession()) {
    import('./cognito-auth').then(({ refreshVendorTokensIfNeeded }) => {
      refreshVendorTokensIfNeeded().catch(() => {
        /* transient — next API call retries */
      });
    });
  }
}

/**
 * Attempt silent refresh. Returns true when session is recoverable (including after transient refresh failure).
 */
export async function restoreVendorSessionIfRefreshable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (!hasRecoverableVendorSession()) return false;

  const token = getStoredVendorJwtForSession();
  if (token && !isTokenExpired(token)) return true;

  try {
    const { refreshVendorTokensWithOutcome } = await import('./cognito-auth');
    const out = await refreshVendorTokensWithOutcome();
    if (out.kind === 'renewed' || out.kind === 'unchanged') return true;
    if (out.kind === 'failed_network') return hasRecoverableVendorSession();
    return false;
  } catch {
    return hasRecoverableVendorSession();
  }
}

/**
 * Shared gate for protected pages: redirect to /auth only when session is not recoverable.
 */
export async function requireVendorSessionOrRedirect(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const phone = localStorage.getItem('vendorPhone');
  const token = getStoredVendorJwtForSession();

  if (!phone || !token || token.length < 10) {
    if (!hasRecoverableVendorSession()) {
      clearVendorSession();
      window.location.replace('/auth');
      return false;
    }
  }

  if (isStaleTempVendorSession(token)) {
    clearVendorSession();
    window.location.replace('/auth');
    return false;
  }

  const ok = await restoreVendorSessionIfRefreshable();
  if (!ok) {
    clearVendorSession();
    window.location.replace('/auth');
    return false;
  }

  return true;
}
