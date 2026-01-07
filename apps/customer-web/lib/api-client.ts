/**
 * API Client for Customer Web App
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

  constructor(baseUrl: string = getApiBaseUrl()) {
    this.baseUrl = baseUrl || '';
    
    // UAT Mode: Log API configuration for debugging
    if (UAT_MODE && typeof window !== 'undefined') {
      console.log('🔧 [UAT Mode] API Client Initialized');
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
      return localStorage.getItem('authToken');
    }
    return null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryConfig?: Partial<import('./error-handling').RetryConfig>
  ): Promise<T> {
    if (!this.baseUrl) {
      throw new Error('API_BASE_URL is not configured (runtime-config.js missing or empty).');
    }
    
    // Import error handling utilities
    const { resilientFetch, isOnline, OfflineQueue, ApiError } = await import('./error-handling');
    
    // Initialize offline queue
    if (!this.offlineQueue) {
      this.offlineQueue = new OfflineQueue();
    }
    
    // Fix: Normalize URL to avoid double slashes
    const base = this.baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
    const path = endpoint.replace(/^\/+/, '/');    // Ensure single leading slash
    const url = `${base}${path}`;
    const token = this.getAuthToken();
    
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    // CRITICAL FIX: Do NOT set Content-Type for FormData, let fetch handle it
    // Setting Content-Type manually for FormData breaks the boundary parameter
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
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
      const response = await resilientFetch(url, {
        ...options,
        headers,
      }, retryConfig);

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
        
        throw new ApiError(
          error.error || error.message || `HTTP ${response.status}`,
          response.status >= 500 ? 'server_error' : 'client_error',
          response.status,
          [408, 429, 500, 502, 503, 504].includes(response.status)
        );
      }

      return response.json();
    } catch (error: any) {
      // Re-throw ApiError as-is
      if (error instanceof ApiError) {
        throw error;
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

  async post<T>(endpoint: string, data?: any, retryConfig?: Partial<import('./error-handling').RetryConfig>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      // CRITICAL: Don't stringify FormData - pass it directly
      body: data instanceof FormData ? data : (data ? JSON.stringify(data) : undefined),
    }, retryConfig);
  }

  async put<T>(endpoint: string, data?: any, retryConfig?: Partial<import('./error-handling').RetryConfig>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }, retryConfig);
  }

  async delete<T>(endpoint: string, retryConfig?: Partial<import('./error-handling').RetryConfig>): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' }, retryConfig);
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
    context?: any;
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
};

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
    const query = params ? new URLSearchParams(Object.entries(params).map(([k,v]) => [k, String(v)])).toString() : '';
    return apiClient.get(`/support/tickets${query ? `?${query}` : ''}`);
  },
  
  getTicket: (ticketId: string) => apiClient.get(`/support/tickets/${ticketId}`),
  
  respondToTicket: (ticketId: string, data: {
    message: string;
    responderId?: string;
    responderType?: 'agent' | 'customer';
  }) => apiClient.post(`/support/tickets/${ticketId}/respond`, data),
  
  updateTicketStatus: (ticketId: string, status: string, resolution?: string) =>
    apiClient.put(`/support/tickets/${ticketId}/status`, { status, resolution }),
};

