/**
 * API Service Layer
 * Centralized API calls for Customer App
 * Enhanced with retry logic, offline support, and error recovery
 * Phase 4: Error Handling Enhancement
 */

import { API_BASE_URL } from '../config/aws';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resilientFetch, NetworkMonitor, NetworkError, OfflineQueue } from '../lib/network-resilience';
import NetInfo from '@react-native-community/netinfo';
import {
  CustomerSessionStorageKeys,
  clearCustomerSession,
  getValidCustomerAccessToken,
  refreshCustomerTokens,
} from './auth-session';

// Validate API Base URL is configured. Warn only on truly broken values
// (empty, or vanity DNS that does not resolve in production).
if (!API_BASE_URL || /(\.|^)(dev\.)?api\.warmpawz\.com/i.test(API_BASE_URL)) {
  console.warn('⚠️ API_BASE_URL is not properly configured. Set AWS_API_GATEWAY_URL or EXPO_PUBLIC_API_GATEWAY_URL to the resolvable HTTP API URL (e.g. https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com).');
}

const SESSION_TOKEN_KEY = CustomerSessionStorageKeys.legacySessionToken;

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'Network request failed'],
};

export class ApiService {
  private static networkMonitor = NetworkMonitor.getInstance();
  private static offlineQueue = OfflineQueue.getInstance();
  private static initialized = false;

  // Initialize network monitoring
  static async initialize() {
    if (this.initialized) return;
    
    // Initial network state
    const netInfo = await NetInfo.fetch();
    this.networkMonitor.setIsConnected(netInfo.isConnected ?? false);
    
    this.initialized = true;
  }

  private static async getAuthHeaders(): Promise<Record<string, string>> {
    // Prefer the session manager so calls get a freshly-refreshed access
    // token whenever the previous one is close to expiry. Falls back to the
    // legacy single-key slot (kept in sync by saveCustomerLoginResponse) so
    // partial logins / legacy flows continue working.
    let token: string | null = null;
    try {
      token = await getValidCustomerAccessToken();
    } catch {
      /* swallow — fall through to legacy slot */
    }
    if (!token) {
      token = await AsyncStorage.getItem(SESSION_TOKEN_KEY);
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
  }

  /**
   * Resolve a 401 by trying the refresh token once. Returns `true` when the
   * caller should retry the original request with a fresh Authorization
   * header. Returns `false` for transient failures (we keep the session) and
   * also `false` when the refresh token is conclusively rejected — in that
   * case the session manager has already cleared storage.
   */
  private static async tryRefreshOn401(): Promise<boolean> {
    try {
      const renewed = await refreshCustomerTokens();
      return !!renewed?.accessToken;
    } catch {
      return false;
    }
  }

  private static async handleRequest<T>(
    endpoint: string,
    options: RequestInit,
    retryConfig?: Partial<import('../lib/network-resilience').RetryConfig>,
    retried401 = false
  ): Promise<T> {
    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }

    const url = `${API_BASE_URL}${endpoint}`;
    const headers = await this.getAuthHeaders();

    // Check if offline
    if (!this.networkMonitor.getIsConnected()) {
      // Queue request if it's a POST/PUT/DELETE
      if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
        await this.offlineQueue.enqueue({
          url: endpoint,
          method: options.method,
          body: options.body as string,
          headers,
          priority: 'normal',
        });
        throw new NetworkError('No network connection. Request queued for later.', 'offline', undefined, true);
      } else {
        throw new NetworkError('No network connection', 'offline', undefined, false);
      }
    }

    try {
      const response = await resilientFetch(url, {
        ...options,
        headers: { ...headers, ...(options.headers as Record<string, string>) },
      }, retryConfig);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));

        // 90-day persistent login: on 401 we *first* try the refresh token.
        // We only drop tokens when the refresh endpoint conclusively rejects
        // them (see refreshCustomerTokens()) — never on a single bad request.
        if (response.status === 401 && !retried401) {
          const refreshed = await this.tryRefreshOn401();
          if (refreshed) {
            return this.handleRequest<T>(endpoint, options, retryConfig, true);
          }
          // No refresh available / network blip — leave the stored session
          // alone so the next call can try again instead of forcing logout.
        }

        // Check if retryable
        const retryableStatusCodes = retryConfig?.retryableStatusCodes || [408, 429, 500, 502, 503, 504];
        if (retryableStatusCodes.includes(response.status)) {
          throw new NetworkError(
            errorData.error || `HTTP ${response.status}`,
            response.status >= 500 ? 'server_error' : 'client_error',
            response.status,
            true
          );
        } else {
          throw new NetworkError(
            errorData.error || `HTTP ${response.status}`,
            'client_error',
            response.status,
            false
          );
        }
      }

      return await response.json();
    } catch (error: any) {
      // Re-throw NetworkError as-is
      if (error instanceof NetworkError) {
        throw error;
      }
      
      // Wrap other errors
      throw new NetworkError(
        error.message || 'Unknown error',
        'unknown',
        undefined,
        false,
        error
      );
    }
  }

  static async get(endpoint: string, retryConfig?: Partial<typeof RETRY_CONFIG>) {
    return this.handleRequest(endpoint, { method: 'GET' }, retryConfig);
  }

  static async post(endpoint: string, data: any, retryConfig?: Partial<typeof RETRY_CONFIG>) {
    return this.handleRequest(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      retryConfig
    );
  }

  static async put(endpoint: string, data: any, retryConfig?: Partial<typeof RETRY_CONFIG>) {
    return this.handleRequest(
      endpoint,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      retryConfig
    );
  }

  static async delete(endpoint: string, retryConfig?: Partial<typeof RETRY_CONFIG>) {
    return this.handleRequest(endpoint, { method: 'DELETE' }, retryConfig);
  }

  static async saveSessionToken(token: string) {
    // Keep the legacy single-key slot in sync. The structured session bundle
    // is written by saveCustomerLoginResponse() from auth-session.ts during
    // OTP / password login.
    await AsyncStorage.setItem(SESSION_TOKEN_KEY, token);
  }

  /**
   * Full logout — only call from an explicit user action (e.g. Settings → Log
   * out). API request failures should NEVER call this directly; the 401
   * handler in handleRequest already takes care of recovering via refresh.
   */
  static async clearSessionToken() {
    await clearCustomerSession();
  }

  static async getSessionToken(): Promise<string | null> {
    const fresh = await getValidCustomerAccessToken();
    if (fresh) return fresh;
    return AsyncStorage.getItem(SESSION_TOKEN_KEY);
  }
}

// Customer-specific API methods
export const CustomerApi = {
  // Profile
  getProfile: async (identifier: string) => {
    // Support both phone and customerId
    const response = await ApiService.get(`/customer-by-phone/${identifier}`).catch(() => 
      ApiService.get(`/customer/${identifier}`)
    );
    return response.customer || response.profile || response;
  },
  updateProfile: (identifier: string, data: any) => {
    // Support both phone and customerId
    return ApiService.put(`/customer/${identifier}`, data).catch(() =>
      ApiService.put(`/customer/profile/${identifier}`, data)
    );
  },
  getCustomerByPhone: async (phone: string) => {
    const response = await ApiService.get(`/customer-by-phone/${phone}`);
    return response.customer || response;
  },
  
  // Pets
  getPets: async (identifier: string) => {
    // Support both phone and customerId
    const response = await ApiService.get(`/customer/pets/${identifier}`).catch(() =>
      ApiService.get(`/customer/pets?phone=${identifier}`)
    );
    return response.pets || response;
  },
  /** GET /customer/:phone/pets/:petId — aligns with Lambda pets routes */
  getPet: (phone: string, petId: string) =>
    ApiService.get(
      `/customer/${encodeURIComponent(phone)}/pets/${encodeURIComponent(petId)}`
    ),
  addPet: (phone: string, petData: any) => ApiService.post(`/customer/pets`, { phone, pets: [petData] }),
  updatePet: (petId: string, petData: any) => ApiService.put(`/pet/${petId}`, petData),
  deletePet: (petId: string) => ApiService.delete(`/pet/${petId}`),
  
  // Services
  searchServices: (params: any) => ApiService.post('/search/vendors', params),
  /** Published vendor listing id = vendor_services.id; backend resolves via GET /services/:id (not /customer/services/:id). */
  getServiceDetails: async (serviceId: string) => {
    const raw = await ApiService.get<any>(`/services/${encodeURIComponent(serviceId)}`);
    const svc = raw?.service ?? raw;
    if (__DEV__ && svc && (svc.id || svc.serviceId)) {
      console.log('[getServiceDetails]', { requestedServiceId: serviceId, resolvedId: String(svc.id ?? svc.serviceId) });
    }
    return svc;
  },
  getServices: (params?: any) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return ApiService.get(`/customer/services${query}`);
  },
  getVendorDetails: (vendorId: string) => ApiService.get(`/vendor/${vendorId}`),
  getVendorServices: (vendorId: string) => ApiService.get(`/vendor/${vendorId}/services`),
  getProblemGrid: (roleId: string) => ApiService.get(`/vendor/problem-grid-specializations/${roleId}`),
  getVendorPackages: (vendorId: string, serviceType?: string) => {
    const query = serviceType ? `?serviceType=${serviceType}` : '';
    return ApiService.get(`/vendor/${vendorId}/packages${query}`);
  },
  
  // Adoption
  submitAdoptionApplication: (applicationData: any) => ApiService.post('/customer/adoption-application', applicationData),
  
  // Bookings
  createBooking: (bookingData: any) => ApiService.post('/bookings/create', bookingData),
  getBookings: async (identifier: string) => {
    // Support both phone and customerId
    const response = await ApiService.get(`/customer/${identifier}/bookings`).catch(() =>
      ApiService.get(`/bookings/${identifier}`)
    );
    return response.bookings || response;
  },
  getBookingDetails: (bookingId: string) => ApiService.get(`/bookings/${bookingId}`),
  /** Server-side refund preview (tiers, net paid, non-refundable platform fee). */
  calculateBookingRefund: (bookingId: string) =>
    ApiService.post(`/bookings/${bookingId}/calculate-refund`, {}),
  cancelBooking: (bookingId: string, reason?: string) => 
    ApiService.post(`/bookings/${bookingId}/cancel`, { reason }),
  rescheduleBooking: (bookingId: string, newDate: string, newTime: string, reason?: string) =>
    ApiService.post(`/bookings/${bookingId}/reschedule`, { newDate, newTimeSlot: newTime, reason }),
  
  // Orders (E-commerce) - Updated to use new customer-orders endpoints
  getOrders: async (identifier: string) => {
    // Use new customer-orders endpoint
    const response = await ApiService.get(`/customer/orders?customerId=${identifier}`).catch(() =>
      ApiService.get(`/customer/${identifier}/orders`).catch(() =>
        ApiService.get(`/orders/customer/${identifier}`)
      )
    );
    return response.orders || response;
  },
  getOrderDetails: (orderId: string) => ApiService.get(`/customer/orders/${orderId}`),
  getOrderInvoice: (orderId: string) => ApiService.get(`/customer/orders/${orderId}/invoice`),
  getOrderTracking: (orderId: string) => ApiService.get(`/customer/shop/orders/${orderId}/track`),
  cancelOrder: (orderId: string, reason?: string) => 
    ApiService.post(`/customer/shop/orders/${orderId}/cancel`, { reason }),
  getOrderHistory: async (customerId: string) => {
    // Use new customer-orders endpoint
    const response = await ApiService.get(`/customer/orders?customerId=${customerId}`);
    return response.orders || response;
  },
  
  // Support Tickets
  getSupportTickets: (phone: string) => ApiService.get(`/crm/tickets?customerPhone=${phone}`),
  createSupportTicket: (phone: string, ticketData: any) => 
    ApiService.post('/crm/tickets', { customerPhone: phone, ...ticketData }),
  /** FAQs for Help & Support (falls back to empty list if route missing) */
  getFAQs: async () => {
    try {
      return await ApiService.get('/customer/faqs');
    } catch {
      try {
        return await ApiService.get('/support/faqs');
      } catch {
        return { faqs: [] };
      }
    }
  },
  /** Help & Support contact form → support ticket */
  contactSupport: async (data: { subject: string; message: string; customerId?: string }) => {
    const phone = data.customerId || '';
    try {
      return await ApiService.post('/support/tickets', {
        customerPhone: phone,
        subject: data.subject,
        message: data.message,
        source: 'customer',
      });
    } catch {
      return ApiService.post('/crm/tickets', {
        customerPhone: phone,
        subject: data.subject,
        message: data.message,
      });
    }
  },
  
  // Pet Bookings — GET /customer/:phone/pets/:petId/bookings (Lambda)
  getPetBookings: (phone: string, petId: string) =>
    ApiService.get(
      `/customer/${encodeURIComponent(phone)}/pets/${encodeURIComponent(petId)}/bookings`
    ),
  
  // OTP (API Gateway uses /auth/otp/* — include E.164 phone + optional referral)
  generateOtp: (phone: string) =>
    ApiService.post('/auth/otp/send', { phone: phone.startsWith('+') ? phone : `+91${phone}`, role: 'customer' }),
  verifyOtp: (phone: string, otp: string, referralCode?: string) =>
    ApiService.post('/auth/otp/verify', {
      phone: phone.startsWith('+') ? phone : `+91${phone}`,
      otp,
      role: 'customer',
      ...(referralCode?.trim() ? { referralCode: referralCode.trim().toUpperCase() } : {}),
    }),
  
  // Notifications
  getNotifications: (customerId: string) => ApiService.get(`/customer/notifications/${customerId}`),
  markNotificationAsRead: (notificationId: string) => 
    ApiService.put(`/notification/${notificationId}/read`, {}),
  markAllNotificationsAsRead: (customerId: string) => 
    ApiService.put(`/customer/notifications/${customerId}/mark-all-read`, {}),
  markNotificationRead: (notificationId: string) => ApiService.post(`/notifications/${notificationId}/read`, {}),
  deleteNotification: (notificationId: string) => ApiService.delete(`/notification/${notificationId}`),
  clearAllNotifications: (customerId: string) => 
    ApiService.delete(`/customer/notifications/${customerId}/clear-all`),
  registerPushToken: (userId: string, token: string, deviceType: 'ios' | 'android') => 
    ApiService.post('/notifications/push/register', { userId, token, deviceType, userType: 'customer' }),
  
  // Booking Operations
  checkInBooking: (bookingId: string, checkInData: { latitude: number; longitude: number; timestamp: string }) =>
    ApiService.post(`/bookings/${bookingId}/checkin`, checkInData),
  submitFeedback: (bookingId: string, feedbackData: { rating: number; feedback: string; customerId?: string }) =>
    ApiService.post(`/bookings/${bookingId}/feedback`, feedbackData),
  getBookingReceipt: (bookingId: string) => ApiService.get(`/bookings/${bookingId}/receipt`),
  
  // Address Management
  getAddresses: async (identifier: string) => {
    // Support both phone and customerId
    const response = await ApiService.get(`/customer/${identifier}/addresses`).catch(() =>
      ApiService.get(`/customer/addresses?customerId=${identifier}`)
    );
    return response.addresses || response;
  },
  addAddress: (addressData: any) => ApiService.post('/customer/addresses', addressData),
  updateAddress: (addressId: string, addressData: any) => ApiService.put(`/customer/addresses/${addressId}`, addressData),
  deleteAddress: (addressId: string) => ApiService.delete(`/customer/addresses/${addressId}`),
  
  // Shopping Cart
  getCart: (customerId: string) => ApiService.get(`/customer/shop/cart/${customerId}`),
  addToCart: (customerId: string, productId: string, quantity: number) => 
    ApiService.post(`/customer/shop/cart/${customerId}`, { productId, quantity }),
  updateCartItem: (customerId: string, itemId: string, quantity: number) =>
    ApiService.put(`/customer/shop/cart/${customerId}/items/${itemId}`, { quantity }),
  deleteCartItem: (customerId: string, itemId: string) =>
    ApiService.delete(`/customer/shop/cart/${customerId}/items/${itemId}`),
  
  // Checkout
  checkout: (customerId: string, paymentMethod: string, addressId: string, promoCode?: string) =>
    ApiService.post('/customer/shop/checkout', { customerId, paymentMethod, addressId, promoCode }),
  
  // Coupons
  validateCoupon: (couponCode: string, cartTotal: number, customerId: string) =>
    ApiService.post('/customer/shop/coupons/validate', { couponCode, cartTotal, customerId }),
  getAvailableCoupons: (customerId: string) =>
    ApiService.get(`/customer/shop/coupons/available?customerId=${customerId}`),
  
  // Shop
  getShopHomeData: () => ApiService.get('/customer/shop/home'),
  searchProducts: (query: string, category?: string) => {
    const params = new URLSearchParams({ q: query });
    if (category) params.append('category', category);
    return ApiService.get(`/customer/shop/products?${params}`);
  },
  getProductDetails: (productId: string) => ApiService.get(`/customer/shop/products/${productId}`),
  
  // Profile Management
  changePassword: (passwordData: { currentPassword: string; newPassword: string; customerId: string }) =>
    ApiService.post('/customer/change-password', passwordData),
  // Settings
  getSettings: (customerId: string) => ApiService.get(`/customer/${customerId}/settings`),
  updateSettings: (customerId: string, settings: any) =>
    ApiService.put(`/customer/${customerId}/settings`, settings),
  // Onboarding
  updateOnboardingStatus: (identifier: string, status: string, data?: any) =>
    ApiService.post(`/customer/${identifier}/onboarding`, { status, data }),
  
  // Wishlist
  getWishlist: (customerId: string) => ApiService.get(`/customer/${customerId}/wishlist`),
  addToWishlist: (customerId: string, productId: string) => ApiService.post(`/customer/${customerId}/wishlist`, { productId }),
  removeFromWishlist: (wishlistItemId: string) => ApiService.delete(`/customer/wishlist/${wishlistItemId}`),
  
  // Order Operations
  getOrderInvoice: (orderId: string) => ApiService.get(`/orders/${orderId}/invoice`),
  reorder: (orderId: string, customerId: string) => 
    ApiService.post(`/customer/shop/orders/${orderId}/reorder`, { customerId }),
  // Order Returns
  createReturn: (returnData: { orderId: string; items: any[]; reason: string; customerId: string }) => 
    ApiService.post('/customer/returns', returnData),
  
  // Events
  getEvents: (vendorId?: string) => {
    const query = vendorId ? `?vendorId=${vendorId}` : '';
    return ApiService.get(`/customer/events${query}`);
  },
  getEvent: (eventId: string) => ApiService.get(`/customer/events/${eventId}`),
  registerForEvent: (eventId: string, customerId: string, attendeesCount: number) =>
    ApiService.post(`/customer/events/${eventId}/register`, { customerId, attendeesCount }),
  
  // Memorial Services
  getMemorialServices: (vendorId?: string) => {
    const query = vendorId ? `?vendorId=${vendorId}` : '';
    return ApiService.get(`/customer/memorial/services${query}`);
  },
  getMemorialProducts: (vendorId?: string) => {
    const query = vendorId ? `?vendorId=${vendorId}` : '';
    return ApiService.get(`/customer/memorial/products${query}`);
  },
  
  // Donation Campaigns
  getDonationCampaigns: (vendorId?: string) => {
    const query = vendorId ? `?vendorId=${vendorId}` : '';
    return ApiService.get(`/customer/donations/campaigns${query}`);
  },
  makeDonation: (campaignId: string, amount: number, message?: string, customerId?: string) =>
    ApiService.post(`/customer/donations/${campaignId}/donate`, { amount, message, customerId }),
  
  // Counseling Sessions
  getCounselingSessions: (vendorId?: string) => {
    const url = vendorId ? `/vendor/counseling/${vendorId}` : '/customer/counseling/sessions';
    return ApiService.get(url);
  },
  bookCounselingSession: (vendorId: string, sessionData: any) =>
    ApiService.post(`/customer/counseling/${vendorId}/book`, sessionData),
  
  // Diet Charts
  getDietCharts: (customerId: string) => ApiService.get(`/nutritionist/customer/${customerId}/diet-plans`),
  
  // Food/Nutritionist Products
  getNutritionistProducts: (vendorId: string) => ApiService.get(`/nutritionist/${vendorId}/menu`),
  
  // Pharmacy Products
  getPharmacyProducts: (vendorId?: string) => {
    if (vendorId) {
      return ApiService.get(`/vendor/${vendorId}/pharmacy/inventory`);
    }
    // Fallback to shop products with pharmacy category
    return ApiService.get('/customer/shop/products?category=pharmacy');
  },
  
  // Insurance
  getInsurancePlans: (type?: string) => {
    const query = type ? `?type=${type}` : '';
    return ApiService.get(`/insurance/plans${query}`);
  },
  calculateInsurancePremium: (planId: string, petAge: number, petBreed: string, coverageAmount: number) =>
    ApiService.post('/insurance/calculate-premium', { planId, petAge, petBreed, coverageAmount }),
  purchaseInsurance: (planId: string, customerId: string, petId: string, premiumAmount: number) =>
    ApiService.post('/insurance/purchase', { planId, customerId, petId, premiumAmount }),
  
  // Packages
  getPackages: (vendorId?: string, category?: string) => {
    const params = new URLSearchParams();
    if (vendorId) params.append('vendorId', vendorId);
    if (category) params.append('category', category);
    return ApiService.get(`/customer/packages${params.toString() ? `?${params.toString()}` : ''}`);
  },
  getPackageDetails: (packageId: string) => ApiService.get(`/customer/packages/${packageId}`),
  
  // Clinic/Facility Details
  getClinicDetails: async (clinicId: string) => {
    try {
      return await ApiService.get(`/customer/facility/${clinicId}`);
    } catch {
      // Fallback to clinic endpoint
      return await ApiService.get(`/clinic/${clinicId}`);
    }
  },
  
  // Media Upload
  uploadMedia: async (file: File | any, folder: string = 'general', fileName?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    if (fileName) formData.append('fileName', fileName);
    
    const response = await ApiService.post('/media/upload', formData);
    return (response as any).url || '';
  },
  
  // Payment Methods
  getPaymentMethods: (customerId: string) => ApiService.get(`/customer/${customerId}/payment-methods`),
  addPaymentMethod: (customerId: string, paymentMethodData: any) => 
    ApiService.post(`/customer/${customerId}/payment-methods`, paymentMethodData),
  setDefaultPaymentMethod: (customerId: string, methodId: string) => 
    ApiService.put(`/customer/${customerId}/payment-methods/${methodId}/set-default`, {}),
  deletePaymentMethod: (methodId: string) => 
    ApiService.delete(`/customer/payment-methods/${methodId}`),
};

// ✅ Payment API - Razorpay Integration
export const PaymentApi = {
  // Create Razorpay order
  createRazorpayOrder: (orderData: {
    amount: number;
    currency?: string;
    receipt: string;
    notes?: any;
    bookingId?: string;
    customerId?: string;
    vendorId?: string;
  }) => ApiService.post('/payment/razorpay/create-order', orderData),
  
  // Verify Razorpay payment
  verifyRazorpayPayment: (paymentData: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    bookingId?: string;
    customerId?: string;
  }) => ApiService.post('/payment/razorpay/verify', paymentData),
  
  // Get payment status
  getPaymentStatus: (paymentId: string) => ApiService.get(`/payment/${paymentId}/status`),
  
  // Request refund
  requestRefund: (paymentId: string, amount?: number, reason?: string) =>
    ApiService.post('/payment/refund', { paymentId, amount, reason }),
  // Retry failed payment
  retryPayment: (paymentId: string, orderId?: string, bookingId?: string, paymentMethod?: 'razorpay' | 'wallet') =>
    ApiService.post('/payment/retry', { paymentId, orderId, bookingId, paymentMethod }),
  // Get payment status
  getPaymentStatus: (paymentId: string) => ApiService.get(`/payment/${paymentId}/status`),
};

// ✅ NEW: Appointment API (SQL-migrated endpoints)
export const AppointmentApi = {
  // Use new customer-appointments endpoints
  getAppointments: (customerId: string) =>
    ApiService.get(`/customer/appointments?customerId=${encodeURIComponent(customerId)}`),
  /** Pass DB customer UUID when available so detail matches list (JWT sub may differ from customers.id). */
  getAppointment: (appointmentId: string, customerId?: string) => {
    const q = customerId ? `?customerId=${encodeURIComponent(customerId)}` : '';
    return ApiService.get(`/customer/appointments/${encodeURIComponent(appointmentId)}${q}`);
  },
  cancelAppointment: (appointmentId: string, reason?: string, customerId?: string) => {
    const q = customerId ? `?customerId=${encodeURIComponent(customerId)}` : '';
    return ApiService.post(`/customer/appointments/${encodeURIComponent(appointmentId)}/cancel${q}`, {
      reason,
    });
  },
  rescheduleAppointment: (
    appointmentId: string,
    newDate: string,
    newTime: string,
    reason?: string,
    customerId?: string
  ) => {
    const q = customerId ? `?customerId=${encodeURIComponent(customerId)}` : '';
    return ApiService.post(
      `/customer/appointments/${encodeURIComponent(appointmentId)}/reschedule${q}`,
      { appointment_date: newDate, appointment_time: newTime, reason }
    );
  },
};

// ✅ NEW: Booking OTP API (SQL-migrated endpoints)
export const BookingOtpApi = {
  generateOtp: (bookingId: string, sessionNumber?: number, action?: 'start' | 'end') => 
    ApiService.post(`/bookings/${bookingId}/generate-otp`, { sessionNumber: sessionNumber || 1, action: action || 'start' }),
  verifyOtp: (bookingId: string, otp: string, sessionNumber?: number, action?: 'start' | 'end') => 
    ApiService.post(`/bookings/${bookingId}/verify-otp`, { otp, sessionNumber: sessionNumber || 1, action: action || 'start' }),
};

// ✅ NEW: Rescheduling API (SQL-migrated endpoints)
export const ReschedulingApi = {
  getPolicy: (serviceType: string) => ApiService.get(`/booking/rescheduling-policy/${serviceType}`),
  updatePolicy: (serviceType: string, policy: any) => 
    ApiService.put(`/booking/rescheduling-policy/${serviceType}`, policy),
  getRescheduleOptions: (bookingId: string) => 
    ApiService.get(`/booking/${bookingId}/reschedule-options`),
  requestReschedule: (bookingId: string, requestedDate: string, reason?: string) => 
    ApiService.post(`/booking/${bookingId}/reschedule`, { requestedDate, reason }),
  confirmReschedule: (bookingId: string, rescheduleId: string) => 
    ApiService.post(`/booking/${bookingId}/reschedule/confirm`, { rescheduleId }),
};

// ✅ NEW: Staff Discovery API (SQL-migrated endpoints)
export const StaffDiscoveryApi = {
  discoverStaff: (params: {
    roleId: string;
    serviceStyle: 'at_home' | 'at_center' | 'tele';
    latitude?: number;
    longitude?: number;
    maxDistance?: number;
    serviceId?: string;
  }) => {
    const query = new URLSearchParams({
      roleId: params.roleId,
      serviceStyle: params.serviceStyle,
      ...(params.latitude && { latitude: params.latitude.toString() }),
      ...(params.longitude && { longitude: params.longitude.toString() }),
      ...(params.maxDistance && { maxDistance: params.maxDistance.toString() }),
      ...(params.serviceId && { serviceId: params.serviceId }),
    });
    return ApiService.get(`/customer/discover-staff?${query}`);
  },
  discoverStaffByVendor: (vendorId: string) => 
    ApiService.get(`/customer/discover-staff-by-vendor?vendorId=${vendorId}`),
};

// ✅ NEW: Search API enhancements (SQL-migrated endpoints)
export const SearchApi = {
  searchVendors: (params: any) => ApiService.post('/search/vendors', params),
  searchVendorsNearby: (params: any) => ApiService.post('/search/vendors/nearby', params),
  getTopRatedVendors: (limit?: number) => 
    ApiService.get(`/search/vendors/top-rated${limit ? `?limit=${limit}` : ''}`),
  searchServices: (query?: string) => 
    ApiService.get(`/search/services${query ? `?query=${query}` : ''}`),
  getFeaturedVendors: () => ApiService.get('/search/vendors/featured'),
  getCategories: () => ApiService.get('/search/categories'),
};

/**
 * Same contract as customer-web GET /search?q=&category=&limit= — service hits use vendor_services.id.
 */
export const EnhancedSearchApi = {
  search: async (params: {
    query?: string;
    category?: string;
    sortBy?: 'relevance' | 'price_low' | 'price_high' | 'rating';
    limit?: number;
    userLat?: number;
    userLng?: number;
    customerPhone?: string;
  }) => {
    const sp = new URLSearchParams();
    const q = (params.query || '').trim();
    const hasCategory = !!(params.category && params.category !== 'all');
    if (q) sp.set('q', q);
    if (hasCategory) sp.set('category', params.category!);
    if (params.limit != null) sp.set('limit', String(params.limit));
    else sp.set('limit', '50');
    if (params.userLat != null && Number.isFinite(params.userLat)) {
      sp.set('userLat', String(params.userLat));
    }
    if (params.userLng != null && Number.isFinite(params.userLng)) {
      sp.set('userLng', String(params.userLng));
    }
    if (params.customerPhone?.trim()) {
      sp.set('customerPhone', params.customerPhone.trim());
    }
    if (!q && !hasCategory) {
      return { services: [] as any[] };
    }
    const raw = await ApiService.get<any>(`/search?${sp.toString()}`);
    const servicesRaw = raw.services ?? raw.data?.services ?? [];
    const mapped = (Array.isArray(servicesRaw) ? servicesRaw : []).map((s: any) => {
      const id = String(s.id ?? s.vendor_service_id ?? s.vendorServiceId ?? '').trim();
      const vendorId = String(s.vendorId ?? s.vendor_id ?? '').trim();
      const price = parseFloat(String(s.price ?? s.base_price ?? '0')) || 0;
      return {
        id,
        name: s.serviceName ?? s.service_name ?? s.name ?? '',
        description:
          s.description ?? s.custom_description ?? s.service_description ?? s.description_text ?? '',
        category: s.category ?? s.serviceType ?? s.service_type ?? '',
        price,
        vendorId,
        vendorName: s.vendorName ?? s.vendor_name ?? s.business_name ?? '',
        rating: s.rating != null ? parseFloat(String(s.rating)) : undefined,
        imageUrl: s.image_url ?? s.imageUrl,
      };
    }).filter((s: { id: string }) => s.id);
    if (__DEV__ && mapped[0]) {
      console.log('[EnhancedSearchApi] first hit', {
        searchResultId: mapped[0].id,
        vendorId: mapped[0].vendorId,
      });
    }
    let out = mapped;
    const sort = params.sortBy || 'relevance';
    if (sort === 'price_low') out = [...out].sort((a, b) => a.price - b.price);
    else if (sort === 'price_high') out = [...out].sort((a, b) => b.price - a.price);
    else if (sort === 'rating') out = [...out].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return { services: out, vendors: raw.vendors ?? raw.data?.vendors ?? [] };
  },
};

// ✅ NEW: Wallet API (Batch 14 SQL-migrated endpoints)
export const WalletApi = {
  getWallet: (customerId: string) => ApiService.get(`/customer/${customerId}/wallet`),
  getTopupOffers: (customerId: string) => ApiService.get(`/customer/${customerId}/wallet/topup-offers`),
  initiateTopup: (customerId: string, amount: number, bonusOffer?: any) => 
    ApiService.post(`/customer/${customerId}/wallet/topup/initiate`, { amount, bonusOffer }),
  // Alias for backward compatibility
  topUpWallet: (customerId: string, amount: number, bonusOffer?: any) => 
    ApiService.post(`/customer/${customerId}/wallet/topup/initiate`, { amount, bonusOffer }),
  topUp: (customerId: string, amount: number, paymentMethod?: string) => 
    ApiService.post(`/wallet/${customerId}/credit`, { amount, referenceType: 'topup', paymentMethod }),
  verifyTopup: (customerId: string, paymentId: string, orderId: string, signature: string) => 
    ApiService.post(`/customer/${customerId}/wallet/topup/verify`, { paymentId, orderId, signature }),
  getTransactions: (customerId: string, params?: { limit?: number; offset?: number; type?: string }) => {
    const query = params ? new URLSearchParams(Object.entries(params).map(([k,v]) => [k, String(v)])).toString() : '';
    return ApiService.get(`/customer/${customerId}/wallet/transactions${query ? `?${query}` : ''}`);
  },
};

// ✅ NEW: GPS Tracking API (Batch 14 SQL-migrated endpoints)
export const GPSTrackingApi = {
  startTracking: (bookingId: string) => ApiService.post(`/bookings/${bookingId}/start-tracking`),
  stopTracking: (bookingId: string) => ApiService.post(`/bookings/${bookingId}/stop-tracking`),
  updateLocation: (bookingId: string, location: { latitude: number; longitude: number; timestamp?: string; accuracy?: number }, sessionNumber?: number) => 
    ApiService.post(`/bookings/${bookingId}/update-location`, { location, sessionNumber }),
  getLiveLocation: (bookingId: string) => ApiService.get(`/bookings/${bookingId}/live-location`),
  getRoute: (bookingId: string) => ApiService.get(`/bookings/${bookingId}/route`),
};

// ✅ NEW: Nutritionist API (Batch 14 SQL-migrated endpoints)
export const NutritionistApi = {
  getMenu: (nutritionistId: string) => ApiService.get(`/nutritionist/${nutritionistId}/menu`),
  addMealItem: (nutritionistId: string, mealData: any) => 
    ApiService.post('/nutritionist/meals/item', { nutritionistId, ...mealData }),
  placeOrder: (orderData: any) => ApiService.post('/nutritionist/meals/order', orderData),
  assignDelivery: (orderId: string, deliveryPartnerId: string) => 
    ApiService.post(`/nutritionist/orders/${orderId}/assign-delivery`, { deliveryPartnerId }),
  trackOrder: (orderId: string) => ApiService.get(`/nutritionist/orders/${orderId}/track`),
  updateOrderStatus: (orderId: string, status: string) => 
    ApiService.put(`/nutritionist/orders/${orderId}/status`, { status }),
};

// ✅ NEW: Previous Providers API (Batch 8 SQL-migrated endpoints)
export const PreviousProvidersApi = {
  getPreviousProviders: (customerId: string, serviceType?: string) => {
    const query = serviceType ? `?serviceType=${serviceType}` : '';
    return ApiService.get(`/home-services/providers/previous/${customerId}${query}`);
  },
  addFavorite: (customerId: string, providerId: string) => 
    ApiService.post('/home-services/providers/favorite', { customerId, providerId }),
  removeFavorite: (customerId: string, providerId: string) => 
    ApiService.delete(`/home-services/providers/favorite/${customerId}/${providerId}`),
  getServiceHistory: (customerId: string) => 
    ApiService.get(`/home-services/providers/previous/${customerId}/history`),
};

// ✅ NEW: Nutritionist Diet Plans API (Batch 8 SQL-migrated endpoints)
export const NutritionistDietPlanApi = {
  createDietPlan: (planData: any) => ApiService.post('/nutritionist/diet-plan/create', planData),
  getDietPlansByCustomer: (customerId: string) => 
    ApiService.get(`/nutritionist/customer/${customerId}/diet-plans`),
  getDietPlan: (planId: string) => ApiService.get(`/nutritionist/diet-plan/${planId}`),
  updateDietPlan: (planId: string, updates: any) => 
    ApiService.put(`/nutritionist/diet-plan/${planId}`, updates),
};

// ✅ NEW: Medical History API (Batch 8 SQL-migrated endpoints)
export const MedicalHistoryApi = {
  getMedicalRecords: (appointmentId: string, headers?: { 'X-User-Id': string; 'X-User-Role': string }) => 
    ApiService.get(`/appointments/${appointmentId}/medical-records`, { headers }),
  uploadDocument: (appointmentId: string, fileData: any, headers?: { 'X-User-Id': string; 'X-User-Role': string }) => 
    ApiService.post(`/appointments/${appointmentId}/medical-records/upload`, fileData, { headers }),
  addVetSummary: (appointmentId: string, summary: any, headers?: { 'X-User-Id': string; 'X-User-Role': string }) => 
    ApiService.post(`/appointments/${appointmentId}/vet-summary`, summary, { headers }),
  getPrescriptions: (appointmentId: string) => 
    ApiService.get(`/appointments/${appointmentId}/prescriptions`),
};

// ✅ NEW: Integrated Services API (Batch 16 SQL-migrated endpoints)
export const IntegratedServicesApi = {
  getAvailableServices: (bookingId?: string, serviceType?: string, location?: { lat: number; lng: number }) => {
    const params = new URLSearchParams();
    if (bookingId) params.append('bookingId', bookingId);
    if (serviceType) params.append('serviceType', serviceType);
    if (location) {
      params.append('lat', location.lat.toString());
      params.append('lng', location.lng.toString());
    }
    return ApiService.get(`/integrated-services/available?${params}`);
  },
  getVendors: (type: string, lat?: number, lng?: number, radius?: number) => {
    const params = new URLSearchParams({ type });
    if (lat) params.append('lat', lat.toString());
    if (lng) params.append('lng', lng.toString());
    if (radius) params.append('radius', radius.toString());
    return ApiService.get(`/integrated-services/vendors?${params}`);
  },
  selectService: (bookingId: string, serviceType: string, vendorId: string) => 
    ApiService.post('/integrated-services/select', { bookingId, serviceType, vendorId }),
  getBookingServices: (bookingId: string) => 
    ApiService.get(`/integrated-services/booking/${bookingId}`),
  updateServiceStatus: (serviceId: string, status: string) => 
    ApiService.put(`/integrated-services/${serviceId}/status`, { status }),
};

// ✅ NEW: Advanced Search API (Batch 16 SQL-migrated endpoints)
export const AdvancedSearchApi = {
  universalSearch: (query: string, type?: string, limit?: number) => 
    ApiService.post('/advanced-search/universal', { query, type, limit: limit || 20 }),
  vendorSearch: (query: string, location?: { lat: number; lng: number }, radius?: number) => 
    ApiService.post('/advanced-search/vendors', { query, location, radius }),
};

// ✅ NEW: Vendor Analytics API (Batch 16 SQL-migrated endpoints)
export const VendorAnalyticsApi = {
  getAnalytics: (vendorId: string, period?: 'day' | 'week' | 'month' | 'year' | 'all') => {
    const query = period ? `?period=${period}` : '';
    return ApiService.get(`/vendor/${vendorId}/analytics${query}`);
  },
};

// ✅ NEW: Search Analytics API (Batch 16 SQL-migrated endpoints)
export const SearchAnalyticsApi = {
  trackQuery: (query: string, userId: string, results: { count: number }) => 
    ApiService.post('/search/analytics/track', { query, userId, results }),
  trackClick: (eventId: string, clicked: string, timeToClick?: number) => 
    ApiService.post('/search/analytics/click', { eventId, clicked, timeToClick }),
  trackConversion: (eventId: string, conversionType: string, value?: number) => 
    ApiService.post('/search/analytics/convert', { eventId, conversionType, value }),
  getPopular: (limit?: number, days?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (days) params.append('days', days.toString());
    return ApiService.get(`/search/analytics/popular?${params}`);
  },
};

// ✅ NEW: Health Problems API (Batch 16 SQL-migrated endpoints)
export const HealthProblemsApi = {
  getAll: (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return ApiService.get(`/health-problems${query}`);
  },
  getById: (id: string) => ApiService.get(`/health-problems/${id}`),
  create: (data: { name: string; displayName: string; icon?: string }) => 
    ApiService.post('/admin/health-problems', data),
  update: (id: string, data: any) => ApiService.put(`/admin/health-problems/${id}`, data),
  delete: (id: string) => ApiService.delete(`/admin/health-problems/${id}`),
};

// ✅ NEW: Elasticsearch Proxy API (Batch 16 SQL-migrated endpoints)
export const ElasticsearchProxyApi = {
  search: (query: string, type?: string) => {
    const params = new URLSearchParams({ q: query });
    if (type) params.append('type', type);
    return ApiService.get(`/search/elastic?${params}`);
  },
  autocomplete: (query: string) => ApiService.get(`/search/autocomplete?q=${query}`),
  reindex: () => ApiService.post('/search/index'),
};

// ✅ NEW: Bank Verification API (Batch 16 SQL-migrated endpoints)
export const BankVerificationApi = {
  verifyRazorpay: (vendorId: string, accountNumber: string, ifscCode: string, accountHolderName: string) => 
    ApiService.post('/payment/bank-account/verify-razorpay', { vendorId, accountNumber, ifscCode, accountHolderName }),
  getVerificationStatus: (accountId: string) => 
    ApiService.get(`/payment/bank-account/verification-status/${accountId}`),
  pennyDrop: (vendorId: string, accountNumber: string, ifscCode: string) => 
    ApiService.post('/payment/bank-account/penny-drop', { vendorId, accountNumber, ifscCode }),
  getVendorBankAccount: (vendorId: string) => 
    ApiService.get(`/payment/bank-account/${vendorId}`),
};

// ✅ NEW: Independent Vendor System API (Batch 15 SQL-migrated endpoints)
export const IndependentVendorApi = {
  onboardIndependent: (vendorData: {
    vendorName: string;
    vendorType: 'ambulance' | 'pharmacy' | 'diagnostics';
    location: any;
    services: string[];
    operatingHours?: any;
    contactInfo: any;
    logisticsPartner?: string;
  }) => ApiService.post('/integrated-services/vendor/onboard-independent', vendorData),
  getVendor: (vendorId: string) => ApiService.get(`/integrated-services/vendor/independent/${vendorId}`),
  updateVendor: (vendorId: string, updates: any) => 
    ApiService.put(`/integrated-services/vendor/independent/${vendorId}`, updates),
  listVendors: (filters?: { type?: string; status?: string; location?: any }) => {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.status) params.append('status', filters.status);
    return ApiService.get(`/integrated-services/vendor/independent/list?${params}`);
  },
  configureService: (config: any) => ApiService.post('/integrated-services/vendor/service-config', config),
  approveVendor: (vendorId: string, approve: boolean) => 
    ApiService.post(`/integrated-services/vendor/independent/${vendorId}/approve`, { approve }),
};

// ✅ NEW: Dating Chat API (Batch 15 SQL-migrated endpoints)
export const DatingChatApi = {
  sendMessage: (matchId: string, senderId: string, message: string, messageType?: string, attachmentUrl?: string) => 
    ApiService.post(`/dating/chat/${matchId}/message`, { senderId, message, messageType, attachmentUrl }),
  getMessages: (matchId: string, limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    return ApiService.get(`/dating/chat/${matchId}/messages?${params}`);
  },
  markAsRead: (matchId: string, messageId: string) => 
    ApiService.post(`/dating/chat/${matchId}/messages/${messageId}/read`),
  uploadMedia: (matchId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return ApiService.post(`/dating/chat/${matchId}/upload-media`, formData);
  },
  getUnreadCount: (matchId: string) => ApiService.get(`/dating/chat/${matchId}/unread-count`),
};

/** Booking-scoped customer ↔ vendor chat (Lambda `chat.ts`) */
export const BookingChatApi = {
  getConversation: (bookingId: string) =>
    ApiService.get(`/chat/booking/${bookingId}/conversation`),
  sendMessage: (
    bookingId: string,
    payload: {
      senderPhone: string;
      senderName?: string;
      senderType: 'customer';
      message: string;
      messageType?: string;
    }
  ) => ApiService.post(`/chat/booking/${bookingId}/message`, payload),
  markConversationRead: (bookingId: string) =>
    ApiService.post(`/chat/conversations/${bookingId}/read`, {}),
  getConversations: (opts: { customerId?: string; phone?: string }) => {
    const q = new URLSearchParams();
    if (opts.customerId) q.append('customerId', opts.customerId);
    if (opts.phone) q.append('phone', opts.phone.replace(/\D/g, ''));
    return ApiService.get(`/chat/conversations?${q.toString()}`);
  },
};

// ✅ NEW: Tier Commission API (Batch 15 SQL-migrated endpoints)
export const TierCommissionApi = {
  calculateCommission: (bookingId: string) => 
    ApiService.get(`/payment/commission/calculate/${bookingId}`),
  applyCommission: (bookingId: string, commissionData: any) => 
    ApiService.post('/payment/commission/apply', { bookingId, ...commissionData }),
  getTierCommission: (tierId: string) => ApiService.get(`/payment/commission/tier/${tierId}`),
  updateTierCommission: (tierId: string, updates: any) => 
    ApiService.put(`/payment/commission/tier/${tierId}/update`, updates),
  listTiers: () => ApiService.get('/payment/commission/tiers/list'),
};

// ✅ NEW: Memorial Services API (Batch 15 SQL-migrated endpoints)
export const MemorialServicesApi = {
  getServices: (vendorId: string, status?: string) => {
    const query = status ? `?status=${status}` : '';
    return ApiService.get(`/vendor/memorial/${vendorId}/services${query}`);
  },
  getService: (vendorId: string, serviceId: string) => 
    ApiService.get(`/vendor/memorial/${vendorId}/services/${serviceId}`),
  createService: (vendorId: string, serviceData: any) => 
    ApiService.post(`/vendor/memorial/${vendorId}/services`, serviceData),
  updateService: (vendorId: string, serviceId: string, updates: any) => 
    ApiService.put(`/vendor/memorial/${vendorId}/services/${serviceId}`, updates),
  updateServiceStatus: (vendorId: string, serviceId: string, status: string) => 
    ApiService.post(`/vendor/memorial/${vendorId}/services/${serviceId}/status`, { status }),
  getTributes: (vendorId: string) => ApiService.get(`/vendor/memorial/${vendorId}/tributes`),
  createTribute: (vendorId: string, tributeData: any) => 
    ApiService.post(`/vendor/memorial/${vendorId}/tributes`, tributeData),
  getProducts: (vendorId: string) => ApiService.get(`/vendor/memorial/${vendorId}/products`),
  createProduct: (vendorId: string, productData: any) => 
    ApiService.post(`/vendor/memorial/${vendorId}/products`, productData),
};

// ✅ NEW: Staff Service Style Setup API (Batch 15 SQL-migrated endpoints - Admin only)
export const StaffServiceStyleSetupApi = {
  setupServiceStyles: () => ApiService.post('/admin/setup-staff-service-styles'),
  getSetupStatus: () => ApiService.get('/admin/staff-style-status'),
};

// ✅ NEW: Appointment Reminder API (Batch 9 SQL-migrated endpoints)
export const AppointmentReminderApi = {
  setPreferences: (customerId: string, preferences: any) => 
    ApiService.post(`/customer/${customerId}/reminder-preferences`, preferences),
  getPreferences: (customerId: string) => 
    ApiService.get(`/customer/${customerId}/reminder-preferences`),
  scheduleReminders: (bookingId: string, reminderConfig?: any) => 
    ApiService.post(`/bookings/${bookingId}/schedule-reminders`, reminderConfig || {}),
  getReminders: (bookingId: string) => 
    ApiService.get(`/bookings/${bookingId}/reminders`),
  cancelReminder: (reminderId: string) => 
    ApiService.delete(`/reminders/${reminderId}/cancel`),
  sendReminderNow: (reminderId: string) => 
    ApiService.post(`/reminders/${reminderId}/send-now`),
  getReminderHistory: (customerId: string, limit?: number) => {
    const params = limit ? `?limit=${limit}` : '';
    return ApiService.get(`/customer/${customerId}/reminder-history${params}`);
  },
};

// ✅ NEW: Call API (Batch 9 SQL-migrated endpoints)
export const CallApi = {
  initiateCall: (bookingId: string, callType: 'video' | 'voice', initiatedBy: string) => 
    ApiService.post('/call/initiate', { bookingId, callType, initiatedBy }),
  answerCall: (callId: string) => ApiService.post(`/call/${callId}/answer`),
  endCall: (callId: string) => ApiService.post(`/call/${callId}/end`),
  rejectCall: (callId: string) => ApiService.post(`/call/${callId}/reject`),
  getCall: (callId: string) => ApiService.get(`/call/${callId}`),
  getCallHistory: (bookingId: string) => ApiService.get(`/call/booking/${bookingId}/history`),
  getCustomerCallHistory: (customerPhone: string) => 
    ApiService.get(`/call/customer/${customerPhone}/history`),
  getVendorCallHistory: (vendorId: string) => ApiService.get(`/call/vendor/${vendorId}/history`),
};

// ✅ NEW: Booking Validation API (Batch 17 SQL-migrated endpoints)
export const BookingValidationApi = {
  validateBooking: (data: { staffId: string; serviceId: string; serviceType: string; customerLocation?: any }) => 
    ApiService.post('/booking/validate', data),
  getBookingEligibility: (staffId: string) => 
    ApiService.get(`/staff/${staffId}/booking-eligibility`),
};

// ✅ NEW: Slot Availability API (Batch 17 SQL-migrated endpoints)
export const SlotAvailabilityApi = {
  getVendorAvailability: (vendorId: string, date: string) => 
    ApiService.get(`/vendor/${vendorId}/availability/${date}`),
  /** vendorId + vendor_services.id (same id as search / GET /services/:id). */
  getAvailableSlots: (vendorId: string, serviceId: string, date: string) => {
    const q = new URLSearchParams({
      date,
      serviceId,
      serviceStyle: 'at_center',
    });
    return ApiService.get(
      `/customer/vendor/${encodeURIComponent(vendorId)}/available-slots?${q.toString()}`
    );
  },
};

// ✅ NEW: Refund Policy Engine API (Batch 17 SQL-migrated endpoints)
export const RefundPolicyEngineApi = {
  getRefundEstimate: (bookingId: string) => 
    ApiService.get(`/refunds/estimate/${bookingId}`),
  requestRefund: (bookingId: string, reason?: string, refundMethod?: string) => 
    ApiService.post('/refunds/request', { bookingId, reason, refundMethod }),
};

// ✅ NEW: Scheduled Tele Booking API (Batch 17 SQL-migrated endpoints)
export const ScheduledTeleBookingApi = {
  getScheduledAvailability: (serviceId: string, date: string) => 
    ApiService.get(`/tele/scheduled-availability?serviceId=${serviceId}&date=${date}`),
  createScheduledTeleBooking: (bookingData: any) => 
    ApiService.post('/bookings/scheduled-tele', bookingData),
};

// ✅ NEW: Integrated Services Manager API (Batch 17 SQL-migrated endpoints)
export const IntegratedServicesManagerApi = {
  getAvailableProviders: (lat: number, lng: number, type?: string, maxDistance?: number) => {
    const params = new URLSearchParams({ lat: lat.toString(), lng: lng.toString() });
    if (type) params.append('type', type);
    if (maxDistance) params.append('maxDistance', maxDistance.toString());
    return ApiService.get(`/integrated-services/available?${params}`);
  },
  requestService: (requestData: any) => 
    ApiService.post('/integrated-services/request', requestData),
};

// ✅ NEW: Nutritionist Food Integration API (Batch 17 SQL-migrated endpoints)
export const NutritionistFoodIntegrationApi = {
  convertDietPlanToOrder: (planId: string, orderData: any) => 
    ApiService.post(`/nutritionist/diet-plan/${planId}/convert-to-order`, orderData),
  getDietPlanOrders: (planId: string) => 
    ApiService.get(`/nutritionist/diet-plan/${planId}/orders`),
};

// ✅ NEW: Enhanced Problem Discovery API (Batch 10 SQL-migrated endpoints)
export const EnhancedProblemDiscoveryApi = {
  discoverByProblem: (roleId: string, problemId: string) => 
    ApiService.get(`/customer/discover-by-problem-v2/${roleId}/${problemId}`),
};

// ✅ NEW: Analytics Events API (Batch 10 SQL-migrated endpoints)
export const AnalyticsEventsApi = {
  trackEvents: (events: any[]) => 
    ApiService.post('/analytics/track', { events }),
};

// ✅ NEW: Radar Location System API (Batch 10 SQL-migrated endpoints)
export const RadarLocationSystemApi = {
  getProvidersRadar: (lat: number, lng: number, radius?: number) => {
    const params = new URLSearchParams({ lat: lat.toString(), lng: lng.toString() });
    if (radius) params.append('radius', radius.toString());
    return ApiService.get(`/home-services/providers/radar?${params}`);
  },
  calculateCommuteTime: (from: any, to: any) => 
    ApiService.post('/home-services/calculate-commute-time', { from, to }),
  getNearbyProviders: (lat: number, lng: number, maxDistance?: number) => {
    const params = new URLSearchParams({ lat: lat.toString(), lng: lng.toString() });
    if (maxDistance) params.append('maxDistance', maxDistance.toString());
    return ApiService.get(`/home-services/providers/nearby?${params}`);
  },
};

// ✅ NEW: AI Chatbot API (Phase 3 - AI Chatbot Integration)
export const AIChatbotApi = {
  chat: (data: {
    message: string;
    customerId?: string;
    customerPhone?: string;
    conversationId?: string;
    context?: any;
    petId?: string;
  }) => ApiService.post('/ai-chatbot/chat', data),
  
  symptomsChecker: (data: {
    symptoms: string;
    petId?: string;
    petType?: string;
    petAge?: string;
    customerId?: string;
    customerPhone?: string;
  }) => ApiService.post('/ai-chatbot/symptoms-checker', data),
  
  bookingAssist: (data: {
    query: string;
    customerId?: string;
    customerPhone?: string;
    location?: { lat: number; lng: number };
    petId?: string;
  }) => ApiService.post('/ai-chatbot/booking-assist', data),
  
  escalateToAgent: (data: {
    conversationId: string;
    customerId?: string;
    customerPhone?: string;
    reason?: string;
    conversationHistory?: string;
  }) => ApiService.post('/ai-chatbot/escalate-to-agent', data),
  
  getConversation: (conversationId: string) => 
    ApiService.get(`/ai-chatbot/conversation/${conversationId}`),
};

// ✅ NEW: Support & CRM API (Phase 3 - AI Chatbot Integration)
export const SupportCrmApi = {
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
  }) => ApiService.post('/support/tickets', data),
  
  getTickets: (params?: {
    customerId?: string;
    customerPhone?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) => {
    if (!params) {
      return ApiService.get('/support/tickets');
    }
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      q.set(k, String(v));
    }
    const s = q.toString();
    return ApiService.get(`/support/tickets${s ? `?${s}` : ''}`);
  },
  
  getTicket: (ticketId: string) => ApiService.get(`/support/tickets/${ticketId}`),
  
  respondToTicket: (ticketId: string, data: {
    message: string;
    responderId?: string;
    responderType?: 'agent' | 'customer';
  }) => ApiService.post(`/support/tickets/${ticketId}/respond`, data),
  
  updateTicketStatus: (ticketId: string, status: string, resolution?: string) =>
    ApiService.put(`/support/tickets/${ticketId}/status`, { status, resolution }),
};

// ✅ NEW: Community API (Phase 1 - Mobile Improvements)
export const CommunityApi = {
  getPosts: (customerId: string, limit?: number, offset?: number) => {
    const params = new URLSearchParams({ customerId });
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    return ApiService.get(`/community/posts?${params}`);
  },
  createPost: (postData: { customerId: string; content: string; images?: string[]; petId?: string }) => 
    ApiService.post('/community/posts', postData),
  likePost: (postId: string, customerId: string) => 
    ApiService.post(`/community/posts/${postId}/like`, { customerId }),
  unlikePost: (postId: string, customerId: string) => 
    ApiService.delete(`/community/posts/${postId}/like?customerId=${customerId}`),
  commentPost: (postId: string, comment: { customerId: string; comment: string }) => 
    ApiService.post(`/community/posts/${postId}/comments`, comment),
  getComments: (postId: string, limit?: number) => {
    const params = limit ? `?limit=${limit}` : '';
    return ApiService.get(`/community/posts/${postId}/comments${params}`);
  },
  deletePost: (postId: string, customerId: string) => 
    ApiService.delete(`/community/posts/${postId}?customerId=${customerId}`),
};

// ✅ NEW: Referral API (Phase 1 - Mobile Improvements)
export const ReferralApi = {
  getReferralCode: (customerId: string) => 
    ApiService.get(`/customer/${customerId}/referral`),
  getReferralStats: (customerId: string) => 
    ApiService.get(`/customer/${customerId}/referral/stats`),
  sendInvite: (inviteData: { customerId: string; email?: string; phone?: string; message?: string }) => 
    ApiService.post('/referral/invite', inviteData),
  getReferralHistory: (customerId: string, limit?: number) => {
    const params = limit ? `?limit=${limit}` : '';
    return ApiService.get(`/customer/${customerId}/referral/history${params}`);
  },
  claimReward: (customerId: string, rewardId: string) => 
    ApiService.post(`/customer/${customerId}/referral/claim`, { rewardId }),
};

// ✅ NEW: Rewards API (Phase 1 - Mobile Improvements)
export const RewardsApi = {
  getPoints: (customerId: string) => 
    ApiService.get(`/customer/${customerId}/rewards/points`),
  getHistory: (customerId: string, limit?: number, offset?: number) => {
    const params = new URLSearchParams({ customerId });
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    return ApiService.get(`/customer/${customerId}/rewards/history?${params}`);
  },
  getAvailableRewards: (customerId: string) => 
    ApiService.get(`/customer/${customerId}/rewards/available`),
  redeemPoints: (customerId: string, rewardData: { points: number; rewardId: string }) => 
    ApiService.post(`/customer/${customerId}/rewards/redeem`, rewardData),
  getRewardDetails: (rewardId: string) => 
    ApiService.get(`/rewards/${rewardId}`),
};

// ✅ NEW: Subscription API (Phase 1 - Mobile Improvements)
export const SubscriptionApi = {
  getSubscriptions: (customerId: string) => 
    ApiService.get(`/customer/${customerId}/subscriptions`),
  getSubscriptionDetails: (subscriptionId: string) => 
    ApiService.get(`/subscriptions/${subscriptionId}`),
  cancelSubscription: (subscriptionId: string, reason?: string) => 
    ApiService.post(`/subscriptions/${subscriptionId}/cancel`, { reason }),
  pauseSubscription: (subscriptionId: string, pauseUntil?: string) => 
    ApiService.post(`/subscriptions/${subscriptionId}/pause`, { pauseUntil }),
  resumeSubscription: (subscriptionId: string) => 
    ApiService.post(`/subscriptions/${subscriptionId}/resume`, {}),
  getSubscriptionUsage: (subscriptionId: string, period?: string) => {
    const params = period ? `?period=${period}` : '';
    return ApiService.get(`/subscriptions/${subscriptionId}/usage${params}`);
  },
};

// ✅ NEW: Order Return API (Phase 1 - Mobile Improvements)
export const OrderReturnApi = {
  createReturn: (returnData: { orderId: string; items: any[]; reason: string; customerId: string }) => 
    ApiService.post('/customer/returns', returnData),
  getReturnStatus: (returnId: string) => 
    ApiService.get(`/customer/returns/${returnId}`),
  getReturnHistory: (customerId: string) => 
    ApiService.get(`/customer/${customerId}/returns`),
  cancelReturn: (returnId: string, customerId: string) => 
    ApiService.post(`/customer/returns/${returnId}/cancel`, { customerId }),
};

