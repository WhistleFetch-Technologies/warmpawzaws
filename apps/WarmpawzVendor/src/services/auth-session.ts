/**
 * Persistent vendor auth session for the React Native app.
 *
 * Mirrors `apps/WarmpawzCustomer/src/services/auth-session.ts`. Designed to
 * support the product requirement that a vendor who logs in remains logged in
 * for a minimum of 90 days unless they explicitly tap "logout". The backend
 * already issues:
 *   - access_token / id_token: ~24 h
 *   - refresh_token:           90 days
 *
 * Responsibilities:
 *   1. Persist the full token bundle (not just the access token) at login.
 *   2. Restore the bundle on cold start (App.tsx).
 *   3. Silently refresh the access token via POST /auth/refresh whenever it
 *      expires but the 90-day refresh window is still open.
 *   4. NEVER drop the session on transient network or server errors — only
 *      drop it when (a) the user taps logout, or (b) the refresh endpoint
 *      conclusively says the refresh token is invalid/expired.
 *
 * Legacy storage keys (`warmpawz_vendor_session_token`,
 * `@warmpawz_vendor_auth_token`) are still written/read so the rest of the
 * vendor app keeps working untouched.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/aws';

const K = {
  accessToken: 'wp_vendor_access_token',
  idToken: 'wp_vendor_id_token',
  refreshToken: 'wp_vendor_refresh_token',
  accessExpMs: 'wp_vendor_access_exp_ms',
  refreshWindowExpMs: 'wp_vendor_refresh_window_exp_ms',
  phone: 'wp_vendor_phone',
  vendorId: 'wp_vendor_id',
  vendorData: 'wp_vendor_data',
  staffId: 'wp_vendor_staff_id',
  role: 'wp_vendor_role',
  /** Legacy slots so existing call-sites keep working. */
  legacySessionToken: 'warmpawz_vendor_session_token',
  legacyAuthToken: '@warmpawz_vendor_auth_token',
  legacyVendorId: '@warmpawz_vendor_id',
  legacyVendorPhone: '@warmpawz_vendor_phone',
  legacyVendorProfile: 'warmpawz_vendor_profile',
  legacyVendorIdPlain: 'warmpawz_vendor_id',
} as const;

const REFRESH_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const REFRESH_LEEWAY_MS = 60 * 1000;

export type VendorStoredSession = {
  phone: string;
  vendorId?: string;
  staffId?: string;
  role?: string;
  vendor?: any;
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  accessExpMs?: number;
  refreshWindowExpMs?: number;
};

export type VerifyOtpLikeResponse = {
  success?: boolean;
  verified?: boolean;
  data?: any;
  token?: any;
  tokens?: any;
  user?: any;
  profile?: any;
  vendor?: any;
  staff?: any;
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
    (innerData && (innerData.token || innerData.tokens || innerData.session)) ||
    (outerData && (outerData.token || outerData.tokens || outerData.session)) ||
    (response as any).token ||
    (response as any).tokens ||
    (response as any).session ||
    response;

  if (!tokenContainer || typeof tokenContainer !== 'object') return {};

  const accessToken =
    tokenContainer.access_token ||
    tokenContainer.accessToken ||
    (response as any).accessToken ||
    (response as any).sessionToken ||
    (outerData && (outerData.accessToken || outerData.sessionToken)) ||
    (innerData && (innerData.accessToken || innerData.sessionToken));
  const idToken =
    tokenContainer.id_token ||
    tokenContainer.idToken ||
    (response as any).idToken ||
    (outerData && outerData.idToken) ||
    (innerData && innerData.idToken);
  const refreshToken =
    tokenContainer.refresh_token ||
    tokenContainer.refreshToken ||
    (response as any).refreshToken ||
    (outerData && outerData.refreshToken) ||
    (innerData && innerData.refreshToken);
  const expiresIn =
    tokenContainer.expires_in ||
    tokenContainer.expiresIn ||
    (response as any).expiresIn ||
    undefined;

  return {
    accessToken: typeof accessToken === 'string' ? accessToken : undefined,
    idToken: typeof idToken === 'string' ? idToken : undefined,
    refreshToken: typeof refreshToken === 'string' ? refreshToken : undefined,
    expiresIn: typeof expiresIn === 'number' ? expiresIn : undefined,
  };
}

function pickVendorBlockFromResponse(response: VerifyOtpLikeResponse): {
  vendor?: any;
  vendorId?: string;
  staffId?: string;
  role?: string;
} {
  if (!response || typeof response !== 'object') return {};
  const outerData = (response as any).data;
  const innerData = outerData && (outerData as any).data;

  const vendorBlock =
    (innerData && (innerData.vendor || innerData.user || innerData.profile || innerData.staff)) ||
    (outerData && (outerData.vendor || outerData.user || outerData.profile || outerData.staff)) ||
    (response as any).vendor ||
    (response as any).user ||
    (response as any).profile ||
    (response as any).staff ||
    null;

  const staffBlock =
    (innerData && innerData.staff) ||
    (outerData && outerData.staff) ||
    (response as any).staff ||
    null;

  const vendorId =
    (vendorBlock && (vendorBlock.vendorId || vendorBlock.vendor_id || vendorBlock.id)) ||
    (innerData && (innerData.vendorId || innerData.vendor_id)) ||
    (outerData && (outerData.vendorId || outerData.vendor_id)) ||
    (response as any).vendorId ||
    undefined;

  const staffId =
    (staffBlock && (staffBlock.id || staffBlock.staffId || staffBlock.staff_id)) ||
    (innerData && (innerData.staffId || innerData.staff_id)) ||
    (outerData && (outerData.staffId || outerData.staff_id)) ||
    (response as any).staffId ||
    undefined;

  const role =
    (vendorBlock && (vendorBlock.role || vendorBlock.roleId || vendorBlock.role_id)) ||
    (staffBlock && (staffBlock.role || staffBlock.roleId || staffBlock.role_id)) ||
    undefined;

  return {
    vendor: vendorBlock || undefined,
    vendorId: typeof vendorId === 'string' ? vendorId : vendorId ? String(vendorId) : undefined,
    staffId: typeof staffId === 'string' ? staffId : staffId ? String(staffId) : undefined,
    role: typeof role === 'string' ? role : role ? String(role) : undefined,
  };
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
 * Persist a successful login response. `isNewLogin` resets the 90-day refresh
 * window — call with `true` only on a fresh OTP / password login so silent
 * refreshes never shorten the user's session.
 */
export async function saveVendorLoginResponse(
  response: VerifyOtpLikeResponse,
  opts: {
    phone: string;
    isNewLogin: boolean;
    vendorIdOverride?: string;
    staffIdOverride?: string;
    roleOverride?: string;
  }
): Promise<VendorStoredSession | null> {
  const { phone, isNewLogin } = opts;
  if (!phone) return null;

  const tokens = pickTokensFromResponse(response);
  const block = pickVendorBlockFromResponse(response);
  const vendorId = opts.vendorIdOverride || block.vendorId;
  const staffId = opts.staffIdOverride || block.staffId;
  const role = opts.roleOverride || block.role;

  if (!tokens.accessToken) {
    // No JWT in this response (legacy flow). Keep phone-only context so the
    // user isn't kicked back to login; downstream APIs continue to behave as
    // they do today.
    await multiSet([
      [K.phone, phone],
      [K.legacyVendorPhone, phone],
      [K.vendorId, vendorId],
      [K.legacyVendorId, vendorId],
      [K.legacyVendorIdPlain, vendorId],
      [K.staffId, staffId],
      [K.role, role],
      [K.vendorData, block.vendor ? JSON.stringify(block.vendor) : null],
      [K.legacyVendorProfile, block.vendor ? JSON.stringify(block.vendor) : null],
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

  if (tokens.refreshToken) {
    const refreshExpFromJwt = jwtExpMs(tokens.refreshToken);
    if (refreshExpFromJwt && refreshExpFromJwt < refreshExp) {
      refreshExp = refreshExpFromJwt;
    }
  }

  await multiSet([
    [K.accessToken, tokens.accessToken],
    [K.idToken, tokens.idToken],
    [K.refreshToken, tokens.refreshToken],
    [K.accessExpMs, String(accessExp)],
    [K.refreshWindowExpMs, String(refreshExp)],
    [K.phone, phone],
    [K.vendorId, vendorId],
    [K.staffId, staffId],
    [K.role, role],
    [K.vendorData, block.vendor ? JSON.stringify(block.vendor) : null],
    // Legacy slots so existing API service code still finds a Bearer token.
    [K.legacySessionToken, tokens.accessToken],
    [K.legacyAuthToken, tokens.idToken || tokens.accessToken],
    [K.legacyVendorPhone, phone],
    [K.legacyVendorId, vendorId],
    [K.legacyVendorIdPlain, vendorId],
    [K.legacyVendorProfile, block.vendor ? JSON.stringify(block.vendor) : null],
  ]);

  return {
    phone,
    vendorId,
    staffId,
    role,
    vendor: block.vendor,
    accessToken: tokens.accessToken,
    idToken: tokens.idToken,
    refreshToken: tokens.refreshToken,
    accessExpMs: accessExp,
    refreshWindowExpMs: refreshExp,
  };
}

/** Load whatever we persisted previously. Returns null when nothing is stored. */
export async function loadStoredVendorSession(): Promise<VendorStoredSession | null> {
  const keys = [
    K.accessToken,
    K.idToken,
    K.refreshToken,
    K.accessExpMs,
    K.refreshWindowExpMs,
    K.phone,
    K.vendorId,
    K.staffId,
    K.role,
    K.vendorData,
    K.legacySessionToken,
    K.legacyVendorPhone,
    K.legacyVendorId,
    K.legacyVendorIdPlain,
    K.legacyVendorProfile,
  ] as const;

  let entries: readonly [string, string | null][];
  try {
    entries = await AsyncStorage.multiGet(keys as unknown as string[]);
  } catch (e) {
    console.warn('[vendor-auth-session] multiGet failed:', e);
    return null;
  }
  const map = new Map<string, string | null>(entries as any);

  const accessToken = map.get(K.accessToken) || map.get(K.legacySessionToken) || null;
  const phone = map.get(K.phone) || map.get(K.legacyVendorPhone) || null;

  if (!accessToken || !phone) return null;

  const accessExpMs = Number(map.get(K.accessExpMs) || '') || undefined;
  const refreshWindowExpMs = Number(map.get(K.refreshWindowExpMs) || '') || undefined;

  // Anything inside the 90-day window is restorable.
  const now = Date.now();
  const refreshWindowOpen = !refreshWindowExpMs || now < refreshWindowExpMs;
  const accessStillValid = !accessExpMs || now < accessExpMs - REFRESH_LEEWAY_MS;
  if (!refreshWindowOpen && !accessStillValid) {
    return null;
  }

  let vendor: any = undefined;
  try {
    const raw = map.get(K.vendorData) || map.get(K.legacyVendorProfile);
    if (raw) vendor = JSON.parse(raw);
  } catch {
    /* ignore */
  }

  return {
    phone,
    vendorId: map.get(K.vendorId) || map.get(K.legacyVendorId) || map.get(K.legacyVendorIdPlain) || undefined,
    staffId: map.get(K.staffId) || undefined,
    role: map.get(K.role) || undefined,
    vendor,
    accessToken,
    idToken: map.get(K.idToken) || undefined,
    refreshToken: map.get(K.refreshToken) || undefined,
    accessExpMs,
    refreshWindowExpMs,
  };
}

let inFlightRefresh: Promise<string | null> | null = null;

/**
 * Returns a usable access token if one exists (refreshing it silently when
 * close to expiry). Returns `null` only when there is no stored session at all
 * OR the 90-day refresh window has elapsed AND the access token is already
 * expired.
 *
 * Network failures deliberately return the current (possibly stale) access
 * token so calls don't auto-logout on flaky connectivity.
 */
export async function getValidVendorAccessToken(): Promise<string | null> {
  const session = await loadStoredVendorSession();
  if (!session) return null;

  const now = Date.now();
  const accessExpMs = session.accessExpMs ?? Infinity;
  const refreshExpMs = session.refreshWindowExpMs ?? Infinity;

  if (now < accessExpMs - REFRESH_LEEWAY_MS) {
    return session.accessToken;
  }

  if (!session.refreshToken || now >= refreshExpMs) {
    return session.accessToken;
  }

  if (!inFlightRefresh) {
    inFlightRefresh = (async () => {
      try {
        const renewed = await refreshVendorTokens(session.refreshToken!);
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
export async function refreshVendorTokens(
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
    if (__DEV__) console.warn('[vendor-auth-session] refresh network error (keeping session):', e);
    return null;
  }

  if (response.status === 401) {
    if (__DEV__) console.warn('[vendor-auth-session] refresh rejected by server (401) — clearing session');
    await clearVendorSession();
    return null;
  }

  if (!response.ok) {
    if (__DEV__) console.warn('[vendor-auth-session] refresh non-OK status:', response.status);
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
export async function clearVendorSession(): Promise<void> {
  await AsyncStorage.multiRemove([
    K.accessToken,
    K.idToken,
    K.refreshToken,
    K.accessExpMs,
    K.refreshWindowExpMs,
    K.phone,
    K.vendorId,
    K.staffId,
    K.role,
    K.vendorData,
    K.legacySessionToken,
    K.legacyAuthToken,
    K.legacyVendorId,
    K.legacyVendorPhone,
    K.legacyVendorIdPlain,
    K.legacyVendorProfile,
  ]);
}

/** True when we have *any* restorable session (active OR refresh window open). */
export async function hasRestorableVendorSession(): Promise<boolean> {
  return (await loadStoredVendorSession()) !== null;
}

export const VendorSessionStorageKeys = K;
