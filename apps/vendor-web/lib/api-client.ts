/**
 * API Client for Vendor Web App
 * Uses API Gateway (Lambda backend)
 */

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
  
  // 4. Check hostname (production CloudFront domains)
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    // Production CloudFront domains
    if (hostname.includes('cloudfront.net') || 
        hostname.includes('warmpawz.com') ||
        hostname.includes('admin.warmpawz.com') ||
        hostname.includes('vendor.warmpawz.com') ||
        hostname.includes('customer.warmpawz.com')) {
      return true;
    }
    // Development indicators
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('localhost')) {
      return false;
    }
  }
  
  // Default to production for safety
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
    : 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
}

export function getApiBaseUrl(): string {
  // Priority: runtime-config.js (deploy-time) → build-time env (local dev) → environment-based fallback
  const cfg = getRuntimeConfig();
  
  if (cfg.apiBaseUrl) {
    return cfg.apiBaseUrl;
  }
  
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  
  // ✅ FIX: Use environment-aware API Gateway selection (no hardcoded fallback)
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
    
    // UAT Mode: Log API configuration for debugging
    if (UAT_MODE && typeof window !== 'undefined') {
      console.log('🔧 [UAT Mode] API Client Initialized (Vendor)');
      console.log('   Base URL:', this.baseUrl);
      console.log('   Environment:', process.env.NODE_ENV);
    }
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
    
    // UAT Mode: Log API requests for debugging
    if (UAT_MODE && typeof window !== 'undefined') {
      console.log(`🌐 [UAT] API Request: ${options.method || 'GET'} ${endpoint}`);
      console.log('   Full URL:', url);
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
      
      // Handle 401: clear full vendor session so /auth shows login (prevents redirect loop)
      // Skip clear/redirect when vendor just logged in (OTP) so dashboard can load; first 401 may be from role/profile fetch race
      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          const justLoggedIn = sessionStorage.getItem('_warmpawz_vendor_just_logged_in') === 'true';
          if (justLoggedIn) {
            sessionStorage.removeItem('_warmpawz_vendor_just_logged_in');
            if (UAT_MODE) {
              console.warn('[API Client] 401 after login – skipping clear/redirect so dashboard can load');
            }
            // Fall through to throw error; caller (e.g. useVendorCapabilities) will use fallback
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
        
        // Log rate limit error with details
        if (UAT_MODE && typeof window !== 'undefined') {
          console.error('❌ [UAT] Rate Limit Error (429):', {
            endpoint,
            retryAfter: retryAfterSeconds,
            errorData
          });
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
      
      // Log the full error for debugging in UAT mode
      if (UAT_MODE && typeof window !== 'undefined') {
        console.error('❌ [UAT] API Error Response:', errorData);
        console.error('❌ [UAT] Extracted error message:', errorMessage);
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
