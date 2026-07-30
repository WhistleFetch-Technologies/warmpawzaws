/**
 * ============================================================================
 * AWS COGNITO AUTHENTICATION - FRONTEND
 * ============================================================================
 * 
 * Handles Cognito authentication for Vendor Web app
 * Integrates with backend Lambda endpoints that use Cognito
 * 
 * Date: 2026-01-06
 * ============================================================================
 */

export interface CognitoTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
}

const TOKEN_STORAGE_KEY = 'vendorCognitoTokens';
const USER_STORAGE_KEY = 'vendorUser';

export function storeCognitoTokens(tokens: CognitoTokens): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
    const expiryTime = Date.now() + (tokens.expiresIn * 1000);
    localStorage.setItem('vendorTokenExpiry', expiryTime.toString());
    // Only set the 90-day refresh token expiry on fresh login; silent refreshes must not overwrite it.
    if (!localStorage.getItem('vendorRefreshTokenExpiry')) {
      localStorage.setItem('vendorRefreshTokenExpiry', (Date.now() + 90 * 24 * 60 * 60 * 1000).toString());
    }
  }
}

export function getCognitoTokens(): CognitoTokens | null {
  if (typeof window === 'undefined') return null;
  
  const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!stored) return null;
  
  try {
    const tokens = JSON.parse(stored);
    const expiryTime = localStorage.getItem('vendorTokenExpiry');
    if (expiryTime && Date.now() > parseInt(expiryTime, 10)) {
      // Access token is expired — do NOT clear storage here.
      // The refresh token may still be within its 90-day window.
      // refreshVendorTokensIfNeeded() decides whether to refresh or clear.
      return null;
    }
    return tokens;
  } catch {
    return null;
  }
}

export function getCognitoIdToken(): string | null {
  const tokens = getCognitoTokens();
  return tokens?.idToken || null;
}

export function clearCognitoTokens(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem('vendorTokenExpiry');
    localStorage.removeItem('vendorRefreshTokenExpiry');
    localStorage.removeItem(USER_STORAGE_KEY);
  }
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  // Active access token — definitely authenticated.
  if (getCognitoTokens() !== null) return true;
  // Access token expired but refresh token window still open — treat as authenticated;
  // the next API call will silently renew the access token.
  const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!stored) return false;
  const refreshExpiry = localStorage.getItem('vendorRefreshTokenExpiry');
  return !!refreshExpiry && Date.now() < parseInt(refreshExpiry, 10);
}

export function storeUserInfo(user: any): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }
}

export function getUserInfo(): any | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(USER_STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Transparently refreshes the vendor access token when it is expired but the 90-day
 * refresh token window is still open.  Returns the (possibly updated) token bundle,
 * or null when the session is fully expired and the vendor must log in again.
 *
 * Safe to call on every API request — short-circuits immediately when still valid.
 *
 * Pass `{ force: true }` to bypass the local "still valid" short-circuit (used by
 * the 401 retry path: the server has rejected the access token even though we
 * locally think it's fresh, e.g. after a backend deploy or clock skew).
 */
export async function refreshVendorTokensIfNeeded(
  opts?: { force?: boolean },
): Promise<CognitoTokens | null> {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!stored) return null;

  let tokens: CognitoTokens;
  try {
    tokens = JSON.parse(stored);
  } catch {
    return null;
  }

  const expiryTime = localStorage.getItem('vendorTokenExpiry');
  // Access token still valid AND caller didn't force — return as-is.
  if (!opts?.force && expiryTime && Date.now() < parseInt(expiryTime, 10)) return tokens;

  // Access token expired (or caller wants a fresh one) — check whether the
  // 90-day refresh window is still open.
  const refreshExpiry = localStorage.getItem('vendorRefreshTokenExpiry');
  if (!refreshExpiry || Date.now() > parseInt(refreshExpiry, 10)) {
    clearCognitoTokens();
    return null;
  }

  if (!tokens.refreshToken) {
    clearCognitoTokens();
    return null;
  }

  try {
    const { getApiBaseUrl } = await import('./api-client');
    const base = getApiBaseUrl().replace(/\/+$/, '');
    if (!base) {
      if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
        console.warn('[vendor-auth] refresh skipped: API base URL not configured');
      }
      return null;
    }

    const res = await fetch(`${base}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });

    if (!res.ok) {
      // Only drop credentials when the server CONCLUSIVELY rejects the
      // refresh token (400/401). 403 is often CloudFront/static-host infra.
      const isAuthFailure = res.status === 400 || res.status === 401;
      if (isAuthFailure) {
        clearCognitoTokens();
      } else if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
        console.warn('[vendor-auth] refresh non-auth failure — keeping session:', res.status);
      }
      return null;
    }

    const newData = await res.json();
    const newAccess =
      typeof newData.accessToken === 'string'
        ? newData.accessToken
        : typeof newData.access_token === 'string'
          ? newData.access_token
          : undefined;
    const newId =
      typeof newData.idToken === 'string'
        ? newData.idToken
        : typeof newData.id_token === 'string'
          ? newData.id_token
          : undefined;
    const rawExpires = newData.expiresIn ?? newData.expires_in;
    const newExpires =
      typeof rawExpires === 'number'
        ? rawExpires
        : typeof rawExpires === 'string' && rawExpires.trim() !== ''
          ? Number(rawExpires)
          : undefined;

    if (typeof newAccess !== 'string' || typeof newId !== 'string' || !Number.isFinite(newExpires)) {
      clearCognitoTokens();
      return null;
    }

    const updated: CognitoTokens = {
      ...tokens,
      accessToken: newAccess,
      idToken: newId,
      expiresIn: newExpires as number,
    };

    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(updated));
    const newExpiry = Date.now() + (newExpires as number) * 1000;
    localStorage.setItem('vendorTokenExpiry', newExpiry.toString());
    // Do NOT touch vendorRefreshTokenExpiry — the 90-day clock must not reset on silent refresh.

    return updated;
  } catch (e) {
    // Network error — never log the user out on a flaky connection. The next
    // authenticated API call will retry the refresh.
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
      console.warn('[vendor-auth] refresh network error — keeping session:', e);
    }
    return null;
  }
}

