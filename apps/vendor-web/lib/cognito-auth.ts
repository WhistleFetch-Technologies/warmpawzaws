/**
 * ============================================================================
 * AWS COGNITO AUTHENTICATION - FRONTEND (Vendor Web)
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

const ACCESS_REFRESH_LEEWAY_MS = 60_000;

function defaultOpaqueRefreshWindowMs(): number {
  return 90 * 24 * 60 * 60 * 1000;
}

/** Coerce API expires_in (number or numeric string) so "3600" is not treated as 86400. */
export function parseExpiresInSeconds(raw: unknown, fallback = 86400): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}

function jwtExpMs(token: string | undefined | null): number | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;
  try {
    const pad = parts[1].length % 4 === 0 ? '' : '='.repeat(4 - (parts[1].length % 4));
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/') + pad;
    if (typeof atob !== 'function') return null;
    const payload = JSON.parse(atob(b64)) as { exp?: number };
    if (typeof payload.exp !== 'number') return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

function computeRefreshExpiryAtLogin(refreshToken: string): number {
  const jwtEnd = jwtExpMs(refreshToken);
  const floor = Date.now() + defaultOpaqueRefreshWindowMs();
  if (jwtEnd != null && jwtEnd > Date.now()) return Math.min(jwtEnd, floor);
  return floor;
}

export type StoreCognitoTokensOptions = {
  isNewLogin?: boolean;
};

/** Keep legacy authToken keys in sync with Cognito id token (page bootstrap reads these). */
export function syncVendorLegacyAuthTokens(idToken: string): void {
  if (typeof window === 'undefined' || !idToken) return;
  localStorage.setItem('authToken', idToken);
  localStorage.setItem('vendorSessionToken', idToken);
  localStorage.setItem('vendorAuthToken', idToken);
}

function computeAccessExpiryMs(tokens: CognitoTokens): number {
  const expiresIn = parseExpiresInSeconds(tokens.expiresIn, 86400);
  const fromExpires = Date.now() + expiresIn * 1000;
  const jwtEnd = jwtExpMs(tokens.accessToken) ?? jwtExpMs(tokens.idToken);
  return jwtEnd != null ? Math.min(fromExpires, jwtEnd) : fromExpires;
}

function isAccessTokenLocallyValid(tokens: CognitoTokens): boolean {
  const expiryTime = localStorage.getItem('vendorTokenExpiry');
  const localOk = !expiryTime || Date.now() < parseInt(expiryTime, 10);
  const jwtEnd = jwtExpMs(tokens.accessToken) ?? jwtExpMs(tokens.idToken);
  const jwtOk = jwtEnd == null || Date.now() < jwtEnd - ACCESS_REFRESH_LEEWAY_MS;
  return localOk && jwtOk;
}

function isRefreshWindowOpen(tokens: CognitoTokens): boolean {
  const refreshExpiry = localStorage.getItem('vendorRefreshTokenExpiry');
  if (refreshExpiry && Date.now() < parseInt(refreshExpiry, 10)) return true;
  if (tokens.refreshToken) {
    ensureRefreshWindowBackfill(tokens);
    const again = localStorage.getItem('vendorRefreshTokenExpiry');
    return !!again && Date.now() < parseInt(again, 10);
  }
  return isAccessTokenLocallyValid(tokens);
}

export function storeCognitoTokens(tokens: CognitoTokens, opts?: StoreCognitoTokensOptions): void {
  if (typeof window === 'undefined') return;

  const normalized: CognitoTokens = {
    ...tokens,
    expiresIn: parseExpiresInSeconds(tokens.expiresIn, 86400),
  };
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(normalized));
  localStorage.setItem('vendorTokenExpiry', String(computeAccessExpiryMs(normalized)));

  const freshLogin = opts?.isNewLogin === true;
  if (normalized.refreshToken) {
    if (freshLogin || !localStorage.getItem('vendorRefreshTokenExpiry')) {
      localStorage.setItem(
        'vendorRefreshTokenExpiry',
        String(computeRefreshExpiryAtLogin(normalized.refreshToken)),
      );
    }
  }

  syncVendorLegacyAuthTokens(normalized.idToken);
}

export function getCognitoTokens(): CognitoTokens | null {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!stored) return null;

  try {
    const tokens = JSON.parse(stored) as CognitoTokens;
    if (!isRefreshWindowOpen(tokens)) return null;
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
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem('vendorTokenExpiry');
  localStorage.removeItem('vendorRefreshTokenExpiry');
  localStorage.removeItem(USER_STORAGE_KEY);
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  if (getCognitoTokens() !== null) return true;
  const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!stored) return false;
  const refreshExpiry = localStorage.getItem('vendorRefreshTokenExpiry');
  return !!refreshExpiry && Date.now() < parseInt(refreshExpiry, 10);
}

export function storeUserInfo(user: unknown): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }
}

export function getUserInfo(): unknown | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(USER_STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

let vendorRefreshInFlight: Promise<RefreshOutcome> | null = null;
let vendorUnauthorizedRefreshInFlight: Promise<RefreshOutcome> | null = null;

export type RefreshOutcomeKind = 'renewed' | 'unchanged' | 'failed_network' | 'failed_refresh';

export type RefreshOutcome = {
  kind: RefreshOutcomeKind;
  tokens?: CognitoTokens | null;
};

function parseRefreshResponseFields(data: Record<string, unknown>): {
  accessToken?: string;
  idToken?: string;
  expiresIn?: number;
} {
  const accessToken =
    typeof data.accessToken === 'string'
      ? data.accessToken
      : typeof data.access_token === 'string'
        ? data.access_token
        : undefined;
  const idToken =
    typeof data.idToken === 'string'
      ? data.idToken
      : typeof data.id_token === 'string'
        ? data.id_token
        : undefined;
  const rawExpires = data.expiresIn ?? data.expires_in;
  const expiresIn =
    typeof rawExpires === 'number'
      ? rawExpires
      : typeof rawExpires === 'string' && rawExpires.trim() !== ''
        ? Number(rawExpires)
        : undefined;
  return {
    accessToken,
    idToken,
    expiresIn: Number.isFinite(expiresIn) ? expiresIn : undefined,
  };
}

function ensureRefreshWindowBackfill(tokens: CognitoTokens): void {
  if (typeof window === 'undefined' || !tokens.refreshToken) return;
  if (!localStorage.getItem('vendorRefreshTokenExpiry')) {
    localStorage.setItem(
      'vendorRefreshTokenExpiry',
      String(computeRefreshExpiryAtLogin(tokens.refreshToken)),
    );
  }
}

async function postRefreshToken(
  refreshToken: string,
  priorTokens: CognitoTokens,
): Promise<RefreshOutcome> {
  if (typeof window === 'undefined') {
    return { kind: 'failed_network', tokens: null };
  }

  try {
    const { getApiBaseUrl } = await import('./api-client');
    const base = getApiBaseUrl().replace(/\/+$/, '');
    if (!base) {
      return { kind: 'failed_network', tokens: null };
    }

    const res = await fetch(`${base}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    const raw = await res.text();
    let data: Record<string, unknown> = {};
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        /* ignore */
      }
    }

    if (!res.ok) {
      const isAuthFailure = res.status === 400 || res.status === 401;
      if (isAuthFailure) {
        clearCognitoTokens();
        return { kind: 'failed_refresh', tokens: null };
      }
      return { kind: 'failed_network', tokens: null };
    }

    const { accessToken: newAccess, idToken: newId, expiresIn: newExpires } =
      parseRefreshResponseFields(data);
    if (typeof newAccess !== 'string' || typeof newId !== 'string' || typeof newExpires !== 'number') {
      clearCognitoTokens();
      return { kind: 'failed_refresh', tokens: null };
    }

    const updated: CognitoTokens = {
      ...priorTokens,
      accessToken: newAccess,
      idToken: newId,
      expiresIn: newExpires,
    };

    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(updated));
    localStorage.setItem('vendorTokenExpiry', String(computeAccessExpiryMs(updated)));
    syncVendorLegacyAuthTokens(newId);

    return { kind: 'renewed', tokens: updated };
  } catch {
    return { kind: 'failed_network', tokens: null };
  }
}

async function refreshVendorTokensWithOutcomeInner(forceRefresh: boolean): Promise<RefreshOutcome> {
  if (typeof window === 'undefined') {
    return { kind: 'unchanged', tokens: null };
  }

  const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!stored) {
    return { kind: 'failed_refresh', tokens: null };
  }

  let tokens: CognitoTokens;
  try {
    tokens = JSON.parse(stored);
  } catch {
    return { kind: 'failed_refresh', tokens: null };
  }

  if (!forceRefresh && isAccessTokenLocallyValid(tokens)) {
    return { kind: 'unchanged', tokens };
  }

  ensureRefreshWindowBackfill(tokens);

  if (!tokens.refreshToken) {
    clearCognitoTokens();
    return { kind: 'failed_refresh', tokens: null };
  }

  const refreshExpiry = localStorage.getItem('vendorRefreshTokenExpiry');
  if (refreshExpiry && Date.now() > parseInt(refreshExpiry, 10)) {
    clearCognitoTokens();
    return { kind: 'failed_refresh', tokens: null };
  }

  return postRefreshToken(tokens.refreshToken, tokens);
}

/** After HTTP 401 — force refresh, coalesced so parallel 401s share one POST /auth/refresh. */
export async function refreshVendorAfterUnauthorized401(): Promise<RefreshOutcome> {
  if (!vendorUnauthorizedRefreshInFlight) {
    vendorUnauthorizedRefreshInFlight = refreshVendorTokensWithOutcomeInner(true).finally(() => {
      vendorUnauthorizedRefreshInFlight = null;
    });
  }
  return vendorUnauthorizedRefreshInFlight;
}

export async function refreshVendorTokensWithOutcome(): Promise<RefreshOutcome> {
  if (!vendorRefreshInFlight) {
    vendorRefreshInFlight = refreshVendorTokensWithOutcomeInner(false).finally(() => {
      vendorRefreshInFlight = null;
    });
  }
  return vendorRefreshInFlight;
}

/**
 * Transparently refreshes the vendor access token when expired but refresh window is open.
 * Returns null on failed_refresh or when no bundle exists; keeps session on failed_network.
 */
export async function refreshVendorTokensIfNeeded(
  opts?: { force?: boolean },
): Promise<CognitoTokens | null> {
  const out = opts?.force
    ? await refreshVendorAfterUnauthorized401()
    : await refreshVendorTokensWithOutcome();

  if (out.kind === 'unchanged' || out.kind === 'renewed') {
    try {
      return JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY) || 'null') as CognitoTokens | null;
    } catch {
      return out.tokens ?? null;
    }
  }
  return null;
}
