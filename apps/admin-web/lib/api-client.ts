/**
 * API Client for Admin Web App
 * Points to API Gateway instead of Supabase Functions
 */

type RuntimeConfig = {
  apiBaseUrl?: string;
  uatMode?: boolean;
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

function getApiBaseUrl(): string {
  // Priority: runtime-config.js (deploy-time) → build-time env (local dev)
  const cfg = getRuntimeConfig();
  return (
    cfg.apiBaseUrl ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ''
  );
}

// UAT Mode: Check runtime config FIRST (deploy-time), then build-time env (local dev)
export function isUatMode(): boolean {
  if (typeof window !== 'undefined' && getRuntimeConfig().uatMode === true) {
    return true;
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
      // Check window config directly
      const windowConfig = window.__WARMPAWZ_RUNTIME_CONFIG__;
      if (windowConfig?.apiBaseUrl) {
        currentBaseUrl = windowConfig.apiBaseUrl;
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
    
    // #region agent log
    if (typeof window !== 'undefined') {
      fetch('http://127.0.0.1:7242/ingest/892f647a-2ee5-41db-bfad-3ff67af0ff8d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api-client.ts:191',message:'Before fetch',data:{url,method:options.method||'GET',hasOrigin:!!headers.Origin,headers:Object.keys(headers)},timestamp:Date.now(),sessionId:'debug-session',runId:'browser-test',hypothesisId:'G'})}).catch(()=>{});
    }
    // #endregion
    let response: Response;
    try {
      // #region agent log
      if (typeof window !== 'undefined') {
        fetch('http://127.0.0.1:7242/ingest/892f647a-2ee5-41db-bfad-3ff67af0ff8d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api-client.ts:194',message:'Fetch call start',data:{url,method:options.method||'GET'},timestamp:Date.now(),sessionId:'debug-session',runId:'browser-test',hypothesisId:'J'})}).catch(()=>{});
      }
      // #endregion
      response = await fetch(url, {
        ...options,
        headers,
      });
      // #region agent log
      if (typeof window !== 'undefined') {
        fetch('http://127.0.0.1:7242/ingest/892f647a-2ee5-41db-bfad-3ff67af0ff8d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api-client.ts:202',message:'Fetch call complete',data:{status:response.status,ok:response.ok,type:response.type},timestamp:Date.now(),sessionId:'debug-session',runId:'browser-test',hypothesisId:'K'})}).catch(()=>{});
      }
      // #endregion
    } catch (fetchError: any) {
      // #region agent log
      if (typeof window !== 'undefined') {
        fetch('http://127.0.0.1:7242/ingest/892f647a-2ee5-41db-bfad-3ff67af0ff8d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api-client.ts:210',message:'Fetch call failed',data:{error:fetchError?.message||String(fetchError),name:fetchError?.name,stack:fetchError?.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'browser-test',hypothesisId:'L'})}).catch(()=>{});
      }
      // #endregion
      throw fetchError;
    }
    // #region agent log
    if (typeof window !== 'undefined') {
      fetch('http://127.0.0.1:7242/ingest/892f647a-2ee5-41db-bfad-3ff67af0ff8d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api-client.ts:196',message:'After fetch',data:{status:response.status,statusText:response.statusText,ok:response.ok,url:response.url,hasCorsHeaders:!!response.headers.get('access-control-allow-origin')},timestamp:Date.now(),sessionId:'debug-session',runId:'browser-test',hypothesisId:'H'})}).catch(()=>{});
    }
    // #endregion

    // #region agent log
    if (typeof window !== 'undefined') {
      const corsHeader = response.headers.get('access-control-allow-origin');
      fetch('http://127.0.0.1:7242/ingest/892f647a-2ee5-41db-bfad-3ff67af0ff8d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api-client.ts:199',message:'Response received',data:{status:response.status,statusText:response.statusText,ok:response.ok,hasCorsOrigin:corsHeader,allHeaders:Array.from(response.headers.entries()).map(([k,v])=>k+':'+v.substring(0,50))},timestamp:Date.now(),sessionId:'debug-session',runId:'browser-test',hypothesisId:'I'})}).catch(()=>{});
    }
    // #endregion
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
    }
  }
}

export const apiClient = new ApiClient();

