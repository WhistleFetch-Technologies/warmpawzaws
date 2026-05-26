/**
 * API Client for Customer Web App
 * Uses API Gateway (Lambda backend)
 */

import {
  customerUuidSegmentInPath,
  ensureCustomerIdStorageReconciledOnce,
  isCustomerDatabaseUuid,
  reconcileCustomerIdStorageOnLoad,
} from './customer-id-storage';
import { ApiError } from './error-handling';

type RuntimeConfig = {
  apiBaseUrl?: string;
  /** API Gateway WebSocket API base (https or wss). HTTP API base URLs must not be used for WS. */
  websocketUrl?: string;
  uatMode?: boolean;
  environment?: string;
  customerEcommerceEnabled?: boolean;
  customerMealPlansEnabled?: boolean;
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

/** Current dev API Gateway (replaces retired gateway IDs in stale runtime-config.js / env). */
const DEV_API_GATEWAY_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const LEGACY_DEV_API_GATEWAY_SUBDOMAIN = 'iixwc3fzfl';

/** One in-flight list request per endpoint (React Strict Mode double-mounts effects in dev → duplicate fetches). */
const customerArticlesListInflight = new Map<string, Promise<unknown>>();

/** On localhost, use same-origin `/api/customer/articles` so Next can map upstream 502/503 → 200 + empty list. */
function customerArticlesListFetchPath(endpoint: string): string {
  if (typeof window === 'undefined') return endpoint;
  const host = window.location.hostname;
  const isLocal =
    host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost');
  if (!isLocal || !endpoint.startsWith('/customer/articles')) return endpoint;
  const q = endpoint.includes('?') ? endpoint.slice(endpoint.indexOf('?')) : '';
  return `/api/customer/articles${q}`;
}

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
 * Checks: runtime config → NEXT_PUBLIC_ENVIRONMENT → NODE_ENV → hostname
 */
function isProductionEnvironment(): boolean {
  const cfg = getRuntimeConfig();
  
  // 1. Check runtime config environment field
  if (cfg.environment) {
    return cfg.environment === 'production';
  }
  
  // 2. Check NEXT_PUBLIC_ENVIRONMENT env var
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ENVIRONMENT) {
    return process.env.NEXT_PUBLIC_ENVIRONMENT === 'production';
  }
  
  // 3. Check NODE_ENV
  if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
    return process.env.NODE_ENV === 'production';
  }
  
  // 4. Check hostname (production hosts — not dev.* or dev CloudFront)
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (hostname === 'd2aoyjj8ine0wk.cloudfront.net' || hostname.startsWith('dev.')) {
      return false;
    }
    if (hostname.includes('cloudfront.net') ||
        hostname.includes('warmpawz.com') ||
        hostname.includes('admin.warmpawz.com') ||
        hostname.includes('vendor.warmpawz.com') ||
        hostname.includes('customer.warmpawz.com')) {
      return true;
    }
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('localhost')) {
      return false;
    }
  }
  
  // Default to production for safety
  return true;
}

/** Re-export — see `lib/customer-meal-plans-flag.ts`. */
export { isCustomerMealPlansEnabled, isCustomerMealPlansEnabled as isCustomerWebDevMealPlanOrdersEnabled } from './customer-meal-plans-flag';

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

/**
 * Get the API Base URL from runtime config (deployed) or environment (local dev).
 * 
 * Priority order for LOCALHOST (npm run local:customer):
 * 1. window.__NEXT_PUBLIC_API_BASE_URL__ (injected by layout.tsx from env var)
 * 2. window.__NEXT_DATA__.env.NEXT_PUBLIC_API_BASE_URL (Next.js injected)
 * 3. process.env.NEXT_PUBLIC_API_BASE_URL (build-time)
 * 4. Default: environment-aware API Gateway (same as vendor-web) — avoids sending /public/* to the Next dev server (404)
 * 
 * Priority order for DEPLOYED (CloudFront):
 * 1. runtime-config.js (deploy-time, authoritative)
 * 2. window.__NEXT_PUBLIC_API_BASE_URL__ (fallback)
 * 3. Environment-aware API Gateway selection (last resort)
 * 
 * Do NOT hardcode URLs. Set via runtime-config.js (injected at deploy) or NEXT_PUBLIC_API_BASE_URL.
 */
export function getApiBaseUrl(): string {
  const cfg = getRuntimeConfig();
  
  // Detect if running on localhost (local development)
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1' ||
     window.location.hostname.includes('localhost'));
  
  let raw = '';
  
  // LOCAL DEVELOPMENT: Prioritize explicit API base env; otherwise call AWS API Gateway directly.
  // Defaulting to localhost:3000 breaks routes like /public/policies/* (Next has no such page → 404).
  if (isLocalhost) {
    // 1. Check window.__NEXT_PUBLIC_API_BASE_URL__ (injected by layout.tsx from npm script)
    if (typeof window !== 'undefined' && (window as any).__NEXT_PUBLIC_API_BASE_URL__) {
      raw = (window as any).__NEXT_PUBLIC_API_BASE_URL__;
    }
    // 2. Check window.__NEXT_DATA__.env (Next.js injected env vars)
    else if (typeof window !== 'undefined' && (window as any).__NEXT_DATA__?.env?.NEXT_PUBLIC_API_BASE_URL) {
      raw = (window as any).__NEXT_DATA__.env.NEXT_PUBLIC_API_BASE_URL;
    }
    // 3. Check process.env (available at build time)
    else if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_BASE_URL) {
      raw = process.env.NEXT_PUBLIC_API_BASE_URL;
    }
    // 4. Default: dev API Gateway (same as next.config urls.json). For serverless-offline use NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
    else {
      raw = getApiGatewayUrl();
    }
  } else {
    // When NOT on localhost (deployed environments like CloudFront):
    // Runtime config (runtime-config.js) is injected at DEPLOY TIME and is the
    // authoritative source. Build-time env vars from .env.local may contain
    // dev/staging URLs that should NOT override the deploy-time config.
    //
    // Priority order:
    // 1. runtime-config.js (deploy-time, always correct for the environment)
    // 2. Build-time env vars (fallback only if runtime config is missing)
    // 3. Environment-aware API Gateway selection (last resort)
    if (cfg.apiBaseUrl) {
      raw = cfg.apiBaseUrl;
    }
    // Fallback: build-time env vars (used by prod:customer, prod:vendor locally)
    else if (typeof window !== 'undefined' && (window as any).__NEXT_PUBLIC_API_BASE_URL__) {
      raw = (window as any).__NEXT_PUBLIC_API_BASE_URL__;
    }
    else if (typeof window !== 'undefined' && (window as any).__NEXT_DATA__?.env?.NEXT_PUBLIC_API_BASE_URL) {
      raw = (window as any).__NEXT_DATA__.env.NEXT_PUBLIC_API_BASE_URL;
    }
    else if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_BASE_URL) {
      raw = process.env.NEXT_PUBLIC_API_BASE_URL;
    }
    // Last resort: environment-aware API Gateway selection
    else {
      raw = getApiGatewayUrl();
    }
  }
  
  const result = normalizeDevApiBaseUrl(
    (raw && typeof raw === 'string' ? raw.trim() : '').replace(/\/+$/, '')
  );
  
  // Debug log in UAT mode
  if (typeof window !== 'undefined' && isUatMode()) {
    if (isLocalhost && !result) {
      console.warn('⚠️ [UAT] API Base URL is empty for localhost; using API Gateway fallback');
    }
  }
  
  if (isLocalhost) {
    return result || getApiGatewayUrl();
  }
  
  // For non-localhost, use fallback to API Gateway
  return result || getApiGatewayUrl();
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
  // 1. Check runtime config first (highest priority - set at deploy time)
  if (typeof window !== 'undefined') {
    const cfg = getRuntimeConfig();
    if (cfg.uatMode !== undefined) {
      return cfg.uatMode === true;
    }
    // If runtime config has production environment, disable UAT mode
    if (cfg.environment === 'production') {
      return false;
    }
  }
  
  // 2. Check NEXT_PUBLIC_ENVIRONMENT - if production, disable UAT
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ENVIRONMENT === 'production') {
    return false;
  }
  
  // 3. Check explicit UAT mode flag
  if (process.env.NEXT_PUBLIC_UAT_MODE === 'false') {
    return false;
  }
  if (process.env.NEXT_PUBLIC_UAT_MODE === 'true') {
    return true;
  }
  
  // 4. Fallback: Only enable UAT in development (when not explicitly set to production)
  return process.env.NODE_ENV === 'development';
}

const UAT_MODE = isUatMode();

/**
 * Authorization and UAT headers for browser XMLHttpRequest uploads (e.g. multipart to /storage/upload-media).
 * Keeps behavior aligned with ApiClient.request() so Cognito JWT and UAT phone flows work for uploads.
 */
export function getCustomerAuthHeadersForUpload(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const headers: Record<string, string> = {};

  let token: string | null = null;
  try {
    const { getCognitoIdToken } = require('./cognito-auth');
    token = getCognitoIdToken();
  } catch {
    /* cognito-auth optional in odd bundles */
  }
  if (!token) {
    token = localStorage.getItem('authToken');
  }

  if (UAT_MODE && (!token || !String(token).startsWith('uat-token-'))) {
    const customerPhone = localStorage.getItem('customerPhone');
    if (customerPhone && customerPhone.length >= 10) {
      token = token || `uat-token-customer-${customerPhone}-${Date.now()}`;
    }
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (UAT_MODE) {
    headers['X-UAT-Mode'] = 'true';
    if (token && typeof token === 'string' && token.startsWith('uat-token-')) {
      headers['X-UAT-Token'] = token;
    }
  }

  return headers;
}

/**
 * JSON body for fetch. Avoid `data ? JSON.stringify(data)` — that drops valid JSON when `data` is
 * `0`, `false`, or `""` (truthiness bug). `undefined` / `null` mean no body.
 */
function requestJsonBody(data: unknown): string | undefined {
  if (data === undefined || data === null) return undefined;
  return JSON.stringify(data);
}

/** Prefer server JSON message over generic `HTTP 400` when error is a string or nested object. */
export function extractHttpErrorMessage(errorData: any, status: number): string {
  if (!errorData || typeof errorData !== 'object') {
    return `HTTP ${status}`;
  }
  const e = errorData.error;
  if (typeof e === 'string' && e.trim()) return e.trim();
  if (e && typeof e === 'object') {
    if (typeof e.message === 'string' && e.message.trim()) return e.message.trim();
    if (typeof e.detail === 'string' && e.detail.trim()) return e.detail.trim();
  }
  if (typeof errorData.message === 'string' && errorData.message.trim()) {
    return errorData.message.trim();
  }
  if (typeof errorData.detail === 'string' && errorData.detail.trim()) {
    return errorData.detail.trim();
  }
  return `HTTP ${status}`;
}

export class ApiClient {
  private _baseUrl: string;

  constructor(baseUrl?: string) {
    // Resolve base URL at construction; will be re-resolved lazily in request() if empty
    this._baseUrl = (baseUrl ?? getApiBaseUrl()) || '';
    
    // UAT Mode: Log API configuration for debugging
    if (UAT_MODE && typeof window !== 'undefined') {
      const base = this.getBaseUrl();
      const cfg = getRuntimeConfig();
      const env = cfg.environment || (isProductionEnvironment() ? 'production' : 'development');
      console.log('🔧 [UAT Mode] API Client Initialized');
      console.log('   Base URL:', base || '(will resolve from runtime-config)');
      console.log('   Environment:', env);
    }
  }

  /** Resolve base URL at request time (supports async runtime-config load) */
  private getBaseUrl(): string {
    const resolved = getApiBaseUrl() || this._baseUrl;
    if (resolved) this._baseUrl = resolved;
    return resolved;
  }

  /** Public accessor for base URL (used by invoice/tracking URL builders) */
  get baseUrl(): string {
    return this.getBaseUrl();
  }

  private getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      // Try Cognito token first (preferred for AWS Serverless).
      // getCognitoIdToken() reads the stored bundle synchronously; if the access token is
      // still valid it is returned immediately.  When it has expired, refreshCognitoTokensIfNeeded
      // (called at the top of request()) will have already swapped in a fresh token before
      // this getter is invoked, so the re-read below picks up the updated value.
      // TODO: convert getAuthToken to async and replace getCognitoIdToken() with
      //       refreshCognitoTokensIfNeeded() once callers are migrated to await the result.
      const { getCognitoIdToken } = require('./cognito-auth');
      const cognitoToken = getCognitoIdToken();
      if (cognitoToken) {
        return cognitoToken;
      }
      // Fallback to legacy token
      return localStorage.getItem('authToken');
    }
    return null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryConfig?: Partial<import('./error-handling').RetryConfig>,
    customTimeoutMs?: number,
    internal401RetryDone?: boolean
  ): Promise<T> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      throw new Error(
        'API_BASE_URL is not configured. Set via runtime-config.js (deploy) or NEXT_PUBLIC_API_BASE_URL (local dev).'
      );
    }
    
    // Import error handling utilities
    const { resilientFetch, isOnline, OfflineQueue, ApiError } = await import('./error-handling');
    
    // Initialize offline queue
    if (!this.offlineQueue) {
      this.offlineQueue = new OfflineQueue();
    }
    
    if (!internal401RetryDone) {
      try {
        const { refreshCognitoTokensIfNeeded } = await import('./cognito-auth');
        await refreshCognitoTokensIfNeeded();
      } catch {
        // Never let a refresh failure block the outgoing request.
      }
    }

    // Fix: Normalize URL to avoid double slashes
    const base = baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
    let path = endpoint.replace(/^\/+/, '/');    // Ensure single leading slash

    if (typeof window !== 'undefined') {
      ensureCustomerIdStorageReconciledOnce();
      const uuidSegment = customerUuidSegmentInPath(path);
      if (uuidSegment && !isCustomerDatabaseUuid(uuidSegment)) {
        reconcileCustomerIdStorageOnLoad();
        throw new ApiError(
          'Invalid customer id in request. Please refresh the page or sign in again.',
          'invalid_customer_id',
          400,
          false
        );
      }
    }
    
    // ✅ Auto-add phone parameter to /customer/services/by-style if not present
    if (typeof window !== 'undefined' && path.includes('/customer/services/by-style')) {
      // Check if phone is already in query string
      const hasPhone = path.includes('phone=') || path.includes('customerPhone=');
      
      if (!hasPhone) {
        // Try to get phone from localStorage
        const phone = localStorage.getItem('customerPhone') || localStorage.getItem('customer_phone');
        if (phone && phone.length >= 10) {
          // Append phone parameter to the endpoint
          const separator = path.includes('?') ? '&' : '?';
          path = `${path}${separator}phone=${encodeURIComponent(phone)}`;
        }
      }
    }

    // Same-origin proxy for articles only (static export cannot ship App Router BFF routes).
    // /chat/* always uses API base URL (ensure API Gateway CORS allows localhost in dev).
    const url =
      typeof window !== 'undefined' && path.startsWith('/api/customer/articles')
        ? path
        : `${base}${path}`;
    
    let token = this.getAuthToken();

    // ✅ UAT fallback: if no auth token but we have customer phone (e.g. after refresh), build a UAT token so authorizer allows profile/address routes
    if (typeof window !== 'undefined' && UAT_MODE && (!token || !String(token).startsWith('uat-token-'))) {
      const customerPhone = localStorage.getItem('customerPhone');
      if (customerPhone && customerPhone.length >= 10) {
        const fallbackToken = `uat-token-customer-${customerPhone}-${Date.now()}`;
        token = token || fallbackToken;
      }
    }

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    // CRITICAL FIX: Do NOT set Content-Type for FormData, let fetch handle it
    // Setting Content-Type manually for FormData breaks the boundary parameter
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    // Chat list + booking threads: server reads X-Customer-Phone when present (redundant with query).
    if (typeof window !== 'undefined' && path.startsWith('/chat/')) {
      const ph = localStorage.getItem('customerPhone') || localStorage.getItem('customer_phone');
      if (ph) {
        const d = ph.replace(/\D/g, '');
        if (d.length >= 8) headers['X-Customer-Phone'] = d;
      }
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // ✅ UAT Mode: Send headers so API Gateway authorizer allows the request (phone-based login has no Cognito JWT)
    if (UAT_MODE) {
      headers['X-UAT-Mode'] = 'true';
      // Authorizer requires X-UAT-Token when using UAT; send token so profile, add-address and other customer routes pass
      if (token && typeof token === 'string' && token.startsWith('uat-token-')) {
        headers['X-UAT-Token'] = token;
      }
    }
    
    // UAT Mode: Log API requests for debugging
    if (UAT_MODE && typeof window !== 'undefined') {
      console.log(`🌐 [UAT] API Request: ${options.method || 'GET'} ${endpoint}`);
      console.log('   Full URL:', url);
    }
    
    // Check if offline
    if (!isOnline()) {
      // Queue request if it's a POST/PUT/DELETE
      if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
        this.offlineQueue.addRequest({
          url: endpoint,
          method: options.method,
          body: options.body as string,
          headers,
        });
        throw new ApiError('No network connection. Request queued for later.', 'offline', undefined, true);
      } else {
        throw new ApiError('No network connection', 'offline', undefined, false);
      }
    }
    
    try {
      // ✅ FIX: Use custom timeout for payment endpoints (they need more time)
      const timeout = customTimeoutMs || (endpoint.includes('/razorpay/') ? 45000 : undefined); // 45s for payment endpoints
      const response = await resilientFetch(url, {
        ...options,
        headers,
      }, retryConfig, timeout);

      if (!response.ok) {
        // Try to parse JSON, but also capture raw text if JSON parsing fails
        let errorData: any = { error: 'Unknown error' };
        let rawResponseText: string | null = null;
        
        try {
          const responseText = await response.text();
          rawResponseText = responseText;
          
          if (responseText) {
            try {
              errorData = JSON.parse(responseText);
            } catch (parseError) {
              // If JSON parsing fails, use the raw text as the error message
              errorData = { 
                error: responseText || `HTTP ${response.status}`,
                message: responseText || `HTTP ${response.status}`,
                rawResponse: responseText
              };
            }
          }
        } catch (textError) {
          // If even text extraction fails, use status-based error
          errorData = { 
            error: `HTTP ${response.status}`,
            message: `HTTP ${response.status}: ${response.statusText || 'Unknown error'}`,
            status: response.status,
            statusText: response.statusText
          };
        }
        // 402 Payment Required: ensure error body has code so frontend can proceed to payment (even if body was empty)
        if (response.status === 402 && !errorData?.error?.code && typeof errorData?.error !== 'object') {
          errorData = {
            ...errorData,
            success: false,
            error: {
              code: 'PAYMENT_REQUIRED',
              message: (typeof errorData?.error === 'object' && errorData?.error?.message) || errorData?.message || 'Payment required before booking creation',
              details: (typeof errorData?.error === 'object' && errorData?.error?.details) || { paymentRequired: true },
            },
          };
        }
        
        const isCustomerForgotPasswordFlow =
          path.includes('/auth/customer/forgot-password/verify-otp') ||
          path.includes('/auth/customer/forgot-password/reset');

        const hadBearerAuth = !!(headers.Authorization && String(headers.Authorization).length > 'Bearer '.length);
        /** Some GET catalogue routes may 401 anonymously — never treat as global sign-out */
        const isOptionalUnauthRead =
          (options.method ?? 'GET').toUpperCase() === 'GET' &&
          (/^\/customer\/articles/.test(path) ||
            /^\/customer\/banners/.test(path) ||
            /^\/customer\/announcements/.test(path));

        const uatSyntheticBearer =
          UAT_MODE && !!token && typeof token === 'string' && token.startsWith('uat-token-');

        const hasCognitoPersistedBundle =
          typeof window !== 'undefined' && !!localStorage.getItem('customerCognitoTokens');

        /** Legacy login may only set `authToken` (JWT) without the Cognito key */
        const hasLegacyJwtAuthToken =
          typeof window !== 'undefined' &&
          !!(localStorage.getItem('authToken') || '').startsWith('eyJ');

        const canSilentRefresh401 =
          hadBearerAuth && hasCognitoPersistedBundle && !uatSyntheticBearer && !internal401RetryDone;

        const treat401AsFullSignOut =
          hadBearerAuth && !uatSyntheticBearer && !isOptionalUnauthRead && (
            hasCognitoPersistedBundle || hasLegacyJwtAuthToken
          );

        let suppressForcedLogout401 = false;

        if (
          response.status === 401 &&
          !path.startsWith('/public/') &&
          !isCustomerForgotPasswordFlow &&
          !isOptionalUnauthRead &&
          typeof window !== 'undefined' &&
          canSilentRefresh401
        ) {
          try {
            const { refreshCognitoAfterUnauthorized401 } = await import('./cognito-auth');
            const refreshed = await refreshCognitoAfterUnauthorized401();
            if (refreshed.kind === 'renewed') {
              return this.request<T>(
                endpoint,
                options,
                retryConfig,
                customTimeoutMs,
                true
              );
            }
            if (refreshed.kind === 'failed_network') {
              suppressForcedLogout401 = true;
              if (process.env.NODE_ENV !== 'production') {
                console.warn('[customer-api] 401 + refresh unreachable — no forced logout');
              }
            }
          } catch {
            /* ignore */
          }
        }

        if (
          response.status === 401 &&
          !path.startsWith('/public/') &&
          !isCustomerForgotPasswordFlow &&
          !isOptionalUnauthRead &&
          typeof window !== 'undefined' &&
          treat401AsFullSignOut &&
          !suppressForcedLogout401
        ) {
          const { clearCognitoTokens } = await import('./cognito-auth');
          clearCognitoTokens();
          localStorage.removeItem('authToken');
          localStorage.removeItem('customerPhone');
          window.location.href = '/auth';
        }
        
        // Create ApiError with full error data preserved
        const errorMessage = extractHttpErrorMessage(errorData, response.status);
        const apiError = new ApiError(
          errorMessage,
          errorData.error?.code || (response.status >= 500 ? 'server_error' : 'client_error'),
          response.status,
          [408, 429, 500, 502, 503, 504].includes(response.status)
        );
        
        // Attach full error data for detailed error handling
        (apiError as any).response = errorData;
        (apiError as any).responseData = errorData;
        (apiError as any).rawResponse = rawResponseText;
        (apiError as any).statusCode = response.status;
        (apiError as any).status = response.status;
        
        // Log error details in UAT mode
        if (UAT_MODE && typeof window !== 'undefined') {
          console.error('🌐 [UAT] API Error Details:', {
            url,
            status: response.status,
            statusText: response.statusText,
            errorData,
            rawResponse: rawResponseText
          });
        }
        
        throw apiError;
      }

      return response.json();
    } catch (error: any) {
      // Re-throw ApiError as-is
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Check for CORS errors in the error message
      if (
        error.message?.includes('CORS') ||
        error.message?.includes('blocked by CORS policy') ||
        error.message?.includes('preflight request') ||
        error.message?.includes('ERR_FAILED') && error.message?.includes('fetch')
      ) {
        throw new ApiError(
          'CORS error: API endpoint configuration issue',
          'CORS_ERROR',
          undefined,
          false, // Not retryable
          error
        );
      }
      
      // Wrap other errors
      throw new ApiError(
        error.message || 'Unknown error',
        'unknown',
        undefined,
        false,
        error
      );
    }
  }
  
  private offlineQueue?: import('./error-handling').OfflineQueue;

  async get<T>(endpoint: string, retryConfig?: Partial<import('./error-handling').RetryConfig>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, retryConfig);
  }

  /**
   * GET that treats 404 as “no resource” (e.g. new customer with no unified profile yet).
   * Does not throw on 404; rethrows all other errors.
   */
  async getOrUndefinedIfNotFound<T>(endpoint: string): Promise<T | undefined> {
    const { ApiError } = await import('./error-handling');
    try {
      return await this.get<T>(endpoint);
    } catch (e: unknown) {
      if (e instanceof ApiError && e.statusCode === 404) {
        return undefined;
      }
      throw e;
    }
  }

  /**
   * GET /customer/articles* list — returns `{ articles: [] }` on 502/503 so the UI can show an empty state
   * instead of "HTTP 503" while the API is down or not yet deployed. Uses a single request (no 503 retry loop).
   * Concurrent calls with the same endpoint share one fetch (dedupes React Strict Mode double effects in dev).
   * Must not `await` before registering the in-flight entry — otherwise two callers can race and duplicate requests.
   */
  getCustomerArticlesList<T extends { articles?: unknown[] }>(endpoint: string): Promise<T> {
    const key = endpoint;
    const existing = customerArticlesListInflight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const fetchPath = customerArticlesListFetchPath(endpoint);

    const noRetry: Partial<import('./error-handling').RetryConfig> = {
      maxRetries: 0,
      retryableStatusCodes: [],
      retryableErrors: [],
    };

    const p = (async (): Promise<T> => {
      try {
        return await this.get<T>(fetchPath, noRetry);
      } catch (e: unknown) {
        if (e instanceof ApiError && e.statusCode != null && [502, 503].includes(e.statusCode)) {
          return { articles: [] } as unknown as T;
        }
        throw e;
      }
    })().finally(() => {
      customerArticlesListInflight.delete(key);
    });

    customerArticlesListInflight.set(key, p);
    return p;
  }

  async post<T>(endpoint: string, data?: any, retryConfig?: Partial<import('./error-handling').RetryConfig>, customTimeoutMs?: number): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      // CRITICAL: Don't stringify FormData - pass it directly
      body: data instanceof FormData ? data : requestJsonBody(data),
    }, retryConfig, customTimeoutMs);
  }

  async put<T>(endpoint: string, data?: any, retryConfig?: Partial<import('./error-handling').RetryConfig>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: requestJsonBody(data),
    }, retryConfig);
  }

  async patch<T>(endpoint: string, data?: any, retryConfig?: Partial<import('./error-handling').RetryConfig>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: requestJsonBody(data),
    }, retryConfig);
  }

  async delete<T>(endpoint: string, data?: any, retryConfig?: Partial<import('./error-handling').RetryConfig>): Promise<T> {
    return this.request<T>(endpoint, { 
      method: 'DELETE',
      body: requestJsonBody(data),
    }, retryConfig);
  }

  /**
   * Upload file using FormData
   * Note: Content-Type is automatically set to multipart/form-data by the browser
   */
  async upload<T>(endpoint: string, formData: FormData, retryConfig?: Partial<import('./error-handling').RetryConfig>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: formData,
    }, retryConfig);
  }
  
  /**
   * Sync offline queue when back online
   */
  async syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
    const { OfflineQueue } = await import('./error-handling');
    if (!this.offlineQueue) {
      this.offlineQueue = new OfflineQueue();
    }
    return this.offlineQueue.sync();
  }

  // Set auth token (typically after OTP verification)
  setAuthToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('authToken', token);
    }
  }

  // Clear auth token
  clearAuth(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
      localStorage.removeItem('customerPhone');
    }
  }
}

export const apiClient = new ApiClient();

// ✅ NEW: AI Chatbot API (Phase 3 - AI Chatbot Integration)
export const aiChatbotApi = {
  chat: (data: {
    message: string;
    customerId?: string;
    customerPhone?: string;
    conversationId?: string;
    /** e.g. { widgetMode: 'chat' } so the API aligns quick actions with the Chat tab */
    context?: Record<string, unknown>;
    petId?: string;
  }) => apiClient.post('/ai-chatbot/chat', data),
  
  symptomsChecker: (data: {
    symptoms: string;
    petId?: string;
    petType?: string;
    petAge?: string;
    customerId?: string;
    customerPhone?: string;
  }) => apiClient.post('/ai-chatbot/symptoms-checker', data),
  
  bookingAssist: (data: {
    query: string;
    customerId?: string;
    customerPhone?: string;
    location?: { lat: number; lng: number };
    petId?: string;
  }) => apiClient.post('/ai-chatbot/booking-assist', data),
  
  escalateToAgent: (data: {
    conversationId: string;
    customerId?: string;
    customerPhone?: string;
    reason?: string;
    conversationHistory?: string;
  }) => apiClient.post('/ai-chatbot/escalate-to-agent', data),
  
  getConversation: (conversationId: string) => 
    apiClient.get(`/ai-chatbot/conversation/${conversationId}`),

  createBookingSession: (data: {
    customerId?: string;
    customerPhone?: string;
    category?: string;
    serviceStyle?: string;
  }) => apiClient.post('/ai-chatbot/booking-session', data),

  getBookingSession: (sessionId: string) => apiClient.get(`/ai-chatbot/booking-session/${sessionId}`),

  patchBookingSession: (sessionId: string, body: Record<string, unknown>) =>
    apiClient.patch(`/ai-chatbot/booking-session/${sessionId}`, body),

  commitBookingSlot: (sessionId: string, body: { slotTime: string; expectedVersion?: number }) =>
    apiClient.post(`/ai-chatbot/booking-session/${sessionId}/commit-slot`, body),

  prepareBookingPayment: (sessionId: string, body?: { customerId?: string; customerPhone?: string }) =>
    apiClient.post(`/ai-chatbot/booking-session/${sessionId}/prepare-payment`, body || {}),

  interpretBookingSession: (sessionId: string, body: { message: string }) =>
    apiClient.post(`/ai-chatbot/booking-session/${sessionId}/interpret`, body),
};

/** No HTTP retries for support ticket reads (manual refresh in UI; avoid retry spam). */
const supportTicketReadRetry: Partial<import('./error-handling').RetryConfig> = { maxRetries: 0 };

// ✅ NEW: Support & CRM API (Phase 3 - AI Chatbot Integration)
export const supportCrmApi = {
  createTicket: (data: {
    customerId?: string;
    customerPhone?: string;
    subject: string;
    message: string;
    source?: string;
    priority?: string;
    category?: string;
    bookingId?: string;
    orderId?: string;
  }) => apiClient.post('/support/tickets', data),
  
  getTickets: (params?: {
    customerId?: string;
    customerPhone?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) => {
    if (!params) {
      return apiClient.get('/support/tickets', supportTicketReadRetry);
    }
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      q.set(k, String(v));
    }
    const s = q.toString();
    return apiClient.get(`/support/tickets${s ? `?${s}` : ''}`, supportTicketReadRetry);
  },
  
  getTicket: (ticketId: string) => apiClient.get(`/support/tickets/${ticketId}`, supportTicketReadRetry),
  
  respondToTicket: (ticketId: string, data: {
    message: string;
    responderId?: string;
    responderType?: 'agent' | 'customer';
  }) => apiClient.post(`/support/tickets/${ticketId}/respond`, data),
  
  updateTicketStatus: (ticketId: string, status: string, resolution?: string) =>
    apiClient.put(`/support/tickets/${ticketId}/status`, { status, resolution }),
};

// ✅ NEW: Bookings CRUD API
export const bookingsApi = {
  // CREATE
  create: (data: {
    customerId: string;
    vendorId: string;
    serviceId: string;
    bookingDate: string;
    bookingTime: string;
    serviceType?: 'at_vendor' | 'at_center' | 'at_home' | 'tele';
    address?: string;
    staffId?: string;
    petId?: string;
    amount?: number;
    idempotencyKey?: string;
  }) => apiClient.post('/bookings/create', data),

  // READ
  get: (bookingId: string) => apiClient.get(`/bookings/${bookingId}`),
  getHistory: (bookingId: string) => apiClient.get(`/bookings/${bookingId}/history`),
  list: (params?: {
    customerId?: string;
    vendorId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) => {
    const query = params ? new URLSearchParams(Object.entries(params).map(([k,v]) => [k, String(v)])).toString() : '';
    return apiClient.get(`/customer/${params?.customerId || 'bookings'}/bookings${query ? `?${query}` : ''}`);
  },

  // UPDATE
  updateStatus: (bookingId: string, data: {
    status: string;
    reason?: string;
    actorId?: string;
    actorType?: string;
  }) => apiClient.put(`/bookings/${bookingId}/status`, data),

  // CANCEL
  cancel: (bookingId: string, data: {
    reason?: string;
    customerId?: string;
    actorId?: string;
    actorType?: string;
  }) => apiClient.post(`/bookings/${bookingId}/cancel`, data),

  // RESCHEDULE
  reschedule: (bookingId: string, data: {
    newDate: string;
    newTime: string;
    reason?: string;
    customerId?: string;
    actorId?: string;
    actorType?: string;
  }) => apiClient.post(`/bookings/${bookingId}/reschedule`, data),
};

// ✅ NEW: Orders CRUD API
export const ordersApi = {
  // CREATE
  create: (data: {
    customerId: string;
    vendorId?: string;
    items: Array<{
      productId?: string;
      serviceId?: string;
      name: string;
      quantity: number;
      unitPrice: number;
      category?: string;
      hsnCode?: string;
    }>;
    shippingAddress: any;
    subtotal: number;
    taxAmount?: number;
    shippingAmount?: number;
    discountAmount?: number;
    totalAmount: number;
  }) => apiClient.post('/orders', data),

  // READ
  get: (orderId: string) => apiClient.get(`/customer/orders/${orderId}`),
  list: (params?: {
    customerId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) => {
    const query = params ? new URLSearchParams(Object.entries(params).map(([k,v]) => [k, String(v)])).toString() : '';
    return apiClient.get(`/customer/orders${query ? `?${query}` : ''}`);
  },
  getInvoice: (orderId: string) => apiClient.get(`/customer/orders/${orderId}/invoice`),
  getTracking: (orderId: string) => apiClient.get(`/orders/${orderId}/tracking`),

  // UPDATE
  update: (orderId: string, data: {
    shippingAddress?: any;
    shippingCity?: string;
    shippingState?: string;
    shippingPincode?: string;
    shippingPhone?: string;
    subtotal?: number;
    taxAmount?: number;
    shippingAmount?: number;
    discountAmount?: number;
    totalAmount?: number;
    items?: Array<any>;
  }) => apiClient.put(`/orders/${orderId}`, data),
  updateStatus: (orderId: string, data: {
    status: string;
    trackingNumber?: string;
    notes?: string;
  }) => apiClient.put(`/orders/${orderId}/status`, data),

  // CANCEL
  cancel: (orderId: string, data: {
    reason?: string;
  }) => apiClient.post(`/orders/${orderId}/cancel`, data),
};

// ✅ NEW: Customer CRUD API
export const customerApi = {
  // READ
  get: (customerId: string) => apiClient.get(`/customer/${customerId}`),
  getByPhone: (phone: string) => apiClient.get(`/customer/by-phone?phone=${encodeURIComponent(phone)}`),

  // UPDATE
  update: (customerId: string, data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    address?: string;
    pincode?: string;
    photo?: string;
  }) => apiClient.put(`/customer/${customerId}`, data),

  // DELETE (deactivate)
  deactivate: (customerId: string, data?: {
    reason?: string;
    permanentDelete?: boolean;
  }) => apiClient.delete(`/customer/${customerId}`, data),
};

// ✅ NEW: Pets CRUD API
export const petsApi = {
  // CREATE
  create: (data: {
    customerId: string;
    name: string;
    species: string;
    breed?: string;
    age?: number;
    ageUnit?: 'years' | 'months';
    gender?: string;
    weight?: number;
    color?: string;
    photos?: string[];
    medicalHistory?: any;
    vaccinationStatus?: boolean;
    spayedNeutered?: boolean;
    microchipped?: boolean;
    specialNeeds?: string;
  }) => apiClient.post('/pets', data),

  // READ
  get: (petId: string) => apiClient.get(`/pets/${petId}`),
  getByCustomer: (customerId: string) => apiClient.get(`/pets/customer/${customerId}`),
  getByPhone: (phone: string) => apiClient.get(`/customer/pets/${phone}`),

  // UPDATE
  update: (petId: string, data: {
    name?: string;
    species?: string;
    breed?: string;
    age?: number;
    ageUnit?: 'years' | 'months';
    gender?: string;
    weight?: number;
    photos?: string[];
    medicalHistory?: any;
  }) => apiClient.put(`/pets/${petId}`, data),

  // DELETE
  delete: (petId: string) => apiClient.delete(`/pets/${petId}`),
};

// ✅ NEW: Addresses CRUD API
export const addressesApi = {
  // CREATE
  create: (customerId: string, data: {
    label?: string;
    name: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
    landmark?: string;
    coordinates?: any;
    isDefault?: boolean;
  }) => apiClient.post(`/customer/${customerId}/addresses`, data),

  // READ
  list: (customerId: string) => apiClient.get(`/customer/${customerId}/addresses`),

  // UPDATE
  update: (customerId: string, addressId: string, data: {
    label?: string;
    name?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    landmark?: string;
    coordinates?: any;
    isDefault?: boolean;
  }) => apiClient.put(`/customer/${customerId}/addresses/${addressId}`, data),

  // DELETE
  delete: (customerId: string, addressId: string) => apiClient.delete(`/customer/${customerId}/addresses/${addressId}`),
};

