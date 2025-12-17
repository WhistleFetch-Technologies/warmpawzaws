/**
 * Shared API Client for Warmpawz Mobile Apps
 * Provides unified API access for Customer and Vendor apps
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

// API Configuration
export interface ApiConfig {
  baseURL: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  timeout?: number;
}

// Default configuration
const DEFAULT_CONFIG: ApiConfig = {
  baseURL: process.env.API_BASE_URL || 'https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475',
  supabaseUrl: process.env.SUPABASE_URL || 'https://vpvpbdwtyugbknrntkho.supabase.co',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  timeout: 30000,
};

/**
 * API Client Class
 */
export class ApiClient {
  private client: AxiosInstance;
  private config: ApiConfig;

  constructor(config?: Partial<ApiConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token if available
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        // Handle common errors
        if (error.response?.status === 401) {
          // Handle unauthorized
          this.handleUnauthorized();
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get authentication token from storage
   */
  private getAuthToken(): string | null {
    // This should be implemented based on storage mechanism
    // For React Native, use AsyncStorage
    return null;
  }

  /**
   * Handle unauthorized access
   */
  private handleUnauthorized(): void {
    // Implement logout logic
    console.warn('Unauthorized access - token expired or invalid');
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    // Store token (implement with AsyncStorage)
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  /**
   * Clear authentication token
   */
  clearAuthToken(): void {
    delete this.client.defaults.headers.common['Authorization'];
  }

  /**
   * GET request
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  /**
   * POST request
   */
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  /**
   * PUT request
   */
  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  /**
   * DELETE request
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }

  /**
   * PATCH request
   */
  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }
}

// Customer API endpoints
export const customerApi = {
  // Featured services
  getFeaturedServices: (apiClient: ApiClient) => 
    apiClient.get('/customer/featured-services'),

  // Bookings
  getBookings: (apiClient: ApiClient, customerId: string) =>
    apiClient.get(`/customer/${customerId}/bookings`),

  createBooking: (apiClient: ApiClient, bookingData: any) =>
    apiClient.post('/booking/create', bookingData),

  // Previous providers
  getPreviousProviders: (apiClient: ApiClient, customerId: string) =>
    apiClient.get(`/customer/${customerId}/previous-providers`),

  // Problem search
  problemSearch: (apiClient: ApiClient, query: string, location?: { lat: number; lng: number }) =>
    apiClient.get('/customer/problem-first-search', {
      params: { query, ...location },
    }),

  // GPS Tracking
  getTrackingStatus: (apiClient: ApiClient, trackingId: string) =>
    apiClient.get(`/gps/tracking/${trackingId}`),
};

// Vendor API endpoints
export const vendorApi = {
  // Dashboard
  getDashboard: (apiClient: ApiClient, vendorId: string) =>
    apiClient.get(`/vendor/${vendorId}/dashboard`),

  // Bookings
  getBookings: (apiClient: ApiClient, vendorId: string) =>
    apiClient.get(`/vendor/${vendorId}/bookings`),

  // Services
  getServices: (apiClient: ApiClient, vendorId: string) =>
    apiClient.get(`/vendor/${vendorId}/services`),

  createService: (apiClient: ApiClient, serviceData: any) =>
    apiClient.post('/vendor/services', serviceData),

  updateService: (apiClient: ApiClient, serviceId: string, serviceData: any) =>
    apiClient.put(`/vendor/services/${serviceId}`, serviceData),

  deleteService: (apiClient: ApiClient, serviceId: string) =>
    apiClient.delete(`/vendor/services/${serviceId}`),

  // Staff
  getStaff: (apiClient: ApiClient, vendorId: string) =>
    apiClient.get(`/vendor/${vendorId}/staff`),

  createStaff: (apiClient: ApiClient, staffData: any) =>
    apiClient.post('/vendor/staff', staffData),
};

// Create default API client instance
export const createApiClient = (config?: Partial<ApiConfig>): ApiClient => {
  return new ApiClient(config);
};

// Export default instance
export default createApiClient();

