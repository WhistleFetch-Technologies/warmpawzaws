/**
 * API Client for Customer Web App
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

/**
 * Get the API Base URL from runtime config (deployed) or environment (local dev) only.
 * Do NOT hardcode URLs. Set via runtime-config.js (injected at deploy) or NEXT_PUBLIC_API_BASE_URL.
 */
export function getApiBaseUrl(): string {
  const cfg = getRuntimeConfig();
  // Next.js injects NEXT_PUBLIC_* env vars at build time - check multiple sources
  let raw = '';
  
  // 1. Check runtime config first (set by runtime-config.js)
  if (cfg.apiBaseUrl) {
    raw = cfg.apiBaseUrl;
  }
  // 2. Check window.__NEXT_DATA__.env (Next.js injected env vars)
  else if (typeof window !== 'undefined' && (window as any).__NEXT_DATA__?.env?.NEXT_PUBLIC_API_BASE_URL) {
    raw = (window as any).__NEXT_DATA__.env.NEXT_PUBLIC_API_BASE_URL;
  }
  // 3. Check process.env (available at build time, might be available in some contexts)
  else if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_BASE_URL) {
    raw = process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  // 4. Fallback: Use environment-aware API Gateway selection
  else {
    raw = getApiGatewayUrl();
  }
  
  const result = (raw && typeof raw === 'string' ? raw.trim() : '').replace(/\/+$/, '');
  
  // Debug log in development mode
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    if (!result || result === 'http://localhost:3000') {
      console.warn('⚠️ [DEV] API Base URL is invalid. Using environment-based fallback:', getApiGatewayUrl());
    }
  }
  
  return result || getApiGatewayUrl();
}

// UAT Mode: ONLY in development (never in production)
export function isUatMode(): boolean {
  // Only enable UAT mode in development environment
  // Production should NEVER use UAT mode
  return process.env.NODE_ENV === 'development';
}

const UAT_MODE = isUatMode();

export class ApiClient {
  private _baseUrl: string;

  constructor(baseUrl?: string) {
    // Resolve base URL at construction; will be re-resolved lazily in request() if empty
    this._baseUrl = (baseUrl ?? getApiBaseUrl()) || '';
    
    // Development Mode: Log API configuration for debugging
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      const base = this.getBaseUrl();
      console.log('🔧 [DEV Mode] API Client Initialized');
      console.log('   Base URL:', base || '(will resolve from runtime-config)');
      console.log('   Environment:', process.env.NODE_ENV);
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
    retryConfig?: Partial<import('./error-handling').RetryConfig>,
    customTimeoutMs?: number // ✅ FIX: Allow custom timeout for specific endpoints
  ): Promise<T> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      const errorMsg = 'API_BASE_URL is not configured. Set via runtime-config.js (deploy) or NEXT_PUBLIC_API_BASE_URL (local dev).';
      console.error('❌ [API Client]', errorMsg);
      console.error('❌ [API Client] Runtime config:', getRuntimeConfig());
      throw new Error(errorMsg);
    }
    
    // Log API request in production for debugging
    if (typeof window !== 'undefined') {
      console.log(`🌐 [API] ${options.method || 'GET'} ${endpoint}`);
      console.log(`🌐 [API] Base URL: ${baseUrl}`);
      console.log(`🌐 [API] Full URL: ${baseUrl}${endpoint}`);
    }
    
    // Import error handling utilities
    const { resilientFetch, isOnline, OfflineQueue, ApiError } = await import('./error-handling');
    
    // Initialize offline queue
    if (!this.offlineQueue) {
      this.offlineQueue = new OfflineQueue();
    }
    
    // Fix: Normalize URL to avoid double slashes
    const base = baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
    const path = endpoint.replace(/^\/+/, '/');    // Ensure single leading slash
    const url = `${base}${path}`;
    let token = this.getAuthToken();

    // Development fallback: if no auth token but we have customer phone (e.g. after refresh), build a dev token so authorizer allows profile/address routes
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development' && (!token || !String(token).startsWith('uat-token-'))) {
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

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Development Mode: Send headers so API Gateway authorizer allows the request (phone-based login has no Cognito JWT)
    if (process.env.NODE_ENV === 'development') {
      headers['X-UAT-Mode'] = 'true';
      // Authorizer requires X-UAT-Token when using dev mode; send token so profile, add-address and other customer routes pass
      if (token && typeof token === 'string' && token.startsWith('uat-token-')) {
        headers['X-UAT-Token'] = token;
      }
    }
    
    // Development Mode: Log API requests for debugging
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      console.log(`🌐 [DEV] API Request: ${options.method || 'GET'} ${endpoint}`);
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
        
        // Handle 401 by clearing token and redirecting to auth
        if (response.status === 401) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('authToken');
            localStorage.removeItem('customerPhone');
            window.location.href = '/auth';
          }
        }
        
        // Create ApiError with full error data preserved
        const errorMessage = errorData.error?.message || errorData.error || errorData.message || `HTTP ${response.status}`;
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
        
        // Log error details in development mode
        if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
          console.error('🌐 [DEV] API Error Details:', {
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

  async post<T>(endpoint: string, data?: any, retryConfig?: Partial<import('./error-handling').RetryConfig>, customTimeoutMs?: number): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      // CRITICAL: Don't stringify FormData - pass it directly
      body: data instanceof FormData ? data : (data ? JSON.stringify(data) : undefined),
    }, retryConfig, customTimeoutMs);
  }

  async put<T>(endpoint: string, data?: any, retryConfig?: Partial<import('./error-handling').RetryConfig>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }, retryConfig);
  }

  async delete<T>(endpoint: string, data?: any, retryConfig?: Partial<import('./error-handling').RetryConfig>): Promise<T> {
    return this.request<T>(endpoint, { 
      method: 'DELETE',
      body: data ? JSON.stringify(data) : undefined
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

