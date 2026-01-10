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

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    // Use provided URL or get from config (with fallback)
    const url = baseUrl || getApiBaseUrl();
    this.baseUrl = url || '';
    
    // UAT Mode: Log API configuration for debugging
    if (UAT_MODE && typeof window !== 'undefined') {
      console.log('🔧 [UAT Mode] API Client Initialized (Admin)');
      console.log('   Base URL:', this.baseUrl);
      console.log('   Environment:', process.env.NODE_ENV);
      console.log('   Runtime Config:', getRuntimeConfig());
      
      // Warn if config not loaded
      if (!this.baseUrl) {
        console.warn('⚠️ API_BASE_URL is empty. Check runtime-config.js is loaded.');
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
    
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      
      // Handle 401: In UAT mode, don't redirect - let components handle gracefully
      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          // Check if we're in UAT mode - if so, don't redirect, just throw error
          const isUat = getRuntimeConfig().uatMode || UAT_MODE;
          if (!isUat) {
            // Only redirect in production mode
            localStorage.removeItem('adminAuthToken');
            localStorage.removeItem('adminId');
            window.location.href = '/';
          }
        }
      }
      
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }

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

