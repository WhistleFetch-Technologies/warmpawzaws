/**
 * API Client for Vendor Web App
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
  if (process.env.NEXT_PUBLIC_API_BASE_URL && typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }

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
      const { getCognitoIdToken } = require('./cognito-auth');
      const cognitoToken = getCognitoIdToken();
      if (cognitoToken) {
        return cognitoToken;
      }
      // Fallback to legacy token
      return localStorage.getItem('vendorAuthToken');
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

    // UAT Mode: Log API requests for debugging
    if (UAT_MODE && typeof window !== 'undefined') {
      console.log(`🌐 [UAT] API Request: ${options.method || 'GET'} ${endpoint}`);
      console.log('   Full URL:', url);
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));

      // Handle 401 by clearing token and redirecting to auth
      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('vendorAuthToken');
          localStorage.removeItem('vendorId');
          window.location.href = '/auth';
        }
      }

      // ✅ FIX: Handle error response structure from BaseHandlerEnhanced
      // Response format: { success: false, error: { code, message, details }, meta: {...} }
      const errorMessage = (typeof error.error === 'object' && error.error?.message) 
        ? error.error.message 
        : (typeof error.error === 'string' 
          ? error.error 
          : (error.message || `HTTP ${response.status}`));
      
      throw new Error(errorMessage);
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
        
        // ✅ FIX: Handle error response structure from BaseHandlerEnhanced
        const errorMessage = (typeof error.error === 'object' && error.error?.message) 
          ? error.error.message 
          : (typeof error.error === 'string' 
            ? error.error 
            : (error.message || `HTTP ${response.status}`));
        
        throw new Error(errorMessage);
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

