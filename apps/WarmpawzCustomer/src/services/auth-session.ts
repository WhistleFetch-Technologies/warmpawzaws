/**
 * Persistent customer auth session for the React Native app.
 *
 * Designed to support the product requirement that a customer who logs in
 * remains logged in for a minimum of 90 days unless they explicitly tap
 * "logout". The backend already issues:
 *   - access_token / id_token: ~24 h
 *   - refresh_token:           90 days
 * So the only work the client must do is:
 *   1. Persist the full token bundle (not just the access token) at login.
 *   2. Restore the bundle on cold start (App.tsx).
 *   3. Silently refresh the access token via POST /auth/refresh whenever it
 *      expires but the 90-day refresh window is still open.
 *   4. NEVER drop the session on transient network or server errors — only
 *      drop it when (a) the user taps logout, or (b) the refresh endpoint
 *      conclusively says the refresh token is invalid/expired.
 *
 * Legacy storage keys (`warmpawz_session_token`, `@warmpawz_auth_token`) are
 * still written/read so the rest of the app keeps working untouched.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/aws';

const K = {
  accessToken: 'wp_customer_access_token',
  idToken: 'wp_customer_id_token',
  refreshToken: 'wp_customer_refresh_token',
  accessExpMs: 'wp_customer_access_exp_ms',
  refreshWindowExpMs: 'wp_customer_refresh_window_exp_ms',
  phone: 'wp_customer_phone',
  customerId: 'wp_customer_id',
  customerData: 'wp_customer_data',
  hasCompletedOnboarding: 'wp_customer_onboarding_done',
  hasPets: 'wp_customer_has_pets',
  isNewUser: 'wp_customer_is_new_user',
  /** Legacy single-token slot kept in sync so older call-sites still work. */
  legacySessionToken: 'warmpawz_session_token',
  legacyAuthToken: '@warmpawz_auth_token',
  legacyCustomerPhone: '@warmpawz_customer_phone',
  legacyCustomerId: '@warmpawz_customer_id',
} as const;

const REFRESH_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const REFRESH_LEEWAY_MS = 60 * 1000;

export type CustomerStoredSession = {
  phone: string;
  customerId?: string;
  customer?: any;
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  accessExpMs?: number;
  refreshWindowExpMs?: number;
  hasCompletedOnboarding?: boolean;
  hasPets?: boolean;
  isNewUser?: boolean;
};

export type VerifyOtpLikeResponse = {
  success?: boolean;
  verified?: boolean;
  data?: any;
  token?: any;
  user?: any;
  profile?: any;
  customer?: any;
  sessionToken?: string;
  accessToken?: string;
  idToken?: string;
  refreshToken?: string;
  expiresIn?: number;
};

/** Read `exp` (seconds) from a JWT payload; null when token is opaque or malformed. */
function jwtExpMs(token: string | undefined | null): number | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
    const json = decodeBase64(base64 + pad);
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp !== 'number') return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

/** Minimal base64 decode that works in RN (no atob). */
function decodeBase64(b64: string): string {
  if (typeof globalThis.atob === 'function') {
    return globalThis.atob(b64);
  }
  const Buf = (globalThis as any).Buffer;
  if (Buf && typeof Buf.from === 'function') {
    return Buf.from(b64, 'base64').toString('utf8');
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < b64.length; i++) {
    const c = b64.charAt(i);
    if (c === '=') break;
    const idx = chars.indexOf(c);
    if (idx === -1) continue;
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return out;
}

function pickTokensFromResponse(response: VerifyOtpLikeResponse): {
  accessToken?: string;
  idToken?: string;
  refreshToken?: string;
  expiresIn?: number;
} {
  if (!response || typeof response !== 'object') return {};
  const outerData = (response as any).data;
  const innerData = outerData && (outerData as any).data;
  const tokenContainer =
    (innerData && (innerData.token || innerData.tokens)) ||
    (outerData && (outerData.token || outerData.tokens)) ||
    (response as any).token ||
    (response as any).tokens ||
    response;

  if (!tokenContainer || typeof tokenContainer !== 'object') return {};

  const accessToken =
    tokenContainer.access_token ||
    tokenContainer.accessToken ||
    (response as any).accessToken ||
    (response as any).sessionToken;
  const idToken = tokenContainer.id_token || tokenContainer.idToken || (response as any).idToken;
  const refreshToken =
    tokenContainer.refresh_token || tokenContainer.refreshToken || (response as any).refreshToken;
  const expiresIn =
    tokenContainer.expires_in || tokenContainer.expiresIn || (response as any).expiresIn || undefined;

  return {
    accessToken: typeof accessToken === 'string' ? accessToken : undefined,
    idToken: typeof idToken === 'string' ? idToken : undefined,
    refreshToken: typeof refreshToken === 'string' ? refreshToken : undefined,
    expiresIn: typeof expiresIn === 'number' ? expiresIn : undefined,
  };
}

function pickUserFromResponse(response: VerifyOtpLikeResponse): any {
  const outerData = (response as any).data;
  const innerData = outerData && (outerData as any).data;
  const userBlock =
    (innerData && (innerData.user || innerData.profile || innerData.customer)) ||
    (outerData && (outerData.user || outerData.profile || outerData.customer)) ||
    (response as any).user ||
    (response as any).profile ||
    (response as any).customer ||
    null;
  return userBlock;
}

async function multiSet(pairs: Array<[string, string | null | undefined]>): Promise<void> {
  const writes: Array<[string, string]> = [];
  const removes: string[] = [];
  for (const [key, value] of pairs) {
    if (value === null || value === undefined || value === '') {
      removes.push(key);
    } else {
      writes.push([key, value]);
    }
  }
  if (writes.length > 0) {
    await AsyncStorage.multiSet(writes);
  }
  if (removes.length > 0) {
    await AsyncStorage.multiRemove(removes);
  }
}

/**
 * Persist a successful login response. `isNewLogin` resets the 90-day refresh window —
 * call with `true` only on a fresh OTP / password login so silent refreshes never
 * shorten the user's session.
 */
export async function saveCustomerLoginResponse(
  response: VerifyOtpLikeResponse,
  opts: {
    phone: string;
    isNewLogin: boolean;
    isNewUser?: boolean;
    hasCompletedOnboarding?: boolean;
    hasPets?: boolean;
  }
): Promise<CustomerStoredSession | null> {
  const { phone, isNewLogin } = opts;
  if (!phone) return null;

  const tokens = pickTokensFromResponse(response);
  const userBlock = pickUserFromResponse(response);

  if (!tokens.accessToken) {
    // We can still keep a phone-only session so the app doesn't kick users out
    // in UAT / legacy flows that don't return JWTs. Authorisation calls will
    // continue working as they do today (Bearer header is just empty).
    await multiSet([
      [K.phone, phone],
      [K.legacyCustomerPhone, phone],
    ]);
    return null;
  }

  const now = Date.now();
  const accessExpFromJwt = jwtExpMs(tokens.accessToken);
  const accessExp =
    accessExpFromJwt ?? (tokens.expiresIn ? now + tokens.expiresIn * 1000 : now + 24 * 60 * 60 * 1000);

  let refreshExp = isNewLogin
    ? now + REFRESH_WINDOW_MS
    : Number((await AsyncStorage.getItem(K.refreshWindowExpMs)) || '') || now + REFRESH_WINDOW_MS;

  // If we have a JWT refresh token, never claim a longer life than its own `exp`.
  if (tokens.refreshToken) {
    const refreshExpFromJwt = jwtExpMs(tokens.refreshToken);
    if (refreshExpFromJwt && refreshExpFromJwt < refreshExp) {
      refreshExp = refreshExpFromJwt;
    }
  }

  const customerId =
    (userBlock && (userBlock.id || userBlock.customerId || userBlock.customer_id)) || undefined;

  await multiSet([
    [K.accessToken, tokens.accessToken],
    [K.idToken, tokens.idToken],
    [K.refreshToken, tokens.refreshToken],
    [K.accessExpMs, String(accessExp)],
    [K.refreshWindowExpMs, String(refreshExp)],
    [K.phone, phone],
    [K.customerId, customerId],
    [K.customerData, userBlock ? JSON.stringify(userBlock) : null],
    [K.hasCompletedOnboarding, opts.hasCompletedOnboarding ? 'true' : 'false'],
    [K.hasPets, opts.hasPets ? 'true' : 'false'],
    [K.isNewUser, opts.isNewUser ? 'true' : 'false'],
    // Legacy slots so the existing API service code still finds a Bearer token.
    [K.legacySessionToken, tokens.accessToken],
    [K.legacyAuthToken, tokens.idToken || tokens.accessToken],
    [K.legacyCustomerPhone, phone],
    [K.legacyCustomerId, customerId],
  ]);

  return {
    phone,
    customerId,
    customer: userBlock || undefined,
    accessToken: tokens.accessToken,
    idToken: tokens.idToken,
    refreshToken: tokens.refreshToken,
    accessExpMs: accessExp,
    refreshWindowExpMs: refreshExp,
    hasCompletedOnboarding: !!opts.hasCompletedOnboarding,
    hasPets: !!opts.hasPets,
    isNewUser: !!opts.isNewUser,
  };
}

/** Load whatever we persisted previously. Returns null when nothing is stored. */
export async function loadStoredCustomerSession(): Promise<CustomerStoredSession | null> {
  const keys = [
    K.accessToken,
    K.idToken,
    K.refreshToken,
    K.accessExpMs,
    K.refreshWindowExpMs,
    K.phone,
    K.customerId,
    K.customerData,
    K.hasCompletedOnboarding,
    K.hasPets,
    K.isNewUser,
    K.legacySessionToken,
    K.legacyCustomerPhone,
  ] as const;

  let entries: readonly [string, string | null][];
  try {
    entries = await AsyncStorage.multiGet(keys as unknown as string[]);
  } catch (e) {
    console.warn('[auth-session] multiGet failed:', e);
    return null;
  }
  const map = new Map<string, string | null>(entries as any);

  const accessToken = map.get(K.accessToken) || map.get(K.legacySessionToken) || null;
  const phone = map.get(K.phone) || map.get(K.legacyCustomerPhone) || null;

  if (!accessToken || !phone) return null;

  const accessExpMs = Number(map.get(K.accessExpMs) || '') || undefined;
  const refreshWindowExpMs = Number(map.get(K.refreshWindowExpMs) || '') || undefined;

  // Session is only considered "lost" when the refresh window has elapsed AND
  // we don't have a still-valid access token. Anything inside the 90-day
  // window is restorable.
  const now = Date.now();
  const refreshWindowOpen = !refreshWindowExpMs || now < refreshWindowExpMs;
  const accessStillValid = !accessExpMs || now < accessExpMs - REFRESH_LEEWAY_MS;
  if (!refreshWindowOpen && !accessStillValid) {
    return null;
  }

  let customer: any = undefined;
  try {
    const raw = map.get(K.customerData);
    if (raw) customer = JSON.parse(raw);
  } catch {
    /* ignore */
  }

  return {
    phone,
    customerId: map.get(K.customerId) || undefined,
    customer,
    accessToken,
    idToken: map.get(K.idToken) || undefined,
    refreshToken: map.get(K.refreshToken) || undefined,
    accessExpMs,
    refreshWindowExpMs,
    hasCompletedOnboarding: map.get(K.hasCompletedOnboarding) === 'true',
    hasPets: map.get(K.hasPets) === 'true',
    isNewUser: map.get(K.isNewUser) === 'true',
  };
}

let inFlightRefresh: Promise<string | null> | null = null;

/**
 * Returns a usable access token if one exists (refreshing it silently when
 * close to expiry).  Returns `null` only when there is no stored session at
 * all OR the 90-day refresh window has elapsed AND the access token is
 * already expired.
 *
 * `network failures` deliberately return the current (possibly stale) access
 * token so calls don't auto-logout on flaky connectivity.
 */
export async function getValidCustomerAccessToken(): Promise<string | null> {
  const session = await loadStoredCustomerSession();
  if (!session) return null;

  const now = Date.now();
  const accessExpMs = session.accessExpMs ?? Infinity;
  const refreshExpMs = session.refreshWindowExpMs ?? Infinity;

  if (now < accessExpMs - REFRESH_LEEWAY_MS) {
    return session.accessToken;
  }

  if (!session.refreshToken || now >= refreshExpMs) {
    // No refresh available — return whatever we have so callers can still try
    // (server will respond with 401 if truly invalid; handler will fall back).
    return session.accessToken;
  }

  if (!inFlightRefresh) {
    inFlightRefresh = (async () => {
      try {
        const renewed = await refreshCustomerTokens(session.refreshToken!);
        return renewed?.accessToken || session.accessToken;
      } catch {
        return session.accessToken;
      } finally {
        inFlightRefresh = null;
      }
    })();
  }
  return inFlightRefresh;
}

/**
 * Call `POST /auth/refresh` with the stored refresh token. Updates the
 * persisted access/id tokens on success. On a conclusive 401 (refresh
 * rejected) clears the session — but only then.
 */
export async function refreshCustomerTokens(
  refreshToken?: string
): Promise<{ accessToken: string; idToken?: string; accessExpMs: number } | null> {
  let token = refreshToken;
  if (!token) {
    token = (await AsyncStorage.getItem(K.refreshToken)) || undefined;
  }
  if (!token) return null;

  const url = `${API_BASE_URL.replace(/\/+$/, '')}/auth/refresh`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token }),
    });
  } catch (e) {
    // Network failure: keep the session, just leave the stale access token
    // in place. The next call will retry transparently.
    if (__DEV__) console.warn('[auth-session] refresh network error (keeping session):', e);
    return null;
  }

  if (response.status === 401) {
    // The refresh token was rejected — only now do we drop the session.
    if (__DEV__) console.warn('[auth-session] refresh rejected by server (401) — clearing session');
    await clearCustomerSession();
    return null;
  }

  if (!response.ok) {
    if (__DEV__) console.warn('[auth-session] refresh non-OK status:', response.status);
    return null;
  }

  let body: any = null;
  try {
    body = await response.json();
  } catch {
    return null;
  }

  const newAccess = body?.accessToken || body?.access_token;
  const newId = body?.idToken || body?.id_token;
  const expiresIn = body?.expiresIn || body?.expires_in || 24 * 60 * 60;

  if (!newAccess || typeof newAccess !== 'string') return null;

  const accessExpMs = jwtExpMs(newAccess) ?? Date.now() + expiresIn * 1000;
  await multiSet([
    [K.accessToken, newAccess],
    [K.idToken, typeof newId === 'string' ? newId : null],
    [K.accessExpMs, String(accessExpMs)],
    [K.legacySessionToken, newAccess],
    [K.legacyAuthToken, typeof newId === 'string' ? newId : newAccess],
  ]);
  return { accessToken: newAccess, idToken: typeof newId === 'string' ? newId : undefined, accessExpMs };
}

/** Public — only the user "tap logout" path should call this. */
export async function clearCustomerSession(): Promise<void> {
  await AsyncStorage.multiRemove([
    K.accessToken,
    K.idToken,
    K.refreshToken,
    K.accessExpMs,
    K.refreshWindowExpMs,
    K.phone,
    K.customerId,
    K.customerData,
    K.hasCompletedOnboarding,
    K.hasPets,
    K.isNewUser,
    K.legacySessionToken,
    K.legacyAuthToken,
    K.legacyCustomerPhone,
    K.legacyCustomerId,
  ]);
}

/** True when we have *any* restorable session (active OR refresh window open). */
export async function hasRestorableCustomerSession(): Promise<boolean> {
  return (await loadStoredCustomerSession()) !== null;
}

export const CustomerSessionStorageKeys = K;
