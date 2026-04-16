/**
 * API Client for Vendor Web App
 * Uses API Gateway (Lambda backend)
 */

import { VENDOR_POST_LOGIN_401_GRACE_MS } from './vendor-session-from-api';

type RuntimeConfig = {
  apiBaseUrl?: string;
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
      // Try Cognito token first (preferred for AWS Serverless)
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
    options: RequestInit = {}
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
      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          const loginAt = Number(sessionStorage.getItem('_warmpawz_vendor_login_at') || 0);
          const inGrace = loginAt > 0 && Date.now() - loginAt < VENDOR_POST_LOGIN_401_GRACE_MS;
          const justLoggedIn = sessionStorage.getItem('_warmpawz_vendor_just_logged_in') === 'true';
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

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    // Handle FormData - don't stringify or set Content-Type header
    if (data instanceof FormData) {
      const token = this.getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Don't set Content-Type for FormData - browser will set it with boundary
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: data,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || error.message || `HTTP ${response.status}`);
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

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
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
