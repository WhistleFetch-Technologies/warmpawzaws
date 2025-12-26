/**
 * API Service Layer
 * Centralized API calls for Customer App
 * Identical endpoints to web app
 */

import { API_BASE_URL, publicAnonKey } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_TOKEN_KEY = 'warmpawz_session_token';

export class ApiService {
  private static async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await AsyncStorage.getItem(SESSION_TOKEN_KEY);
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : `Bearer ${publicAnonKey}`,
    };
  }

  static async get(endpoint: string) {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }
    
    return response.json();
  }

  static async post(endpoint: string, data: any) {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }
    
    return response.json();
  }

  static async put(endpoint: string, data: any) {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }
    
    return response.json();
  }

  static async delete(endpoint: string) {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }
    
    return response.json();
  }

  static async saveSessionToken(token: string) {
    await AsyncStorage.setItem(SESSION_TOKEN_KEY, token);
  }

  static async clearSessionToken() {
    await AsyncStorage.removeItem(SESSION_TOKEN_KEY);
  }

  static async getSessionToken(): Promise<string | null> {
    return await AsyncStorage.getItem(SESSION_TOKEN_KEY);
  }
}

// Customer-specific API methods
export const CustomerApi = {
  // Profile
  getProfile: (phone: string) => ApiService.get(`/customer/profile/${phone}`),
  updateProfile: (phone: string, data: any) => ApiService.put(`/customer/profile/${phone}`, data),
  
  // Pets
  getPets: (phone: string) => ApiService.get(`/customer/pets/${phone}`),
  addPet: (phone: string, petData: any) => ApiService.post(`/customer/pets`, { phone, pets: [petData] }),
  updatePet: (petId: string, petData: any) => ApiService.put(`/pet/${petId}`, petData),
  deletePet: (petId: string) => ApiService.delete(`/pet/${petId}`),
  
  // Services
  searchServices: (params: any) => ApiService.post('/search/vendors', params),
  getServiceDetails: (serviceId: string) => ApiService.get(`/customer/services/${serviceId}`),
  getServices: (params?: any) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return ApiService.get(`/customer/services${query}`);
  },
  getVendorDetails: (vendorId: string) => ApiService.get(`/vendor/${vendorId}`),
  
  // Bookings
  createBooking: (bookingData: any) => ApiService.post('/bookings/create', bookingData),
  getBookings: (phone: string) => ApiService.get(`/bookings/${phone}`),
  getBookingDetails: (bookingId: string) => ApiService.get(`/booking/${bookingId}`),
  cancelBooking: (bookingId: string, reason?: string) => 
    ApiService.post(`/booking/${bookingId}/cancel`, { reason }),
  rescheduleBooking: (bookingId: string, newDate: string, newTime: string, reason?: string) =>
    ApiService.post(`/bookings/${bookingId}/reschedule`, { newDate, newTimeSlot: newTime, reason }),
  
  // OTP
  generateOtp: (phone: string) => ApiService.post('/otp/generate', { phone }),
  verifyOtp: (phone: string, otp: string) => ApiService.post('/otp/verify', { phone, otp }),
};

// ✅ NEW: Appointment API (SQL-migrated endpoints)
export const AppointmentApi = {
  getAppointments: (customerId: string) => ApiService.get(`/appointments/customer/${customerId}`),
  getAppointment: (appointmentId: string) => ApiService.get(`/appointment/${appointmentId}`),
  cancelAppointment: (appointmentId: string, reason?: string) => 
    ApiService.post(`/appointment/${appointmentId}/cancel`, { reason }),
  rescheduleAppointment: (appointmentId: string, newDate: string, newTime: string, reason?: string) =>
    ApiService.post(`/appointment/${appointmentId}/reschedule`, { newDate, newTimeSlot: newTime, reason }),
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

// ✅ NEW: Wallet API (Batch 14 SQL-migrated endpoints)
export const WalletApi = {
  getWallet: (customerId: string) => ApiService.get(`/customer/${customerId}/wallet`),
  getTopupOffers: (customerId: string) => ApiService.get(`/customer/${customerId}/wallet/topup-offers`),
  initiateTopup: (customerId: string, amount: number, bonusOffer?: any) => 
    ApiService.post(`/customer/${customerId}/wallet/topup/initiate`, { amount, bonusOffer }),
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

