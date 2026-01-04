/**
 * ============================================================================
 * WARMPAWZ VENDOR MOBILE APP - API CLIENT
 * ============================================================================
 * 
 * Unified API client for React Native vendor app
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
  resilientFetch,
  networkMonitor,
  offlineQueue,
  NetworkError,
  NetworkState,
  QueuedRequest,
} from './network-resilience';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3000' 
  : 'https://api.warmpawz.com';

const AUTH_TOKEN_KEY = '@warmpawz_vendor_auth_token';
const VENDOR_ID_KEY = '@warmpawz_vendor_id';
const VENDOR_PHONE_KEY = '@warmpawz_vendor_phone';

// Operations that should be queued when offline
const OFFLINE_QUEUEABLE_METHODS = ['POST', 'PUT', 'DELETE'];
const OFFLINE_QUEUEABLE_ENDPOINTS = [
  '/bookings/',
  '/gps-tracking/',
  '/push-notifications/register',
];

// ============================================================================
// API CLIENT CLASS
// ============================================================================

class VendorApiClient {
  private baseUrl: string;
  private authToken: string | null = null;
  private vendorId: string | null = null;
  private networkListeners: Set<(state: NetworkState) => void> = new Set();

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.loadStoredData();
    this.setupNetworkListener();
  }

  private setupNetworkListener() {
    networkMonitor.addListener((state) => {
      this.networkListeners.forEach(listener => listener(state));
    });

    // Handle completed queued requests
    offlineQueue.setOnRequestComplete((request, success) => {
      if (success) {
        console.log(`[VendorApiClient] Queued request completed: ${request.url}`);
      } else {
        console.error(`[VendorApiClient] Queued request failed after retries: ${request.url}`);
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
  // STORED DATA MANAGEMENT
  // ============================================================================

  private async loadStoredData(): Promise<void> {
    try {
      [this.authToken, this.vendorId] = await Promise.all([
        AsyncStorage.getItem(AUTH_TOKEN_KEY),
        AsyncStorage.getItem(VENDOR_ID_KEY),
      ]);
    } catch (error) {
      console.error('Error loading stored data:', error);
    }
  }

  async setAuthData(token: string, vendorId: string): Promise<void> {
    this.authToken = token;
    this.vendorId = vendorId;
    await AsyncStorage.multiSet([
      [AUTH_TOKEN_KEY, token],
      [VENDOR_ID_KEY, vendorId],
    ]);
  }

  async setVendorId(vendorId: string): Promise<void> {
    this.vendorId = vendorId;
    await AsyncStorage.setItem(VENDOR_ID_KEY, vendorId);
  }

  getVendorId(): string | null {
    return this.vendorId;
  }

  async clearAuthData(): Promise<void> {
    this.authToken = null;
    this.vendorId = null;
    await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, VENDOR_ID_KEY, VENDOR_PHONE_KEY]);
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
    queueIfOffline = true
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const method = options.method || 'GET';
    
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
          console.log(`[VendorApiClient] Queueing offline request: ${method} ${endpoint}`);
          
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

      // Handle auth errors
      if (error instanceof NetworkError && error.statusCode === 401) {
        await this.clearAuthData();
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
    // High priority for booking actions
    if (endpoint.includes('/bookings/') && (endpoint.includes('/confirm') || endpoint.includes('/complete'))) {
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
  // AUTH & ONBOARDING
  // ============================================================================

  async sendOTP(phone: string): Promise<{ success: boolean }> {
    return this.post('/auth/send-otp', { phone });
  }

  async verifyOTP(phone: string, otp: string): Promise<{ success: boolean; token?: string }> {
    const result = await this.post<any>('/auth/verify-otp', { phone, otp });
    await AsyncStorage.setItem(VENDOR_PHONE_KEY, phone);
    return result;
  }

  async checkPhone(phone: string): Promise<PhoneCheckResult> {
    return this.get(`/vendor/check-phone/${phone}`);
  }

  async getRoles(): Promise<{ roles: Role[] }> {
    return this.get('/config/roles');
  }

  async getRoleDetails(roleId: string): Promise<Role> {
    return this.get(`/config/roles/${roleId}`);
  }

  async submitApplication(application: VendorApplication): Promise<ApplicationResult> {
    const result = await this.post<ApplicationResult>('/vendor/apply', application);
    if (result.vendorId) {
      await this.setVendorId(result.vendorId);
    }
    return result;
  }

  async getOnboardingStatus(vendorId: string): Promise<OnboardingStatus> {
    return this.get(`/vendor/${vendorId}/onboarding-status`);
  }

  // ============================================================================
  // DASHBOARD
  // ============================================================================

  async getDashboard(): Promise<DashboardData> {
    if (!this.vendorId) throw new Error('Vendor ID not set');
    return this.get(`/vendor/${this.vendorId}/dashboard`);
  }

  async getProfile(): Promise<{ vendor: VendorProfile }> {
    if (!this.vendorId) throw new Error('Vendor ID not set');
    return this.get(`/vendor/${this.vendorId}/profile`);
  }

  async updateProfile(data: Partial<VendorProfile>): Promise<VendorProfile> {
    if (!this.vendorId) throw new Error('Vendor ID not set');
    return this.put(`/vendor/${this.vendorId}/profile`, data);
  }

  async getCapabilities(): Promise<{ capabilities: string[] }> {
    if (!this.vendorId) throw new Error('Vendor ID not set');
    const profile = await this.getProfile();
    if (profile.vendor.role_id) {
      const role = await this.getRoleDetails(profile.vendor.role_id);
      return { capabilities: role.capabilities || [] };
    }
    return { capabilities: [] };
  }

  // ============================================================================
  // SERVICES
  // ============================================================================

  async getServices(): Promise<{ services: Service[] }> {
    if (!this.vendorId) throw new Error('Vendor ID not set');
    return this.get(`/vendor/${this.vendorId}/services`);
  }

  async createService(service: CreateServiceRequest): Promise<Service> {
    if (!this.vendorId) throw new Error('Vendor ID not set');
    return this.post(`/vendor/${this.vendorId}/services`, service);
  }

  async updateService(serviceId: string, data: Partial<Service>): Promise<Service> {
    return this.put(`/services/${serviceId}`, data);
  }

  async deleteService(serviceId: string): Promise<void> {
    return this.delete(`/services/${serviceId}`);
  }

  async toggleServiceStatus(serviceId: string, isActive: boolean): Promise<void> {
    return this.put(`/services/${serviceId}/status`, { is_active: isActive });
  }

  // ============================================================================
  // STAFF
  // ============================================================================

  async getStaff(): Promise<{ staff: Staff[] }> {
    if (!this.vendorId) throw new Error('Vendor ID not set');
    return this.get(`/vendor/${this.vendorId}/staff`);
  }

  async addStaff(staff: CreateStaffRequest): Promise<Staff> {
    if (!this.vendorId) throw new Error('Vendor ID not set');
    return this.post(`/vendor/${this.vendorId}/staff`, staff);
  }

  async updateStaff(staffId: string, data: Partial<Staff>): Promise<Staff> {
    return this.put(`/staff/${staffId}`, data);
  }

  async removeStaff(staffId: string): Promise<void> {
    return this.delete(`/staff/${staffId}`);
  }

  async assignServicesToStaff(staffId: string, serviceIds: string[]): Promise<void> {
    return this.post(`/staff/${staffId}/services`, { service_ids: serviceIds });
  }

  // ============================================================================
  // BOOKINGS
  // ============================================================================

  async getBookings(status?: string): Promise<{ bookings: Booking[] }> {
    if (!this.vendorId) throw new Error('Vendor ID not set');
    let endpoint = `/vendor/${this.vendorId}/bookings`;
    if (status) endpoint += `?status=${status}`;
    return this.get(endpoint);
  }

  async getTodayBookings(): Promise<{ bookings: Booking[] }> {
    if (!this.vendorId) throw new Error('Vendor ID not set');
    return this.get(`/vendor/${this.vendorId}/bookings/today`);
  }

  async getBookingDetails(bookingId: string): Promise<{ booking: Booking }> {
    return this.get(`/bookings/${bookingId}`);
  }

  async confirmBooking(bookingId: string): Promise<void> {
    return this.post(`/bookings/${bookingId}/confirm`, {});
  }

  async startBooking(bookingId: string): Promise<void> {
    if (!this.vendorId) throw new Error('Vendor ID not set');
    return this.post(`/bookings/${bookingId}/start`, { 
      started_by: this.vendorId 
    });
  }

  async completeBooking(bookingId: string, notes?: string): Promise<void> {
    if (!this.vendorId) throw new Error('Vendor ID not set');
    return this.post(`/bookings/${bookingId}/complete`, { 
      completed_by: this.vendorId,
      notes,
    });
  }

  async cancelBooking(bookingId: string, reason: string): Promise<void> {
    return this.post(`/bookings/${bookingId}/cancel`, { reason });
  }

  async markNoShow(bookingId: string): Promise<void> {
    return this.post(`/bookings/${bookingId}/no-show`, {});
  }

  // ============================================================================
  // SCHEDULE
  // ============================================================================

  async getSchedule(): Promise<{ schedule: ScheduleConfig }> {
    if (!this.vendorId) throw new Error('Vendor ID not set');
    return this.get(`/vendor/${this.vendorId}/schedule`);
  }

  async updateSchedule(schedule: ScheduleConfig): Promise<void> {
    if (!this.vendorId) throw new Error('Vendor ID not set');
    return this.put(`/vendor/${this.vendorId}/schedule`, schedule);
  }

  async getStaffSchedule(staffId: string): Promise<{ schedule: ScheduleConfig }> {
    return this.get(`/staff/${staffId}/schedule`);
  }

  async updateStaffSchedule(staffId: string, schedule: ScheduleConfig): Promise<void> {
    return this.put(`/staff/${staffId}/schedule`, schedule);
  }

  // ============================================================================
  // GPS TRACKING
  // ============================================================================

  async updateLocation(bookingId: string, latitude: number, longitude: number): Promise<void> {
    return this.post('/gps-tracking/update-location', {
      booking_id: bookingId,
      latitude,
      longitude,
      staff_id: this.vendorId,
    });
  }

  async startTracking(bookingId: string): Promise<void> {
    return this.post(`/gps-tracking/start/${bookingId}`, {});
  }

  async stopTracking(bookingId: string): Promise<void> {
    return this.post(`/gps-tracking/stop/${bookingId}`, {});
  }

  // ============================================================================
  // VIDEO CALL
  // ============================================================================

  async getVideoCall(bookingId: string): Promise<VideoCallData> {
    return this.get(`/video-call/booking/${bookingId}`);
  }

  async startVideoCall(bookingId: string): Promise<VideoCallData> {
    return this.post('/video-call/create-meeting', { booking_id: bookingId });
  }

  async joinVideoCall(bookingId: string, meetingId: string): Promise<VideoCallJoinResponse> {
    return this.post('/video-call/join', { booking_id: bookingId, meeting_id: meetingId });
  }

  async endVideoCall(bookingId: string, meetingId: string, durationSeconds: number): Promise<void> {
    return this.post('/video-call/end', { 
      booking_id: bookingId, 
      meeting_id: meetingId,
      duration_seconds: durationSeconds,
    });
  }

  // ============================================================================
  // EARNINGS & SETTLEMENTS
  // ============================================================================

  async getEarnings(): Promise<EarningsData> {
    if (!this.vendorId) throw new Error('Vendor ID not set');
    return this.get(`/vendor/${this.vendorId}/earnings`);
  }

  async getSettlements(status?: string): Promise<{ settlements: Settlement[] }> {
    if (!this.vendorId) throw new Error('Vendor ID not set');
    let endpoint = `/vendor/${this.vendorId}/settlements`;
    if (status) endpoint += `?status=${status}`;
    return this.get(endpoint);
  }

  async getSettlementDetails(settlementId: string): Promise<{ settlement: Settlement }> {
    return this.get(`/settlements/${settlementId}`);
  }

  // ============================================================================
  // BANK ACCOUNT
  // ============================================================================

  async createLinkedAccount(): Promise<{ account_id: string }> {
    if (!this.vendorId) throw new Error('Vendor ID not set');
    return this.post('/razorpay/linked-account/create', { vendor_id: this.vendorId });
  }

  async addBankAccount(bankDetails: BankAccountDetails): Promise<{ bank_account_id: string }> {
    if (!this.vendorId) throw new Error('Vendor ID not set');
    return this.post('/razorpay/linked-account/bank', {
      vendor_id: this.vendorId,
      ...bankDetails,
    });
  }

  async verifyBankAccount(): Promise<{ verified: boolean }> {
    if (!this.vendorId) throw new Error('Vendor ID not set');
    return this.post('/razorpay/linked-account/verify-bank', { vendor_id: this.vendorId });
  }

  // ============================================================================
  // REVIEWS
  // ============================================================================

  async getReviews(): Promise<{ reviews: Review[] }> {
    if (!this.vendorId) throw new Error('Vendor ID not set');
    return this.get(`/vendor/${this.vendorId}/reviews`);
  }

  async respondToReview(reviewId: string, response: string): Promise<void> {
    return this.post(`/reviews/${reviewId}/respond`, { response });
  }

  // ============================================================================
  // ANALYTICS
  // ============================================================================

  async getAnalytics(period?: string): Promise<AnalyticsData> {
    if (!this.vendorId) throw new Error('Vendor ID not set');
    let endpoint = `/vendor/${this.vendorId}/analytics`;
    if (period) endpoint += `?period=${period}`;
    return this.get(endpoint);
  }

  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================

  async getNotifications(): Promise<{ notifications: Notification[] }> {
    if (!this.vendorId) throw new Error('Vendor ID not set');
    return this.get(`/notifications/vendor/${this.vendorId}`);
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    return this.post(`/notifications/${notificationId}/read`, {});
  }

  async registerPushToken(token: string, platform: 'ios' | 'android'): Promise<void> {
    if (!this.vendorId) throw new Error('Vendor ID not set');
    return this.post('/push-notifications/register', { 
      vendor_id: this.vendorId,
      token, 
      platform 
    });
  }

  // ============================================================================
  // PRESCRIPTION (for medical vendors)
  // ============================================================================

  async createPrescription(prescription: CreatePrescriptionRequest): Promise<{ prescription_id: string }> {
    return this.post('/prescriptions', prescription);
  }

  async getPrescriptions(bookingId: string): Promise<{ prescriptions: Prescription[] }> {
    return this.get(`/prescriptions/booking/${bookingId}`);
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

export interface PhoneCheckResult {
  exists: boolean;
  vendorId?: string;
  applicationId?: string;
  status?: string;
  onboardingProgress?: number;
  adminComment?: string;
  rejectionReason?: string;
}

export interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string;
  icon: string;
  capabilities: string[];
  service_styles: string[];
}

export interface VendorApplication {
  roleId: string;
  phone: string;
  email: string;
  serviceStyle: string;
  businessType: 'solo' | 'business';
  formData: Record<string, any>;
  documents: Record<string, string>;
  location: {
    address: string;
    city: string;
    state: string;
    pincode: string;
    latitude?: number;
    longitude?: number;
  };
}

export interface ApplicationResult {
  vendorId?: string;
  applicationId?: string;
  status: string;
  message: string;
  error?: string;
  queued?: boolean;
}

export interface OnboardingStatus {
  status: string;
  progress: number;
  adminComment?: string;
  rejectionReason?: string;
}

export interface DashboardData {
  vendor: VendorProfile;
  stats: {
    todayBookings: number;
    pendingBookings: number;
    completedToday: number;
    earnings: number;
    pendingSettlement: number;
    rating: number;
    totalReviews: number;
  };
  bookings: Booking[];
}

export interface VendorProfile {
  id: string;
  business_name: string;
  owner_name: string;
  phone: string;
  email: string;
  role_id: string;
  status: string;
  tier: string;
  rating: number;
  total_reviews: number;
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  razorpay_account_id?: string;
  bank_verified: boolean;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  service_style: string;
  price: number;
  duration: number;
  is_active: boolean;
}

export interface CreateServiceRequest {
  name: string;
  description: string;
  category: string;
  service_style: string;
  price: number;
  duration: number;
  is_active?: boolean;
}

export interface Staff {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  specializations: string[];
  is_active: boolean;
  rating?: number;
}

export interface CreateStaffRequest {
  name: string;
  phone: string;
  email?: string;
  role: string;
  specializations?: string[];
}

export interface Booking {
  id: string;
  customer_name: string;
  customer_phone: string;
  service_id: string;
  service_name: string;
  staff_id?: string;
  staff_name?: string;
  booking_date: string;
  booking_time: string;
  status: string;
  total_amount: number;
  service_style: string;
  address?: string;
  notes?: string;
}

export interface ScheduleConfig {
  working_days: string[];
  working_hours: {
    start: string;
    end: string;
  };
  break_time?: {
    start: string;
    end: string;
  };
  slot_duration: number;
  buffer_time: number;
}

export interface VideoCallData {
  booking_id: string;
  meeting_id: string;
  attendee_id: string;
  join_token: string;
  customer_name: string;
  service_name: string;
  status: string;
}

export interface VideoCallJoinResponse {
  success: boolean;
  meeting_id: string;
  attendee_id: string;
  join_token: string;
}

export interface EarningsData {
  today: number;
  week: number;
  month: number;
  total: number;
  transactions: Array<{
    id: string;
    type: 'credit' | 'debit';
    amount: number;
    description: string;
    date: string;
  }>;
}

export interface Settlement {
  id: string;
  total_amount: number;
  commission_amount: number;
  payout_amount: number;
  status: string;
  booking_ids: string[];
  created_at: string;
  completed_at?: string;
}

export interface BankAccountDetails {
  account_number: string;
  ifsc_code: string;
  beneficiary_name: string;
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

export interface AnalyticsData {
  bookings: {
    total: number;
    completed: number;
    cancelled: number;
    no_shows: number;
  };
  revenue: {
    total: number;
    average_per_booking: number;
  };
  ratings: {
    average: number;
    distribution: Record<string, number>;
  };
  popular_services: Array<{
    service_name: string;
    count: number;
  }>;
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

export interface CreatePrescriptionRequest {
  booking_id: string;
  patient_name: string;
  pet_name: string;
  diagnosis: string;
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
  }>;
  notes?: string;
}

export interface Prescription {
  id: string;
  booking_id: string;
  diagnosis: string;
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
  }>;
  notes?: string;
  created_at: string;
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const vendorApiClient = new VendorApiClient();
export default vendorApiClient;

// Re-export network utilities
export { networkMonitor, offlineQueue, NetworkState };
