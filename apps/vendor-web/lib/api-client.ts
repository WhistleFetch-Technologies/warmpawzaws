/**
 * API Client for Vendor Web App
 * Uses API Gateway (Lambda backend)
 */

import { VENDOR_POST_LOGIN_401_GRACE_MS } from './vendor-session-from-api';

type RuntimeConfig = {
  apiBaseUrl?: string;
  /** API Gateway WebSocket API base (https or wss). HTTP API base URLs must not be used for WS. */
  websocketUrl?: string;
  uatMode?: boolean;
  environment?: string;
};

declare global {
  interface Window {
    __WARMPAWZ_RUNTIME_CONFIG__?: RuntimeConfig;
  }
}

function getRuntimeConfig(): RuntimeConfig {
  if (typeof window === 'undefined') return {};
  return window.__WARMPAWZ_RUNTIME_CONFIG__ || {};
}

/** Current dev API Gateway (replaces retired gateway IDs in env / secrets). */
const DEV_API_GATEWAY_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const LEGACY_DEV_API_GATEWAY_SUBDOMAIN = 'iixwc3fzfl';

function normalizeDevApiBaseUrl(url: string | undefined): string {
  if (!url || typeof url !== 'string') return '';
  const t = url.trim().replace(/\/+$/, '');
  if (t.includes(LEGACY_DEV_API_GATEWAY_SUBDOMAIN)) {
    return DEV_API_GATEWAY_URL;
  }
  return t;
}

/**
 * Determine if we're in production environment
 * Hostname is checked early so deployed prod URLs call prod API even if a build-time env flag is wrong.
 */
function isProductionEnvironment(): boolean {
  const cfg = getRuntimeConfig();

  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('localhost')) {
      return false;
    }
    if (hostname === 'd1s6ykkj381k58.cloudfront.net' || hostname.startsWith('dev.')) {
      return false;
    }
    const isProdHostname =
      hostname === 'vendor.warmpawz.com' ||
      hostname === 'admin.warmpawz.com' ||
      hostname === 'customer.warmpawz.com' ||
      hostname === 'warmpawz.com' ||
      hostname === 'www.warmpawz.com';
    if (isProdHostname) {
      return true;
    }
    if (hostname.includes('cloudfront.net')) {
      return true;
    }
  }

  if (cfg.environment) {
    return cfg.environment === 'production';
  }

  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ENVIRONMENT) {
    return process.env.NEXT_PUBLIC_ENVIRONMENT === 'production';
  }

  if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
    return process.env.NODE_ENV === 'production';
  }

  return true;
}

/**
 * Get API Gateway URL based on environment
 * Production: mss9sa4y01
 * Development: z0b3obweb6
 */
function getApiGatewayUrl(): string {
  const isProd = isProductionEnvironment();
  return isProd
    ? 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com'
    : DEV_API_GATEWAY_URL;
}

export function getApiBaseUrl(): string {
  // Priority: runtime-config.js (deploy-time) → build-time env (local dev) → environment-based fallback
  const cfg = getRuntimeConfig();
  
  if (cfg.apiBaseUrl) {
    return normalizeDevApiBaseUrl(cfg.apiBaseUrl);
  }
  
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_BASE_URL) {
    const envBase = normalizeDevApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
    // Guard against accidental localhost build env leaking into deployed hosts.
    if (typeof window !== 'undefined' && window.location) {
      const host = window.location.hostname || '';
      const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host.includes('localhost');
      const envIsLocalhost = envBase.includes('localhost') || envBase.includes('127.0.0.1');
      if (!(envIsLocalhost && !isLocalhost)) {
        return envBase;
      }
    } else {
      return envBase;
    }
  }
  
  return getApiGatewayUrl();
}

/**
 * WebSocket API base only. When unset, clients skip connecting (HTTP API Gateway cannot host `/ws`).
 * Set `websocketUrl` in runtime-config.js or `NEXT_PUBLIC_WEBSOCKET_URL` at build time.
 */
export function getWebSocketBaseUrl(): string | null {
  const cfg = getRuntimeConfig();
  const fromRuntime =
    typeof cfg.websocketUrl === 'string' && cfg.websocketUrl.trim().length > 0
      ? cfg.websocketUrl.trim().replace(/\/+$/, '')
      : '';
  const fromEnv =
    typeof process !== 'undefined' &&
    typeof process.env.NEXT_PUBLIC_WEBSOCKET_URL === 'string' &&
    process.env.NEXT_PUBLIC_WEBSOCKET_URL.trim().length > 0
      ? process.env.NEXT_PUBLIC_WEBSOCKET_URL.trim().replace(/\/+$/, '')
      : '';
  return fromRuntime || fromEnv || null;
}

// UAT Mode: Check runtime config FIRST (deploy-time), then build-time env (local dev)
export function isUatMode(): boolean {
  if (typeof window !== 'undefined' && getRuntimeConfig().uatMode === true) {
    return true;
  }
  return process.env.NEXT_PUBLIC_UAT_MODE === 'true' || process.env.NODE_ENV === 'development';
}

const UAT_MODE = isUatMode();

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = getApiBaseUrl()) {
    this.baseUrl = baseUrl || '';
  }

  private getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      // Try Cognito token first (preferred for AWS Serverless).
      // refreshVendorTokensIfNeeded() (called at the top of request()) updates localStorage
      // before this getter runs, so the re-read below picks up any freshly issued token.
      // TODO: convert getAuthToken to async and replace getCognitoIdToken() with
      //       refreshVendorTokensIfNeeded() once callers are migrated to await the result.
      try {
        const { getCognitoIdToken } = require('./cognito-auth');
        const cognitoToken = getCognitoIdToken();
        if (cognitoToken) return cognitoToken;
      } catch {
        // Cognito not used
      }
      // Vendor OTP flow stores in authToken; session-manager may use vendorSessionToken
      return (
        localStorage.getItem('vendorAuthToken') ||
        localStorage.getItem('authToken') ||
        localStorage.getItem('vendorSessionToken') ||
        null
      );
    }
    return null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry: boolean = false,
  ): Promise<T> {
    // Re-resolve base URL at call time so deploy-time runtime config always wins,
    // even if the client instance was created before runtime-config.js executed.
    const resolvedBaseUrl = getApiBaseUrl();
    if (resolvedBaseUrl && resolvedBaseUrl !== this.baseUrl) {
      this.baseUrl = resolvedBaseUrl;
    }
    if (!this.baseUrl) {
      throw new Error('API_BASE_URL is not configured (runtime-config.js missing or empty).');
    }
    // Silently refresh the Cognito access token when it has expired but the 90-day
    // refresh token window is still open.  Runs before getAuthToken() so the updated
    // token is in localStorage by the time the synchronous read below fires.
    try {
      const { refreshVendorTokensIfNeeded } = await import('./cognito-auth');
      await refreshVendorTokensIfNeeded();
    } catch {
      // Never let a refresh failure block the outgoing request.
    }

    // Fix: Normalize URL to avoid double slashes
    const base = this.baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
    const path = endpoint.replace(/^\/+/, '/');    // Ensure single leading slash
    const url = `${base}${path}`;
    const token = this.getAuthToken();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // ✅ UAT Mode: Send header to backend so it knows to use mock data
    if (UAT_MODE) {
      headers['X-UAT-Mode'] = 'true';
    }
    
    // ✅ FIX: Add timeout to prevent requests from hanging indefinitely (30 seconds)
    const REQUEST_TIMEOUT_MS = 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    
    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      // Handle abort (timeout)
      if (fetchError.name === 'AbortError' || controller.signal.aborted) {
        const timeoutError = new Error('Request timed out. Please try again.');
        (timeoutError as any).statusCode = 504;
        (timeoutError as any).isTimeout = true;
        throw timeoutError;
      }
      
      // Re-throw other fetch errors
      throw fetchError;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      
      // Handle 401: clear full vendor session so /auth shows login (prevents redirect loop).
      // After OTP / admin portal bootstrap, several parallel calls may 401 once (token shape, race).
      // Never strip the "just logged in" flag on first 401 — that made the *second* 401 wipe the session
      // and send users to the phone login screen while the portal tab was still loading.
      // Skip session clear for forgot-password verify/reset — invalid OTP / token should not redirect away from the flow.
      const isVendorForgotPasswordFlow =
        path.includes('/auth/vendor/forgot-password/verify-otp') ||
        path.includes('/auth/vendor/forgot-password/reset');
      // Login / OTP / forgot-request return 401 for bad credentials — must not reload /auth (hides the error).
      const isVendorUnauthenticatedAuthEndpoint =
        path.includes('/auth/vendor/login') ||
        path.includes('/auth/send-otp') ||
        path.includes('/auth/verify-otp') ||
        path.includes('/auth/otp/send') ||
        path.includes('/auth/vendor/forgot-password/request');
      const hadBearerAuth = !!(token && String(token).length > 0);
      if (
        response.status === 401 &&
        hadBearerAuth &&
        !isVendorForgotPasswordFlow &&
        !isVendorUnauthenticatedAuthEndpoint
      ) {
        if (typeof window !== 'undefined') {
          const loginAt = Number(sessionStorage.getItem('_warmpawz_vendor_login_at') || 0);
          const inGrace = loginAt > 0 && Date.now() - loginAt < VENDOR_POST_LOGIN_401_GRACE_MS;
          const justLoggedIn = sessionStorage.getItem('_warmpawz_vendor_just_logged_in') === 'true';

          // Before clearing the session, attempt ONE silent refresh + retry.
          // This is the key to 90-day persistent login: a single 401 (caused by
          // an expired/rotated access token, post-deploy revalidation, clock
          // skew, etc.) must not log the user out as long as the refresh token
          // is still inside its 90-day window.
          if (!isRetry) {
            try {
              const { refreshVendorAfterUnauthorized401 } = await import('./cognito-auth');
              const renewed = await refreshVendorAfterUnauthorized401();
              if (renewed.kind === 'renewed' && renewed.tokens?.idToken) {
                return this.request<T>(endpoint, options, true);
              }
              if (renewed.kind === 'failed_network') {
                throw Object.assign(new Error('Session refresh temporarily unavailable'), {
                  statusCode: 401,
                });
              }
            } catch (err) {
              if ((err as { statusCode?: number })?.statusCode === 401) {
                throw err;
              }
              /* fall through */
            }
          }

          if (justLoggedIn || inGrace) {
            if (UAT_MODE) {
              console.warn('[API Client] 401 during post-login grace – skipping session clear');
            }
          } else {
            const { clearVendorSession } = require('./session-utils');
            clearVendorSession();
            window.location.href = '/auth';
          }
        }
      }
      
      // Handle 429 (Rate Limiting) with retry-after information
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : 5;
        
        // Create a more informative error message
        let errorMessage = 'Too many requests. Please wait a moment before trying again.';
        if (retryAfterSeconds > 0) {
          errorMessage = `Too many requests. Please wait ${retryAfterSeconds} second${retryAfterSeconds > 1 ? 's' : ''} before trying again.`;
        }
        
        // Create error with retry information
        const rateLimitError = new Error(errorMessage);
        (rateLimitError as any).statusCode = 429;
        (rateLimitError as any).retryAfter = retryAfterSeconds;
        if (typeof errorData?.retryAfterSeconds === 'number') {
          (rateLimitError as any).retryAfterSeconds = errorData.retryAfterSeconds;
        }
        (rateLimitError as any).isRateLimit = true;
        throw rateLimitError;
      }
      
      // ✅ FIX: Ensure error message is always a string, not [object Object]
      // ✅ FIX: Extract nested error details (handles error.details.details structure)
      let errorMessage = `HTTP ${response.status}`;
      
      // Handle nested error structure: { error: { message, code, details: { details: "..." } } }
      if (errorData.error && typeof errorData.error === 'object') {
        // First try to get the detailed message from nested details
        if (errorData.error.details) {
          if (typeof errorData.error.details === 'string') {
            errorMessage = errorData.error.details;
          } else if (errorData.error.details.details && typeof errorData.error.details.details === 'string') {
            errorMessage = errorData.error.details.details;
          } else if (errorData.error.details.message && typeof errorData.error.details.message === 'string') {
            errorMessage = errorData.error.details.message;
          }
        }
        
        // Fallback to error.message or error.code if details not found
        if (errorMessage === `HTTP ${response.status}`) {
          errorMessage = errorData.error.message || errorData.error.code || JSON.stringify(errorData.error);
        }
      } else if (typeof errorData.error === 'string') {
        errorMessage = errorData.error;
      } else if (typeof errorData.message === 'string') {
        errorMessage = errorData.message;
      } else if (typeof errorData === 'string') {
        errorMessage = errorData;
      }
      
      // ✅ FIX: Handle 503 Service Unavailable / timeout errors specifically
      if (response.status === 503 || errorMessage.includes('timeout') || errorMessage.includes('Connection terminated')) {
        // Provide user-friendly message for timeout errors
        if (errorMessage.includes('timeout') || errorMessage.includes('Connection terminated')) {
          errorMessage = 'The request took too long. Please try again. If this persists, the service may be temporarily unavailable.';
        } else {
          errorMessage = 'Service temporarily unavailable. Please try again in a moment.';
        }
      }
      
      // Attach status code to error for better handling
      const error = new Error(errorMessage);
      (error as any).statusCode = response.status;
      (error as any).originalError = errorData;
      throw error;
    }

    return response.json();
  }

  /**
   * GET binary (e.g. bulk XLSX template). Uses API Gateway base URL + auth — not relative `/api`,
   * which fails on static-export vendor hosting.
   */
  async getBlob(endpoint: string): Promise<Blob> {
    const resolvedBaseUrl = getApiBaseUrl().replace(/\/+$/, '');
    const path = endpoint.replace(/^\/+/, '/');
    const url = `${resolvedBaseUrl}${path}`;

    try {
      const { refreshVendorTokensIfNeeded } = await import('./cognito-auth');
      await refreshVendorTokensIfNeeded();
    } catch {
      /* non-blocking */
    }

    const token = this.getAuthToken();
    const headers: Record<string, string> = {
      Accept:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream, */*',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (UAT_MODE) headers['X-UAT-Mode'] = 'true';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    let response: Response;
    try {
      response = await fetch(url, { method: 'GET', headers, signal: controller.signal });
      clearTimeout(timeoutId);
    } catch (e: any) {
      clearTimeout(timeoutId);
      throw e?.name === 'AbortError' ? new Error('Download timed out. Please try again.') : e;
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(errText.slice(0, 240) || `HTTP ${response.status}`);
    }

    return response.blob();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    // Handle FormData - don't stringify or set Content-Type header
    if (data instanceof FormData) {
      // Re-resolve base URL at call time so deploy-time runtime config (and prod vs dev
      // CloudFront host detection) always wins, even if `apiClient` was instantiated
      // before runtime-config.js executed inside the Capacitor WebView.
      const resolvedBaseUrl = getApiBaseUrl();
      if (resolvedBaseUrl && resolvedBaseUrl !== this.baseUrl) {
        this.baseUrl = resolvedBaseUrl;
      }
      if (!this.baseUrl) {
        throw new Error('API_BASE_URL is not configured (runtime-config.js missing or empty).');
      }

      // Silently refresh Cognito access tokens (same as JSON requests) so a stale token does
      // not 401 the multipart upload.
      try {
        const { refreshVendorTokensIfNeeded } = await import('./cognito-auth');
        await refreshVendorTokensIfNeeded();
      } catch {
        /* non-blocking */
      }

      const token = this.getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      if (UAT_MODE) {
        headers['X-UAT-Mode'] = 'true';
      }

      const base = this.baseUrl.replace(/\/+$/, '');
      const path = endpoint.replace(/^\/+/, '/');
      const url = `${base}${path}`;

      // Don't set Content-Type for FormData - browser will set it with boundary
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: data,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        // Mirror the nested-error parsing in `request()` so multipart failures surface a
        // human message ("No photos provided", S3 errors, etc.) instead of "[object Object]".
        let errorMessage = `HTTP ${response.status}`;
        if (errorData?.error && typeof errorData.error === 'object') {
          if (typeof errorData.error.details === 'string') {
            errorMessage = errorData.error.details;
          } else if (errorData.error.message) {
            errorMessage = errorData.error.message;
          } else {
            errorMessage = JSON.stringify(errorData.error);
          }
        } else if (typeof errorData?.error === 'string') {
          errorMessage = errorData.error;
        } else if (typeof errorData?.message === 'string') {
          errorMessage = errorData.message;
        }
        const err = new Error(errorMessage);
        (err as any).statusCode = response.status;
        (err as any).originalError = errorData;
        throw err;
      }

      return response.json();
    }
    
    // Regular JSON POST
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // Set auth token (typically after OTP verification)
  setAuthToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vendorAuthToken', token);
    }
  }

  // Clear auth token
  clearAuth(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vendorAuthToken');
      localStorage.removeItem('vendorId');
    }
  }
}

export const apiClient = new ApiClient();

/** Auth headers for XHR multipart uploads (Capacitor Android: `fetch`+FormData often drops file bodies). */
export function getVendorAuthHeadersForUpload(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof window === 'undefined') return headers;
  try {
    const { getCognitoIdToken } = require('./cognito-auth');
    const cognitoToken = getCognitoIdToken();
    if (cognitoToken) {
      headers['Authorization'] = `Bearer ${cognitoToken}`;
      return headers;
    }
  } catch {
    /* Cognito optional */
  }
  const token =
    localStorage.getItem('vendorAuthToken') ||
    localStorage.getItem('authToken') ||
    localStorage.getItem('vendorSessionToken');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (UAT_MODE) headers['X-UAT-Mode'] = 'true';
  return headers;
}

export type MultipartUploadResponse = {
  success?: boolean;
  error?: string;
  uploadedCount?: number;
  photoUrls?: string[];
  displayUrls?: string[];
  vendorId?: string;
  skipped?: string[];
  attemptedCount?: number;
};

/**
 * POST multipart FormData via XMLHttpRequest (reliable file bytes on Capacitor Android WebView).
 */
export async function postMultipartFormWithXhr(
  endpoint: string,
  formData: FormData,
  options?: { onProgress?: (percent: number) => void }
): Promise<MultipartUploadResponse> {
  try {
    const { refreshVendorTokensIfNeeded } = await import('./cognito-auth');
    await refreshVendorTokensIfNeeded();
  } catch {
    /* non-blocking */
  }

  return new Promise((resolve, reject) => {
    const base = getApiBaseUrl().replace(/\/+$/, '');
    const path = endpoint.replace(/^\/+/, '/');
    const url = `${base}${path}`;
    const xhr = new XMLHttpRequest();

    if (options?.onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          options.onProgress!(Math.round((e.loaded / e.total) * 100));
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as MultipartUploadResponse);
        } catch {
          reject(new Error('Invalid server response'));
        }
        return;
      }
      try {
        const err = JSON.parse(xhr.responseText) as MultipartUploadResponse;
        reject(new Error(err.error || `Upload failed (${xhr.status})`));
      } catch {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

    xhr.open('POST', url);
    const authHeaders = getVendorAuthHeadersForUpload();
    for (const [key, value] of Object.entries(authHeaders)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.send(formData);
  });
}

/**
 * POST JSON via native HTTP on Capacitor (large base64 bodies fail in Android WebView XHR).
 * Falls back to XMLHttpRequest on web.
 */
export async function postJsonWithXhr<T extends MultipartUploadResponse = MultipartUploadResponse>(
  endpoint: string,
  body: unknown,
  options?: { onProgress?: (percent: number) => void }
): Promise<T> {
  try {
    const { refreshVendorTokensIfNeeded } = await import('./cognito-auth');
    await refreshVendorTokensIfNeeded();
  } catch {
    /* non-blocking */
  }

  const base = getApiBaseUrl().replace(/\/+$/, '');
  const path = endpoint.replace(/^\/+/, '/');
  const url = `${base}${path}`;
  const authHeaders = getVendorAuthHeadersForUpload();

  if (typeof window !== 'undefined') {
    try {
      const { Capacitor, CapacitorHttp } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        options?.onProgress?.(5);
        const response = await CapacitorHttp.post({
          url,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...authHeaders,
          },
          data: body as Record<string, unknown>,
        });
        options?.onProgress?.(100);
        const status = response.status ?? 0;
        const raw = response.data;
        const parsed =
          typeof raw === 'string'
            ? (JSON.parse(raw) as T)
            : (raw as T);
        if (status >= 200 && status < 300) {
          return parsed;
        }
        const errMsg =
          (parsed as MultipartUploadResponse)?.error || `Upload failed (${status})`;
        throw new Error(errMsg);
      }
    } catch (nativeErr) {
      if (
        nativeErr instanceof Error &&
        (nativeErr.message.includes('Upload failed') ||
          nativeErr.message.includes('permission') ||
          nativeErr.message.includes('No photos'))
      ) {
        throw nativeErr;
      }
      let onNativeShell = false;
      try {
        const { Capacitor } = await import('@capacitor/core');
        onNativeShell = Capacitor.isNativePlatform();
      } catch {
        /* ignore */
      }
      if (onNativeShell) {
        throw new Error(
          'Upload failed in the app. Install the latest vendor APK (Play Store or debug build after cap sync), or use https://vendor.warmpawz.com in Chrome.'
        );
      }
      console.warn('[postJsonWithXhr] CapacitorHttp failed, falling back to XHR:', nativeErr);
    }
  }

  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (options?.onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          options.onProgress!(Math.round((e.loaded / e.total) * 100));
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as T);
        } catch {
          reject(new Error('Invalid server response'));
        }
        return;
      }
      try {
        const err = JSON.parse(xhr.responseText) as MultipartUploadResponse;
        reject(new Error(err.error || `Request failed (${xhr.status})`));
      } catch {
        reject(new Error(`Request failed (${xhr.status})`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.addEventListener('abort', () => reject(new Error('Request cancelled')));

    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', 'application/json');
    for (const [key, value] of Object.entries(authHeaders)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.send(payload);
  });
}
