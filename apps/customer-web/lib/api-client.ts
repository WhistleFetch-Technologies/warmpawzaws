/**
 * API Client for Customer Web App
 * Points to API Gateway instead of Supabase Functions
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.warmpawz.com';
const UAT_MODE = process.env.NEXT_PUBLIC_UAT_MODE === 'true';

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    
    // UAT Mode: Log API configuration for debugging
    if (UAT_MODE && typeof window !== 'undefined') {
      console.log('🔧 [UAT Mode] API Client Initialized');
      console.log('   Base URL:', this.baseUrl);
      console.log('   Environment:', process.env.NODE_ENV);
    }
  }

  private getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('authToken');
    }
    return null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
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
          localStorage.removeItem('authToken');
          localStorage.removeItem('customerPhone');
          window.location.href = '/auth';
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

