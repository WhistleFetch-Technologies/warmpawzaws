/**
 * API Client for Admin Web App
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
 * Checks: runtime config → NEXT_PUBLIC_ENVIRONMENT → NODE_ENV → hostname
 */
function isProductionEnvironment(): boolean {
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('localhost')) {
      return false;
    }
    // Dev hostnames and dev admin CloudFront (not prod distributions)
    if (hostname.startsWith('dev.') && hostname.includes('warmpawz.com')) {
      return false;
    }
    if (hostname === 'dfof7mguaa0a5.cloudfront.net') {
      return false;
    }
    // Production: exact prod domains or prod CloudFront URLs (not dev.*)
    const isProdHostname =
      hostname === 'admin.warmpawz.com' ||
      hostname === 'vendor.warmpawz.com' ||
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
  
  // Check prod mode flag
  if (typeof window !== 'undefined' && (window as any).__WARMPAWZ_PROD_MODE__ === true) {
    return true;
  }
  
  const cfg = getRuntimeConfig();
  
  // Check runtime config environment field
  if (cfg.environment) {
    return cfg.environment === 'production';
  }
  
  // Check NEXT_PUBLIC_ENVIRONMENT env var
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ENVIRONMENT) {
    return process.env.NEXT_PUBLIC_ENVIRONMENT === 'production';
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
    : DEV_API_GATEWAY_URL;
}

export function getApiBaseUrl(): string {
  const cfg = getRuntimeConfig();

  let raw = '';
  if (cfg.apiBaseUrl) {
    raw = cfg.apiBaseUrl;
  } else if (typeof window !== 'undefined' && (window as any).__NEXT_PUBLIC_API_BASE_URL__) {
    raw = (window as any).__NEXT_PUBLIC_API_BASE_URL__;
  } else if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_BASE_URL) {
    raw = process.env.NEXT_PUBLIC_API_BASE_URL;
  } else {
    return getApiGatewayUrl();
  }

  const normalized = normalizeDevApiBaseUrl((raw && typeof raw === 'string' ? raw.trim() : '').replace(/\/+$/, ''));
  return normalized || getApiGatewayUrl();
}

// UAT Mode: Check runtime config FIRST (deploy-time), then build-time env (local dev)
// ✅ FIX: NEVER allow UAT mode on production hostnames
export function isUatMode(): boolean {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname || '';
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isDevSubdomain = hostname.startsWith('dev.') && hostname.includes('warmpawz.com');
    const isProductionHostname =
      hostname === 'admin.warmpawz.com' ||
      hostname === 'vendor.warmpawz.com' ||
      hostname === 'customer.warmpawz.com' ||
      hostname === 'warmpawz.com' ||
      hostname === 'www.warmpawz.com' ||
      hostname === 'dbr09zyoq9akb.cloudfront.net' ||
      hostname === 'd1y5ywletev82x.cloudfront.net' ||
      hostname === 'dg69gqp2frh39.cloudfront.net';

    if (isProductionHostname && !isDevSubdomain && !isLocalhost) {
      return false;
    }
    
    // Check prod mode flag
    if ((window as any).__WARMPAWZ_PROD_MODE__ === true) {
      return false;
    }
    
    if (getRuntimeConfig().uatMode === true) {
      return true;
    }
  }
  return process.env.NEXT_PUBLIC_UAT_MODE === 'true' || process.env.NODE_ENV === 'development';
}

const UAT_MODE = isUatMode();

// Rate limiting: Track last request time per endpoint to prevent rapid retries
const rateLimitCache = new Map<string, { lastRequest: number; retryAfter?: number }>();

// Custom error class for rate limiting
export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter?: number,
    public endpoint?: string
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    // Use provided URL or get from config (with fallback)
    const url = baseUrl || getApiBaseUrl();
    this.baseUrl = url || '';
    
    // UAT Mode: Log API configuration for debugging
    if (UAT_MODE && typeof window !== 'undefined') {
      console.log('🔧 [UAT Mode] API Client Initialized (Admin)');
      console.log('   Base URL:', this.baseUrl || '(will be loaded dynamically)');
      console.log('   Environment:', process.env.NODE_ENV);
      console.log('   Runtime Config:', getRuntimeConfig());
      
      // Warn if config not loaded, but don't fail - will retry on first request
      if (!this.baseUrl) {
        console.warn('⚠️ API_BASE_URL is empty. Will retry on first request. Check runtime-config.js is loaded.');
      }
    }
  }
  
  // Method to refresh base URL (useful if runtime config loads after initialization)
  refreshBaseUrl(): void {
    const newUrl = getApiBaseUrl();
    if (newUrl && newUrl !== this.baseUrl) {
      this.baseUrl = newUrl;
      if (UAT_MODE && typeof window !== 'undefined') {
        console.log('✅ [API Client] Base URL refreshed:', this.baseUrl);
      }
    }
  }

  private getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      // Try Cognito token first (preferred for AWS Serverless)
      const { getCognitoIdToken } = require('./cognito-auth');
      const cognitoToken = getCognitoIdToken();
      if (cognitoToken) {
        return cognitoToken;
      }
      // Fallback to legacy token
      return localStorage.getItem('adminAuthToken');
    }
    return null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    // Get base URL dynamically (in case runtime config loads after component mount)
    // Try multiple times to get the URL
    let currentBaseUrl = this.baseUrl || getApiBaseUrl();
    
    // If still empty, wait a bit and retry (runtime-config.js might be loading)
    if (!currentBaseUrl && typeof window !== 'undefined') {
      const windowConfig = window.__WARMPAWZ_RUNTIME_CONFIG__;
      if (windowConfig?.apiBaseUrl) {
        currentBaseUrl = normalizeDevApiBaseUrl(windowConfig.apiBaseUrl) || '';
      }
    }
    
    if (!currentBaseUrl) {
      const errorMsg = 'API_BASE_URL is not configured. Please check runtime-config.js or NEXT_PUBLIC_API_BASE_URL environment variable.';
      console.error('❌ [API Client]', errorMsg);
      console.error('   Runtime Config:', getRuntimeConfig());
      console.error('   Window Config:', typeof window !== 'undefined' ? window.__WARMPAWZ_RUNTIME_CONFIG__ : 'N/A');
      console.error('   Endpoint:', endpoint);
      throw new Error(errorMsg);
    }
    
    // Update baseUrl if it was empty but now we have a value
    if (!this.baseUrl && currentBaseUrl) {
      this.baseUrl = currentBaseUrl;
      if (UAT_MODE && typeof window !== 'undefined') {
        console.log('✅ [API Client] Base URL updated:', this.baseUrl);
      }
    }
    
    // Check rate limiting: If we recently got a 429 for this endpoint, wait before retrying
    const cacheKey = `${options.method || 'GET'}:${endpoint}`;
    const cached = rateLimitCache.get(cacheKey);
    const now = Date.now();
    
    if (cached) {
      // If we have a retryAfter time and haven't waited long enough, throw immediately
      if (cached.retryAfter && now < cached.lastRequest + cached.retryAfter) {
        const waitTime = Math.ceil((cached.lastRequest + cached.retryAfter - now) / 1000);
        throw new RateLimitError(
          `Rate limit exceeded. Please wait ${waitTime} second(s) before retrying.`,
          cached.retryAfter,
          endpoint
        );
      }
      
      // If we got a 429 recently (within last 5 seconds) and no retryAfter, prevent immediate retry
      if (now - cached.lastRequest < 5000 && cached.retryAfter === undefined) {
        throw new RateLimitError(
          'Too many requests. Please wait a moment before retrying.',
          5000,
          endpoint
        );
      }
    }
    
    // Fix: Normalize URL to avoid double slashes
    const base = currentBaseUrl.replace(/\/+$/, ''); // Remove trailing slashes
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
    
    // UAT Mode: Add special header to bypass Cognito authorizer
    if (UAT_MODE && typeof window !== 'undefined') {
      headers['X-UAT-Mode'] = 'true';
      // Also add X-UAT-Token for Lambda to validate
      if (token && token.startsWith('uat-token-')) {
        headers['X-UAT-Token'] = token;
      }
      console.log(`🌐 [UAT] API Request: ${options.method || 'GET'} ${endpoint}`);
      console.log('   Full URL:', url);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (fetchError: any) {
      throw fetchError;
    }

    if (!response.ok) {
      let error: any = {};
      let errorText = '';
      
      try {
        // Try to get response text first
        errorText = await response.text();
        
        // Try to parse as JSON
        if (errorText) {
          try {
            error = JSON.parse(errorText);
          } catch {
            // Not JSON, use as string
            error = { error: errorText || `HTTP ${response.status}: ${response.statusText}` };
          }
        } else {
          error = { 
            error: `HTTP ${response.status}: ${response.statusText}`,
            message: `Request failed with status ${response.status}`
          };
        }
      } catch (parseError) {
        // If all parsing fails, create safe error
        error = { 
          error: `HTTP ${response.status}: ${response.statusText}`,
          message: `Request failed with status ${response.status}`
        };
      }
      
      // Safely extract error message - prevent "[object Object]" errors
      const getErrorMessage = (err: any): string => {
        if (typeof err === 'string') return err;
        if (err?.error && typeof err.error === 'string') return err.error;
        if (err?.message && typeof err.message === 'string') return err.message;
        if (err && typeof err === 'object') {
          try {
            const str = JSON.stringify(err);
            return str.length > 200 ? str.substring(0, 200) + '...' : str;
          } catch {
            return `HTTP ${response.status}: ${response.statusText}`;
          }
        }
        return `HTTP ${response.status}: ${response.statusText}`;
      };
      
      const errorMsg = getErrorMessage(error);
      
      // Handle 404: Endpoint not found - provide helpful error message
      if (response.status === 404) {
        if (UAT_MODE && typeof window !== 'undefined') {
          console.error(`❌ [API Client] 404 Error for ${endpoint}:`, errorMsg);
          console.error('   Full URL:', url);
          console.error('   Base URL:', currentBaseUrl);
          console.error('   Check if the endpoint exists in API Gateway');
        }
        throw new Error(`Endpoint not found: ${endpoint}. Please check if the API route is configured.`);
      }
      
      // Handle 429: Rate limiting - extract Retry-After header if present
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfter = retryAfterHeader 
          ? parseInt(retryAfterHeader, 10) * 1000 // Convert seconds to milliseconds
          : Math.min(5000 * Math.pow(2, retryCount), 30000); // Exponential backoff: 5s, 10s, 20s, max 30s
        
        // Cache the rate limit info
        rateLimitCache.set(cacheKey, {
          lastRequest: Date.now(),
          retryAfter,
        });
        
        // Clear cache after retryAfter time
        setTimeout(() => {
          rateLimitCache.delete(cacheKey);
        }, retryAfter);
        
        throw new RateLimitError(
          errorMsg,
          retryAfter,
          endpoint
        );
      }
      
      // Handle 401: In UAT mode or for admin routes, don't redirect - let components handle gracefully
      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          // Check if we're in UAT mode - if so, don't redirect, just throw error
          const isUat = getRuntimeConfig().uatMode || UAT_MODE;
          const isAdminRoute = endpoint.startsWith('/admin');
          
          // Don't redirect if in UAT mode OR if it's an admin route (admin app should handle auth differently)
          if (!isUat && !isAdminRoute) {
            // Only redirect in production mode for non-admin routes
            localStorage.removeItem('adminAuthToken');
            localStorage.removeItem('adminId');
            window.location.href = '/';
          } else {
            // In UAT mode or admin routes, just throw error with helpful message
            if (UAT_MODE) {
              console.warn('⚠️ [API Client] 401 Unauthorized - Check authentication token');
              console.warn('   Endpoint:', endpoint);
              console.warn('   Token present:', !!token);
            }
          }
        }
      }
      
      // Handle 500: Server error
      if (response.status >= 500) {
        if (UAT_MODE && typeof window !== 'undefined') {
          console.error(`❌ [API Client] Server error for ${endpoint}:`, errorMsg);
        }
        throw new Error(`Server error: ${errorMsg}`);
      }
      
      // Generic error for other status codes
      throw new Error(errorMsg);
    }

    // Success: Clear any rate limit cache for this endpoint
    rateLimitCache.delete(cacheKey);
    
    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
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

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /** Get current API base URL (for FormData/fetch when apiClient methods don't apply) */
  getBaseUrl(): string {
    return this.baseUrl || getApiBaseUrl();
  }

  // Set auth token (typically after login)
  setAuthToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('adminAuthToken', token);
    }
  }

  // Clear auth token
  clearAuth(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('adminAuthToken');
      localStorage.removeItem('adminId');
      localStorage.removeItem('adminPermissions');
    }
  }
}

export const apiClient = new ApiClient();

