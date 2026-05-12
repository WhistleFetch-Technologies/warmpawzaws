/**
 * ============================================================================
 * WARMPAWZ CUSTOMER MOBILE APP - API CLIENT
 * ============================================================================
 * 
 * Unified API client for React Native customer app
 * Points to AWS API Gateway (Lambda backend)
 * Synced with web app patterns
 * 
 * Features:
 * - Network resilience with automatic retry
 * - Offline queue for critical operations
 * - Request deduplication
 * - Timeout handling
 * 
 * Date: 2026-01-02
 * ============================================================================
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CUSTOMER_SERVICE_LIST_MAX_PAGE_SIZE,
  withCustomerServiceListPagination,
  type CustomerServiceListPaginationParams,
} from '@warmpawz/shared-types';
import {
  resilientFetch,
  networkMonitor,
  offlineQueue,
  NetworkError,
  NetworkState,
  QueuedRequest,
} from './network-resilience';
import { API_BASE_URL as CANONICAL_API_BASE_URL } from '../config/aws';
import {
  clearCustomerSession,
  getValidCustomerAccessToken,
  refreshCustomerTokens,
  CustomerSessionStorageKeys,
} from '../services/auth-session';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Single source of truth: src/config/aws.ts. That module honours the env vars
// AWS_API_GATEWAY_URL / EXPO_PUBLIC_API_GATEWAY_URL and falls back to the real
// dev/prod API Gateway URLs (NOT broken vanity DNS). Importing here keeps both
// API clients aligned so referral / prescription / share calls resolve correctly
// in production release builds.
const API_BASE_URL = CANONICAL_API_BASE_URL;

const AUTH_TOKEN_KEY = CustomerSessionStorageKeys.legacyAuthToken;
const CUSTOMER_PHONE_KEY = CustomerSessionStorageKeys.legacyCustomerPhone;
const CUSTOMER_ID_KEY = CustomerSessionStorageKeys.legacyCustomerId;

// Operations that should be queued when offline
const OFFLINE_QUEUEABLE_METHODS = ['POST', 'PUT', 'DELETE'];
const OFFLINE_QUEUEABLE_ENDPOINTS = [
  '/bookings/create',
  '/bookings/',
  '/reviews',
  '/push-notifications/register',
];

// ============================================================================
// API CLIENT CLASS
// ============================================================================

class ApiClient {
  private baseUrl: string;
  private authToken: string | null = null;
  private networkListeners: Set<(state: NetworkState) => void> = new Set();

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.loadAuthToken();
    this.setupNetworkListener();
  }

  private setupNetworkListener() {
    networkMonitor.addListener((state) => {
      this.networkListeners.forEach(listener => listener(state));
    });

    // Handle completed queued requests
    offlineQueue.setOnRequestComplete((request, success) => {
      if (success) {
        console.log(`[ApiClient] Queued request completed: ${request.url}`);
      } else {
        console.error(`[ApiClient] Queued request failed after retries: ${request.url}`);
      }
    });
  }

  // ============================================================================
  // NETWORK STATE MANAGEMENT
  // ============================================================================

  addNetworkListener(listener: (state: NetworkState) => void): () => void {
    this.networkListeners.add(listener);
    return () => this.networkListeners.delete(listener);
  }

  isOnline(): boolean {
    return networkMonitor.getIsConnected();
  }

  async checkConnection(): Promise<NetworkState> {
    return networkMonitor.checkConnection();
  }

  getQueuedRequestCount(): number {
    return offlineQueue.getQueueSize();
  }

  // ============================================================================
  // AUTH TOKEN MANAGEMENT
  // ============================================================================

  private async loadAuthToken(): Promise<void> {
    try {
      // Prefer the structured session bundle so a freshly-refreshed token is
      // used after cold start. Fall back to the legacy single key when older
      // login flows wrote only that.
      const fresh = await getValidCustomerAccessToken();
      this.authToken = fresh || (await AsyncStorage.getItem(AUTH_TOKEN_KEY));
    } catch (error) {
      console.error('Error loading auth token:', error);
    }
  }

  async setAuthToken(token: string): Promise<void> {
    this.authToken = token;
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  }

  /** Explicit logout — only call from user-initiated "Log out". */
  async clearAuthToken(): Promise<void> {
    this.authToken = null;
    await clearCustomerSession();
  }

  getAuthToken(): string | null {
    return this.authToken;
  }

  // ============================================================================
  // REQUEST HANDLING
  // ============================================================================

  private shouldQueueOffline(method: string, endpoint: string): boolean {
    if (!OFFLINE_QUEUEABLE_METHODS.includes(method)) {
      return false;
    }
    return OFFLINE_QUEUEABLE_ENDPOINTS.some(e => endpoint.includes(e));
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    queueIfOffline = true,
    retried401 = false
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const method = options.method || 'GET';

    // Always pull the freshest access token from the session manager so
    // silent refreshes are honoured even when this.authToken is stale.
    let bearer: string | null = null;
    try {
      bearer = await getValidCustomerAccessToken();
    } catch {
      /* fall through to cached value */
    }
    if (bearer) this.authToken = bearer;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const finalOptions: RequestInit = {
      ...options,
      headers: {
        ...headers,
        ...(options.headers as Record<string, string>),
      },
    };

    try {
      const response = await resilientFetch(url, finalOptions);
      const data = await response.json();

      if (!response.ok) {
        throw new ApiError(
          data.error || `HTTP ${response.status}`,
          response.status,
          data
        );
      }

      return data;
    } catch (error) {
      // Handle offline scenario
      if (error instanceof NetworkError && error.type === 'offline') {
        if (queueIfOffline && this.shouldQueueOffline(method, endpoint)) {
          console.log(`[ApiClient] Queueing offline request: ${method} ${endpoint}`);
          
          await offlineQueue.enqueue({
            url,
            method,
            headers: finalOptions.headers as Record<string, string>,
            body: finalOptions.body as string,
            priority: this.getRequestPriority(endpoint),
          });

          // Return a pending status for queued requests
          return {
            queued: true,
            message: 'Request queued for when network is available',
          } as unknown as T;
        }
        
        throw new ApiError(
          'You are offline. Please check your network connection.',
          0,
          { offline: true }
        );
      }

      // Handle auth errors: try a one-shot refresh first so a short-lived
      // access token never forces the user back to the auth screen while the
      // 90-day refresh window is still open.
      if (error instanceof NetworkError && error.statusCode === 401) {
        if (!retried401) {
          try {
            const renewed = await refreshCustomerTokens();
            if (renewed?.accessToken) {
              this.authToken = renewed.accessToken;
              return this.request<T>(endpoint, options, queueIfOffline, true);
            }
          } catch {
            /* fall through */
          }
        }
        // Refresh failed — but refresh token may already be cleared by
        // refreshCustomerTokens on a conclusive 401. We surface the error
        // without forcing a session wipe so transient failures don't log out.
        throw new ApiError('Session expired. Please log in again.', 401, { sessionExpired: true });
      }

      // Re-throw API errors
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle network errors
      if (error instanceof NetworkError) {
        throw new ApiError(
          error.message || 'Network error. Please try again.',
          error.statusCode || 0,
          { networkError: true, type: error.type }
        );
      }

      // Unknown error
      throw new ApiError('An unexpected error occurred', 0, { originalError: error });
    }
  }

  private getRequestPriority(endpoint: string): 'high' | 'normal' | 'low' {
    // High priority for payments and bookings
    if (endpoint.includes('/payments') || endpoint.includes('/bookings/create')) {
      return 'high';
    }
    // Low priority for notifications and tracking
    if (endpoint.includes('/notifications') || endpoint.includes('/tracking')) {
      return 'low';
    }
    return 'normal';
  }

  // ============================================================================
  // HTTP METHODS
  // ============================================================================

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, false);
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

  // ============================================================================
  // AUTH METHODS
  // ============================================================================

  async sendOTP(phone: string): Promise<{ success: boolean }> {
    return this.post('/auth/send-otp', { phone });
  }

  async verifyOTP(phone: string, otp: string): Promise<{ success: boolean; token?: string }> {
    const result = await this.post<any>('/auth/verify-otp', { phone, otp });
    
    if (result.token) {
      await this.setAuthToken(result.token);
    }
    
    await AsyncStorage.setItem(CUSTOMER_PHONE_KEY, phone);
    
    return result;
  }

  /** Explicit user-initiated logout (settings → log out). */
  async logout(): Promise<void> {
    await this.clearAuthToken();
  }

  // ============================================================================
  // CUSTOMER METHODS
  // ============================================================================

  async getProfile(phone: string): Promise<CustomerProfile> {
    return this.get(`/customer/profile/unified/${phone}`);
  }

  async updateProfile(phone: string, data: Partial<CustomerProfile>): Promise<CustomerProfile> {
    return this.put(`/customer/profile/${phone}`, data);
  }

  async getAddresses(customerId: string): Promise<{ addresses: Address[] }> {
    return this.get(`/addresses/customer/${customerId}`);
  }

  async addAddress(customerId: string, address: Omit<Address, 'id'>): Promise<Address> {
    return this.post(`/addresses/customer/${customerId}`, address);
  }

  async deleteAddress(addressId: string): Promise<void> {
    return this.delete(`/addresses/${addressId}`);
  }

  // ============================================================================
  // PET METHODS
  // ============================================================================

  async getPets(
    customerId: string,
    pagination?: CustomerServiceListPaginationParams
  ): Promise<{ pets: Pet[] }> {
    const opts = pagination ?? {
      page: 0,
      size: CUSTOMER_SERVICE_LIST_MAX_PAGE_SIZE,
    };
    const path = withCustomerServiceListPagination(
      `/pets/customer/${customerId}`,
      opts
    );
    return this.get(path);
  }

  async addPet(customerId: string, pet: Omit<Pet, 'id'>): Promise<Pet> {
    return this.post(`/pets/customer/${customerId}`, pet);
  }

  async updatePet(petId: string, data: Partial<Pet>): Promise<Pet> {
    return this.put(`/pets/${petId}`, data);
  }

  async deletePet(petId: string): Promise<void> {
    return this.delete(`/pets/${petId}`);
  }

  // ============================================================================
  // DISCOVERY METHODS
  // ============================================================================

  async search(query: string, location?: { lat: number; lng: number }): Promise<SearchResults> {
    let endpoint = `/search?q=${encodeURIComponent(query)}`;
    if (location) {
      endpoint += `&lat=${location.lat}&lng=${location.lng}`;
    }
    return this.get(endpoint);
  }

  async getProblems(): Promise<{ problems: Problem[] }> {
    return this.get('/service-discovery/problems');
  }

  async getCategories(): Promise<{ categories: ServiceCategory[] }> {
    return this.get('/service-discovery/categories');
  }

  async getVendors(params: {
    category?: string;
    service_style?: string;
    lat?: number;
    lng?: number;
    customer_phone?: string;
  }): Promise<{ vendors: Vendor[] }> {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) queryParams.append(key, String(value));
    });
    return this.get(`/service-discovery/vendors?${queryParams}`);
  }

  async getVendorProfile(vendorId: string): Promise<{ vendor: Vendor }> {
    return this.get(`/vendor/${vendorId}/profile`);
  }

  async getVendorServices(vendorId: string): Promise<{ services: Service[] }> {
    return this.get(`/vendor/${vendorId}/services`);
  }

  async getStaff(params: {
    vendor_id?: string;
    service_id?: string;
    lat?: number;
    lng?: number;
    customer_phone?: string;
  }): Promise<{ staff: Staff[] }> {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) queryParams.append(key, String(value));
    });
    return this.get(`/service-discovery/staff?${queryParams}`);
  }

  // ============================================================================
  // BOOKING METHODS
  // ============================================================================

  async getAvailableSlots(params: {
    vendor_id: string;
    service_id: string;
    staff_id?: string;
    date: string;
  }): Promise<{ slots: string[] }> {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) queryParams.append(key, String(value));
    });
    return this.get(`/bookings/available-slots?${queryParams}`);
  }

  async createBooking(booking: CreateBookingRequest): Promise<CreateBookingResponse> {
    return this.post('/bookings/create', booking);
  }

  async getBooking(bookingId: string): Promise<{ booking: Booking }> {
    return this.get(`/bookings/${bookingId}`);
  }

  async getBookings(phone: string, status?: string): Promise<{ bookings: Booking[] }> {
    let endpoint = `/customer/bookings?phone=${phone}`;
    if (status) endpoint += `&status=${status}`;
    return this.get(endpoint);
  }

  async getUpcomingBookings(phone: string): Promise<{ bookings: Booking[] }> {
    return this.get(`/customer/bookings/upcoming?phone=${phone}`);
  }

  async cancelBooking(bookingId: string, reason?: string): Promise<void> {
    return this.post(`/bookings/${bookingId}/cancel`, { reason });
  }

  async rescheduleBooking(bookingId: string, newDate: string, newTime: string): Promise<void> {
    return this.post(`/bookings/${bookingId}/reschedule`, { 
      new_date: newDate, 
      new_time: newTime 
    });
  }

  // ============================================================================
  // PAYMENT METHODS
  // ============================================================================

  async createPaymentOrder(bookingId: string, amount: number): Promise<PaymentOrder> {
    return this.post('/payments/create-order', { booking_id: bookingId, amount });
  }

  async verifyPayment(paymentData: PaymentVerification): Promise<{ success: boolean }> {
    return this.post('/payments/verify', paymentData);
  }

  async getWalletBalance(phone: string): Promise<{ balance: number }> {
    return this.get(`/wallet/${phone}/balance`);
  }

  async getWalletTransactions(phone: string): Promise<{ transactions: WalletTransaction[] }> {
    return this.get(`/wallet/${phone}/transactions`);
  }

  // ============================================================================
  // TRACKING METHODS
  // ============================================================================

  async getTrackingStatus(bookingId: string): Promise<TrackingData> {
    return this.get(`/gps-tracking/booking/${bookingId}`);
  }

  // ============================================================================
  // VIDEO CALL METHODS
  // ============================================================================

  async getVideoCallDetails(bookingId: string): Promise<VideoCallData> {
    return this.get(`/video-call/booking/${bookingId}`);
  }

  /** Join video call. Backend creates meeting on join if none exists. participantId = customerId or phone, participantType = 'customer'. */
  async joinVideoCall(bookingId: string, participantId: string, participantType: 'customer'): Promise<VideoCallJoinResponse> {
    return this.post('/video-call/join', {
      booking_id: bookingId,
      participant_id: participantId,
      participant_type: participantType,
    });
  }

  async notifyVideoCallReady(bookingId: string, participantType: 'customer'): Promise<void> {
    await this.post('/video-call/notify-ready', {
      bookingId,
      participantType,
    });
  }

  async endVideoCall(bookingId: string): Promise<void> {
    return this.post('/video-call/end', { booking_id: bookingId });
  }

  // ============================================================================
  // REVIEW METHODS
  // ============================================================================

  async submitReview(review: CreateReviewRequest): Promise<{ review_id: string }> {
    return this.post('/reviews', review);
  }

  async getVendorReviews(vendorId: string): Promise<{ reviews: Review[] }> {
    return this.get(`/vendor/${vendorId}/reviews`);
  }

  // ============================================================================
  // NOTIFICATION METHODS
  // ============================================================================

  async getNotifications(phone: string): Promise<{ notifications: Notification[] }> {
    return this.get(`/notifications/customer/${phone}`);
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    return this.post(`/notifications/${notificationId}/read`, {});
  }

  async registerPushToken(phone: string, token: string, platform: 'ios' | 'android'): Promise<void> {
    return this.post('/push-notifications/register', { phone, token, platform });
  }
}

// ============================================================================
// ERROR CLASS
// ============================================================================

export class ApiError extends Error {
  statusCode: number;
  data: any;

  constructor(message: string, statusCode: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.data = data;
  }

  isOffline(): boolean {
    return this.data?.offline === true;
  }

  isSessionExpired(): boolean {
    return this.data?.sessionExpired === true;
  }

  isNetworkError(): boolean {
    return this.data?.networkError === true;
  }

  isQueued(): boolean {
    return this.data?.queued === true;
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  wallet_balance: number;
  addresses: Address[];
}

export interface Address {
  id: string;
  label: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  is_default: boolean;
}

export interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
  age_years?: number;
  age_months?: number;
  gender?: string;
  weight?: number;
  profile_photo_url?: string;
}

export interface Problem {
  id: string;
  symptom: string;
  icon: string;
  category: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  service_style: 'centre' | 'home' | 'tele' | 'ecommerce';
}

export interface Vendor {
  id: string;
  business_name: string;
  owner_name: string;
  rating: number;
  total_reviews: number;
  distance_km?: number;
  address: string;
  city: string;
  profile_photo_url?: string;
  services?: Service[];
  is_previous_provider?: boolean;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  service_style: string;
  vendor_id: string;
  vendor_name?: string;
}

export interface Staff {
  id: string;
  name: string;
  photo_url?: string;
  rating: number;
  specializations: string[];
  is_available: boolean;
  is_previous?: boolean;
  distance_km?: number;
}

export interface Booking {
  id: string;
  customer_phone: string;
  vendor_id: string;
  vendor_name: string;
  service_id: string;
  service_name: string;
  staff_id?: string;
  staff_name?: string;
  booking_date: string;
  booking_time: string;
  status: BookingStatus;
  total_amount: number;
  service_style: string;
  address?: Address;
}

export type BookingStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'in_progress' 
  | 'completed' 
  | 'cancelled' 
  | 'no_show';

export interface CreateBookingRequest {
  customer_phone: string;
  vendor_id: string;
  service_id: string;
  staff_id?: string;
  booking_date: string;
  booking_time: string;
  service_style: string;
  total_amount: number;
  address_id?: string;
  pet_id?: string;
  notes?: string;
}

export interface CreateBookingResponse {
  booking_id: string;
  status: string;
  message: string;
  queued?: boolean;
}

export interface PaymentOrder {
  order_id: string;
  amount: number;
  currency: string;
  receipt: string;
}

export interface PaymentVerification {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  booking_id: string;
}

export interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  created_at: string;
}

export interface TrackingData {
  booking_id: string;
  staff_name: string;
  staff_phone: string;
  staff_photo_url?: string;
  current_location: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number; address: string };
  eta_minutes: number;
  distance_km: number;
  status: 'on_way' | 'arriving' | 'arrived' | 'in_progress' | 'completed';
}

export interface VideoCallData {
  booking_id: string;
  meeting_id: string;
  attendee_id: string;
  join_token: string;
  staff_name: string;
  service_name: string;
  status: 'waiting' | 'connecting' | 'connected' | 'ended';
  scheduled_time: string;
}

export interface VideoCallJoinResponse {
  success: boolean;
  meeting_id: string;
  attendee_id: string;
  join_token: string;
}

export interface CreateReviewRequest {
  booking_id: string;
  rating: number;
  comment: string;
  customer_phone: string;
}

export interface Review {
  id: string;
  booking_id: string;
  customer_name: string;
  rating: number;
  comment: string;
  created_at: string;
  vendor_response?: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, any>;
  read: boolean;
  created_at: string;
}

export interface SearchResults {
  results: Array<{
    id: string;
    type: 'service' | 'vendor' | 'product';
    title: string;
    description?: string;
    price?: number;
    rating?: number;
  }>;
  total: number;
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const apiClient = new ApiClient();
export default apiClient;

// Re-export network utilities
export { networkMonitor, offlineQueue, NetworkState };
