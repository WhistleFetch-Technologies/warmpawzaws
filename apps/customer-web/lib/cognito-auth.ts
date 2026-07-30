/**
 * ============================================================================
 * AWS COGNITO AUTHENTICATION - FRONTEND
 * ============================================================================
 */

export interface CognitoTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
}

const TOKEN_STORAGE_KEY = 'customerCognitoTokens';
const USER_STORAGE_KEY = 'customerUser';

/** Max refresh lifetime when token is Cognito opaque (pool setting is authoritative; tune via env). */
function defaultOpaqueRefreshWindowMs(): number {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_CUSTOMER_REFRESH_MAX_AGE_DAYS) {
    const n = Number(process.env.NEXT_PUBLIC_CUSTOMER_REFRESH_MAX_AGE_DAYS);
    if (Number.isFinite(n) && n > 0) return Math.floor(n * 24 * 60 * 60 * 1000);
  }
  return 90 * 24 * 60 * 60 * 1000;
}

/** Read `exp` from a JWT-shaped string (ms since epoch); null if opaque or malformed. */
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

/** When refresh token is a Warmpawz JWT, honour its `exp`. Otherwise use configurable max window from login time. */
function computeRefreshExpiryAtLogin(refreshToken: string): number {
  const jwtEnd = jwtExpMs(refreshToken);
  const floor = Date.now() + defaultOpaqueRefreshWindowMs();
  if (jwtEnd != null && jwtEnd > Date.now()) return Math.min(jwtEnd, floor);
  return floor;
}

export type StoreCognitoTokensOptions = {
  /** Fresh sign-in — resets the refresh-window clock from JWT refresh `exp` or max-age cap. */
  isNewLogin?: boolean;
};

export function storeCognitoTokens(tokens: CognitoTokens, opts?: StoreCognitoTokensOptions): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
    const expiryTime = Date.now() + (tokens.expiresIn * 1000);
    localStorage.setItem('customerTokenExpiry', expiryTime.toString());

    const freshLogin = opts?.isNewLogin === true;

    if (freshLogin) {
      if (tokens.refreshToken) {
        localStorage.setItem(
          'customerRefreshTokenExpiry',
          String(computeRefreshExpiryAtLogin(tokens.refreshToken))
        );
      } else {
        localStorage.removeItem('customerRefreshTokenExpiry');
      }
      return;
    }

    /* Silent / partial updates (no opts): preserve existing refresh window — only backfill when missing */
    if (!localStorage.getItem('customerRefreshTokenExpiry') && tokens.refreshToken) {
      localStorage.setItem(
        'customerRefreshTokenExpiry',
        String(computeRefreshExpiryAtLogin(tokens.refreshToken))
      );
    }
  }
}

export function getCognitoTokens(): CognitoTokens | null {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!stored) return null;

  try {
    const tokens = JSON.parse(stored);
    const expiryTime = localStorage.getItem('customerTokenExpiry');
    if (expiryTime && Date.now() > parseInt(expiryTime, 10)) {
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
    localStorage.removeItem('customerTokenExpiry');
    localStorage.removeItem('customerRefreshTokenExpiry');
    localStorage.removeItem(USER_STORAGE_KEY);
  }
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  if (getCognitoTokens() !== null) return true;
  const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!stored) return false;
  const refreshExpiry = localStorage.getItem('customerRefreshTokenExpiry');
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

let cognitoRefreshInFlight: Promise<RefreshOutcome> | null = null;

export type RefreshOutcomeKind = 'renewed' | 'unchanged' | 'failed_network' | 'failed_refresh';

/** Result so callers can distinguish transient failures from invalidated refresh sessions. */
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

/** Backfill 90-day refresh window for legacy sessions missing customerRefreshTokenExpiry. */
function ensureRefreshWindowBackfill(tokens: CognitoTokens): void {
  if (typeof window === 'undefined' || !tokens.refreshToken) return;
  if (!localStorage.getItem('customerRefreshTokenExpiry')) {
    localStorage.setItem(
      'customerRefreshTokenExpiry',
      String(computeRefreshExpiryAtLogin(tokens.refreshToken))
    );
  }
}

async function postRefreshToken(refreshToken: string, priorTokens: CognitoTokens): Promise<RefreshOutcome> {
  if (typeof window === 'undefined') {
    return { kind: 'failed_network', tokens: null };
  }

  try {
    const { getApiBaseUrl } = await import('./api-client');
    const base = getApiBaseUrl().replace(/\/+$/, '');
    if (!base) {
      if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
        console.warn('[customer-auth] refresh skipped: API base URL not configured');
      }
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
      const reason =
        typeof data.refreshFailureCode === 'string' ? String(data.refreshFailureCode) : 'refresh_http_error';
      if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
        console.warn('[customer-auth] refresh failed:', res.status, reason);
      }
      // Only drop credentials when the server CONCLUSIVELY rejects the refresh
      // token (400/401). 403 is often CloudFront/static-host infra — keep session.
      // 5xx / 429 / proxy errors also keep the session so deploys don't log users out.
      const isAuthFailure = res.status === 400 || res.status === 401;
      if (isAuthFailure) {
        clearCognitoTokens();
        return { kind: 'failed_refresh', tokens: null };
      }
      return { kind: 'failed_network', tokens: null };
    }

    const { accessToken: newAccess, idToken: newId, expiresIn: newExpires } = parseRefreshResponseFields(data);
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
    localStorage.setItem('customerTokenExpiry', String(Date.now() + updated.expiresIn * 1000));
    localStorage.setItem('authToken', newId);

    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
      console.log('[customer-auth] refresh ok (access renewed)');
    }
    return { kind: 'renewed', tokens: updated };
  } catch {
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
      console.warn('[customer-auth] refresh network error — keeping session');
    }
    return { kind: 'failed_network', tokens: null };
  }
}

async function refreshCognitoTokensWithOutcomeInner(): Promise<RefreshOutcome> {
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

  const expiryTime = localStorage.getItem('customerTokenExpiry');
  if (expiryTime && Date.now() < parseInt(expiryTime, 10)) {
    return { kind: 'unchanged', tokens };
  }

  ensureRefreshWindowBackfill(tokens);

  const refreshExpiry = localStorage.getItem('customerRefreshTokenExpiry');
  if (!refreshExpiry || Date.now() > parseInt(refreshExpiry, 10)) {
    clearCognitoTokens();
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
      console.warn('[customer-auth] refresh skipped: refresh window elapsed (expired_refresh_window)');
    }
    return { kind: 'failed_refresh', tokens: null };
  }

  if (!tokens.refreshToken) {
    clearCognitoTokens();
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
      console.warn('[customer-auth] refresh skipped: missing refresh token');
    }
    return { kind: 'failed_refresh', tokens: null };
  }

  return postRefreshToken(tokens.refreshToken, tokens);
}

/**
 * After HTTP 401: always try exchanging the refresh token (server rejected access even if locally “valid”).
 * Does not share the proactive refresh mutex — avoids pinning to a preemptive noop when API already said 401.
 */
export async function refreshCognitoAfterUnauthorized401(): Promise<RefreshOutcome> {
  if (typeof window === 'undefined') return { kind: 'failed_refresh', tokens: null };

  const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!stored) return { kind: 'failed_refresh', tokens: null };

  let tokens: CognitoTokens;
  try {
    tokens = JSON.parse(stored);
  } catch {
    return { kind: 'failed_refresh', tokens: null };
  }

  ensureRefreshWindowBackfill(tokens);

  const refreshExpiry = localStorage.getItem('customerRefreshTokenExpiry');
  if (!refreshExpiry || Date.now() > parseInt(refreshExpiry, 10)) {
    clearCognitoTokens();
    return { kind: 'failed_refresh', tokens: null };
  }

  if (!tokens.refreshToken) {
    clearCognitoTokens();
    return { kind: 'failed_refresh', tokens: null };
  }

  return postRefreshToken(tokens.refreshToken, tokens);
}

/** Exposed for ApiClient — discriminates Cognito/JWT invalidated vs transient network failures. */
export async function refreshCognitoTokensWithOutcome(): Promise<RefreshOutcome> {
  if (!cognitoRefreshInFlight) {
    cognitoRefreshInFlight = refreshCognitoTokensWithOutcomeInner().finally(() => {
      cognitoRefreshInFlight = null;
    });
  }
  return cognitoRefreshInFlight;
}

/**
 * Transparently refreshes the access token when it is expired but the refresh token is still valid.
 * Returns the (possibly updated) token bundle, or null when the session is fully expired / user must log in again.
 *
 * Safe to call on every API request — returns immediately when the access token is still valid.
 */
export async function refreshCognitoTokensIfNeeded(): Promise<CognitoTokens | null> {
  const out = await refreshCognitoTokensWithOutcome();
  if (out.kind === 'unchanged' || out.kind === 'renewed') {
    try {
      return JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY) || 'null') as CognitoTokens | null;
    } catch {
      return out.tokens ?? null;
    }
  }
  return null;
}
