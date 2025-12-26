import { projectId, publicAnonKey } from '../supabase/info';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = 'https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475';
const supabase = createClient(`https://${projectId}.supabase.co`, publicAnonKey);

interface ApiOptions {
  method?: string;
  body?: any;
  requiresAuth?: boolean;
}

export async function apiCall(endpoint: string, options: ApiOptions = {}) {
  const { method = 'GET', body, requiresAuth = true } = options;

  let headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (requiresAuth) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }
    headers['Authorization'] = `Bearer ${session.access_token}`;
  } else {
    headers['Authorization'] = `Bearer ${publicAnonKey}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API request failed');
  }

  return response.json();
}

// Region APIs
export const regionApi = {
  getAll: () => apiCall('/regions'),
  getById: (id: string) => apiCall(`/regions/${id}`),
  create: (data: any) => apiCall('/regions', { method: 'POST', body: data }),
  update: (id: string, data: any) => apiCall(`/regions/${id}`, { method: 'PUT', body: data }),
  delete: (id: string) => apiCall(`/regions/${id}`, { method: 'DELETE' }),
  getCatalog: (id: string) => apiCall(`/regions/${id}/catalog`),
  updateCatalog: (id: string, data: any) => apiCall(`/regions/${id}/catalog`, { method: 'POST', body: data }),
};

// Service Catalog APIs
export const catalogApi = {
  getServices: () => apiCall('/catalog/services'),
  getServiceById: (id: string) => apiCall(`/catalog/services/${id}`),
  createService: (data: any) => apiCall('/catalog/services', { method: 'POST', body: data }),
  updateService: (id: string, data: any) => apiCall(`/catalog/services/${id}`, { method: 'PUT', body: data }),
  deleteService: (id: string) => apiCall(`/catalog/services/${id}`, { method: 'DELETE' }),
  getCategories: () => apiCall('/catalog/categories'),
  createCategory: (data: any) => apiCall('/catalog/categories', { method: 'POST', body: data }),
};

// Booking APIs
export const bookingApi = {
  getById: (id: string) => apiCall(`/bookings/${id}`),
  generateOTP: (id: string, type: 'start' | 'complete') => 
    apiCall(`/bookings/${id}/otp/generate`, { method: 'POST', body: { type } }),
  verifyOTP: (id: string, otp: string, type: 'start' | 'complete') => 
    apiCall(`/bookings/${id}/otp/verify`, { method: 'POST', body: { otp, type } }),
  updateStatus: (id: string, status: string, note?: string) => 
    apiCall(`/bookings/${id}/status`, { method: 'POST', body: { status, note } }),
  getVendorBookings: (vendorId: string, status?: string) => {
    const query = status ? `?status=${status}` : '';
    return apiCall(`/bookings/vendor/${vendorId}${query}`);
  },
  getCustomerBookings: (customerId: string, status?: string) => {
    const query = status ? `?status=${status}` : '';
    return apiCall(`/bookings/customer/${customerId}${query}`);
  },
};

// Tracking APIs
export const trackingApi = {
  getActive: () => apiCall('/tracking/active'),
  getByBooking: (id: string) => apiCall(`/tracking/${id}`),
  updateLocation: (id: string, location: { lat: number; lng: number; accuracy: number; timestamp: string }) =>
    apiCall(`/tracking/${id}/update`, { method: 'POST', body: location }),
  getHistory: (id: string) => apiCall(`/tracking/${id}/history`),
};

// Search APIs
export const searchApi = {
  vendors: (params: any) => apiCall('/search/vendors', { method: 'POST', body: params }),
  nearby: (params: any) => apiCall('/search/vendors/nearby', { method: 'POST', body: params }),
  topRated: (limit?: number, serviceType?: string) => {
    const query = new URLSearchParams();
    if (limit) query.append('limit', limit.toString());
    if (serviceType) query.append('serviceType', serviceType);
    return apiCall(`/search/vendors/top-rated?${query.toString()}`);
  },
  categories: () => apiCall('/search/categories'),
};

// Analytics APIs
export const analyticsApi = {
  vendorDashboard: (vendorId: string) => apiCall(`/analytics/vendor/${vendorId}/dashboard`),
  customerDashboard: (customerId: string) => apiCall(`/analytics/customer/${customerId}/dashboard`),
  platformStats: () => apiCall('/analytics/admin/platform'),
  vendorRevenue: (vendorId: string, period?: string) => {
    const query = period ? `?period=${period}` : '';
    return apiCall(`/analytics/vendor/${vendorId}/revenue${query}`);
  },
};

// Pet APIs
export const petApi = {
  create: (data: any) => apiCall('/pets/create', { method: 'POST', body: data }),
  getById: (id: string) => apiCall(`/pets/${id}`),
  getCustomerPets: (customerId: string) => apiCall(`/pets/customer/${customerId}`),
  update: (id: string, data: any) => apiCall(`/pets/${id}`, { method: 'PUT', body: data }),
  delete: (id: string) => apiCall(`/pets/${id}`, { method: 'DELETE' }),
  addMedicalRecord: (id: string, data: any) => 
    apiCall(`/pets/${id}/medical-record`, { method: 'POST', body: data }),
  addVaccination: (id: string, data: any) => 
    apiCall(`/pets/${id}/vaccination`, { method: 'POST', body: data }),
};

// Payment APIs
export const paymentApi = {
  process: (data: any) => apiCall('/payments/process', { method: 'POST', body: data }),
  getById: (id: string) => apiCall(`/payments/${id}`),
  refund: (id: string, amount: number, reason: string, refundedBy: string) =>
    apiCall(`/payments/${id}/refund`, { method: 'POST', body: { amount, reason, refundedBy } }),
  getCustomerHistory: (customerId: string) => apiCall(`/payments/customer/${customerId}`),
  getVendorHistory: (vendorId: string) => apiCall(`/payments/vendor/${vendorId}`),
  getVendorEarnings: (vendorId: string) => apiCall(`/payments/vendor/${vendorId}/earnings`),
};

// Review APIs
export const reviewApi = {
  create: (data: any) => apiCall('/reviews/create', { method: 'POST', body: data }),
  getById: (id: string) => apiCall(`/reviews/${id}`),
  getVendorReviews: (vendorId: string, status?: string, limit?: number) => {
    const query = new URLSearchParams();
    if (status) query.append('status', status);
    if (limit) query.append('limit', limit.toString());
    return apiCall(`/reviews/vendor/${vendorId}?${query.toString()}`);
  },
  getVendorSummary: (vendorId: string) => apiCall(`/reviews/vendor/${vendorId}/summary`),
  respond: (id: string, vendorId: string, response: string) =>
    apiCall(`/reviews/${id}/respond`, { method: 'POST', body: { vendorId, response } }),
};

// ✅ NEW: Transaction Monitoring API (SQL-migrated endpoints - Admin)
export const transactionMonitoringApi = {
  getStats: (range?: string) => 
    apiCall(`/admin/transactions/stats${range ? `?range=${range}` : ''}`, { requiresAuth: true }),
  getTransactions: (params?: { page?: number; perPage?: number; status?: string; range?: string }) => {
    const query = params ? new URLSearchParams(Object.entries(params).map(([k,v]) => [k, String(v)])).toString() : '';
    return apiCall(`/admin/transactions${query ? `?${query}` : ''}`, { requiresAuth: true });
  },
  exportTransactions: (params?: any) => apiCall('/admin/transactions/export', { method: 'GET', requiresAuth: true }),
  retryTransaction: (txnId: string) => apiCall(`/admin/transactions/${txnId}/retry`, { method: 'POST', requiresAuth: true }),
  getReconciliation: (params?: any) => apiCall('/admin/transactions/reconciliation', { requiresAuth: true }),
  getFraudDetection: (params?: any) => apiCall('/admin/transactions/fraud-detection', { requiresAuth: true }),
};

// ✅ NEW: Profile Photo API (SQL-migrated endpoints)
export const profilePhotoApi = {
  uploadCustomerPhoto: async (customerId: string, photoFile: File) => {
    const formData = new FormData();
    formData.append('photo', photoFile);
    // Note: FormData requires different handling - may need special apiCall variant
    const response = await fetch(`${BASE_URL}/customer/${customerId}/profile-photo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`, // Will be replaced with session token if auth needed
      },
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }
    return response.json();
  },
  deleteCustomerPhoto: (customerId: string) => 
    apiCall(`/customer/${customerId}/profile-photo`, { method: 'DELETE' }),
  uploadPetPhoto: async (petId: string, photoFile: File) => {
    const formData = new FormData();
    formData.append('photo', photoFile);
    const response = await fetch(`${BASE_URL}/pet/${petId}/profile-photo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }
    return response.json();
  },
  deletePetPhoto: (petId: string) => 
    apiCall(`/pet/${petId}/profile-photo`, { method: 'DELETE' }),
};

// ✅ NEW: Appointment API (SQL-migrated endpoints)
export const appointmentApi = {
  getAppointments: (customerId: string) => apiCall(`/appointments/customer/${customerId}`),
  getAppointment: (appointmentId: string) => apiCall(`/appointment/${appointmentId}`),
  cancelAppointment: (appointmentId: string, reason?: string) => 
    apiCall(`/appointment/${appointmentId}/cancel`, { method: 'POST', body: { reason } }),
  rescheduleAppointment: (appointmentId: string, newDate: string, newTime: string, reason?: string) =>
    apiCall(`/appointment/${appointmentId}/reschedule`, { method: 'POST', body: { newDate, newTimeSlot: newTime, reason } }),
};

// ✅ NEW: Booking OTP API (SQL-migrated endpoints)
export const bookingOtpApi = {
  generateOtp: (bookingId: string, sessionNumber?: number, action?: 'start' | 'end') => 
    apiCall(`/bookings/${bookingId}/generate-otp`, { method: 'POST', body: { sessionNumber: sessionNumber || 1, action: action || 'start' } }),
  verifyOtp: (bookingId: string, otp: string, sessionNumber?: number, action?: 'start' | 'end') => 
    apiCall(`/bookings/${bookingId}/verify-otp`, { method: 'POST', body: { otp, sessionNumber: sessionNumber || 1, action: action || 'start' } }),
};

// ✅ NEW: Rescheduling API (SQL-migrated endpoints)
export const reschedulingApi = {
  getPolicy: (serviceType: string) => apiCall(`/booking/rescheduling-policy/${serviceType}`),
  updatePolicy: (serviceType: string, policy: any) => 
    apiCall(`/booking/rescheduling-policy/${serviceType}`, { method: 'PUT', body: policy }),
  getRescheduleOptions: (bookingId: string) => apiCall(`/booking/${bookingId}/reschedule-options`),
  requestReschedule: (bookingId: string, requestedDate: string, reason?: string) => 
    apiCall(`/booking/${bookingId}/reschedule`, { method: 'POST', body: { requestedDate, reason } }),
  confirmReschedule: (bookingId: string, rescheduleId: string) => 
    apiCall(`/booking/${bookingId}/reschedule/confirm`, { method: 'POST', body: { rescheduleId } }),
};

// ✅ NEW: Staff Discovery API (SQL-migrated endpoints)
export const staffDiscoveryApi = {
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
    return apiCall(`/customer/discover-staff?${query}`);
  },
  discoverStaffByVendor: (vendorId: string) => 
    apiCall(`/customer/discover-staff-by-vendor?vendorId=${vendorId}`),
};

// ✅ NEW: System Health API (Batch 14 SQL-migrated endpoints)
export const systemHealthApi = {
  getFullHealth: () => apiCall('/health/full', { requiresAuth: false }),
  getQuickHealth: () => apiCall('/health/quick', { requiresAuth: false }),
  getMetrics: () => apiCall('/health/metrics', { requiresAuth: false }),
  getEndpoints: () => apiCall('/health/endpoints', { requiresAuth: false }),
};

// ✅ NEW: Wallet API (Batch 14 SQL-migrated endpoints)
export const walletApi = {
  getWallet: (customerId: string) => apiCall(`/customer/${customerId}/wallet`),
  getTopupOffers: (customerId: string) => apiCall(`/customer/${customerId}/wallet/topup-offers`),
  initiateTopup: (customerId: string, amount: number, bonusOffer?: any) => 
    apiCall(`/customer/${customerId}/wallet/topup/initiate`, { method: 'POST', body: { amount, bonusOffer } }),
  verifyTopup: (customerId: string, paymentId: string, orderId: string, signature: string) => 
    apiCall(`/customer/${customerId}/wallet/topup/verify`, { method: 'POST', body: { paymentId, orderId, signature } }),
  getTransactions: (customerId: string, params?: { limit?: number; offset?: number; type?: string }) => {
    const query = params ? new URLSearchParams(Object.entries(params).map(([k,v]) => [k, String(v)])).toString() : '';
    return apiCall(`/customer/${customerId}/wallet/transactions${query ? `?${query}` : ''}`);
  },
};

// ✅ NEW: GPS Tracking API (Batch 14 SQL-migrated endpoints)
export const gpsTrackingApi = {
  startTracking: (bookingId: string) => apiCall(`/bookings/${bookingId}/start-tracking`, { method: 'POST' }),
  stopTracking: (bookingId: string) => apiCall(`/bookings/${bookingId}/stop-tracking`, { method: 'POST' }),
  updateLocation: (bookingId: string, location: any, sessionNumber?: number) => 
    apiCall(`/bookings/${bookingId}/update-location`, { method: 'POST', body: { location, sessionNumber } }),
  getLiveLocation: (bookingId: string) => apiCall(`/bookings/${bookingId}/live-location`),
  getRoute: (bookingId: string) => apiCall(`/bookings/${bookingId}/route`),
};

// ✅ NEW: Nutritionist API (Batch 14 SQL-migrated endpoints)
export const nutritionistApi = {
  getMenu: (nutritionistId: string) => apiCall(`/nutritionist/${nutritionistId}/menu`),
  addMealItem: (nutritionistId: string, mealData: any) => 
    apiCall('/nutritionist/meals/item', { method: 'POST', body: { nutritionistId, ...mealData } }),
  placeOrder: (orderData: any) => apiCall('/nutritionist/meals/order', { method: 'POST', body: orderData }),
  assignDelivery: (orderId: string, deliveryPartnerId: string) => 
    apiCall(`/nutritionist/orders/${orderId}/assign-delivery`, { method: 'POST', body: { deliveryPartnerId } }),
  trackOrder: (orderId: string) => apiCall(`/nutritionist/orders/${orderId}/track`),
  updateOrderStatus: (orderId: string, status: string) => 
    apiCall(`/nutritionist/orders/${orderId}/status`, { method: 'PUT', body: { status } }),
};

// ✅ NEW: Previous Providers API (Batch 8 SQL-migrated endpoints)
export const previousProvidersApi = {
  getPreviousProviders: (customerId: string, serviceType?: string) => {
    const query = serviceType ? `?serviceType=${serviceType}` : '';
    return apiCall(`/home-services/providers/previous/${customerId}${query}`);
  },
  addFavorite: (customerId: string, providerId: string) => 
    apiCall('/home-services/providers/favorite', { method: 'POST', body: { customerId, providerId } }),
  removeFavorite: (customerId: string, providerId: string) => 
    apiCall(`/home-services/providers/favorite/${customerId}/${providerId}`, { method: 'DELETE' }),
  getServiceHistory: (customerId: string) => 
    apiCall(`/home-services/providers/previous/${customerId}/history`),
};

// ✅ NEW: Nutritionist Diet Plans API (Batch 8 SQL-migrated endpoints)
export const nutritionistDietPlanApi = {
  createDietPlan: (planData: any) => apiCall('/nutritionist/diet-plan/create', { method: 'POST', body: planData }),
  getDietPlansByCustomer: (customerId: string) => 
    apiCall(`/nutritionist/customer/${customerId}/diet-plans`),
  getDietPlan: (planId: string) => apiCall(`/nutritionist/diet-plan/${planId}`),
  updateDietPlan: (planId: string, updates: any) => 
    apiCall(`/nutritionist/diet-plan/${planId}`, { method: 'PUT', body: updates }),
};

// ✅ NEW: Medical History API (Batch 8 SQL-migrated endpoints)
export const medicalHistoryApi = {
  getMedicalRecords: (appointmentId: string, userId?: string, userRole?: string) => {
    const headers: Record<string, string> = {};
    if (userId) headers['X-User-Id'] = userId;
    if (userRole) headers['X-User-Role'] = userRole;
    return apiCall(`/appointments/${appointmentId}/medical-records`, { headers });
  },
  uploadDocument: (appointmentId: string, fileData: any, userId?: string, userRole?: string) => {
    const headers: Record<string, string> = {};
    if (userId) headers['X-User-Id'] = userId;
    if (userRole) headers['X-User-Role'] = userRole;
    return apiCall(`/appointments/${appointmentId}/medical-records/upload`, { method: 'POST', body: fileData, headers });
  },
  addVetSummary: (appointmentId: string, summary: any, userId?: string, userRole?: string) => {
    const headers: Record<string, string> = {};
    if (userId) headers['X-User-Id'] = userId;
    if (userRole) headers['X-User-Role'] = userRole;
    return apiCall(`/appointments/${appointmentId}/vet-summary`, { method: 'POST', body: summary, headers });
  },
  getPrescriptions: (appointmentId: string) => apiCall(`/appointments/${appointmentId}/prescriptions`),
};

// ✅ NEW: Integrated Services API (Batch 16 SQL-migrated endpoints)
export const integratedServicesApi = {
  getAvailableServices: (bookingId?: string, serviceType?: string, location?: { lat: number; lng: number }) => {
    const params = new URLSearchParams();
    if (bookingId) params.append('bookingId', bookingId);
    if (serviceType) params.append('serviceType', serviceType);
    if (location) {
      params.append('lat', location.lat.toString());
      params.append('lng', location.lng.toString());
    }
    return apiCall(`/integrated-services/available?${params}`);
  },
  getVendors: (type: string, lat?: number, lng?: number, radius?: number) => {
    const params = new URLSearchParams({ type });
    if (lat) params.append('lat', lat.toString());
    if (lng) params.append('lng', lng.toString());
    if (radius) params.append('radius', radius.toString());
    return apiCall(`/integrated-services/vendors?${params}`);
  },
  selectService: (bookingId: string, serviceType: string, vendorId: string) => 
    apiCall('/integrated-services/select', { method: 'POST', body: { bookingId, serviceType, vendorId } }),
  getBookingServices: (bookingId: string) => apiCall(`/integrated-services/booking/${bookingId}`),
  updateServiceStatus: (serviceId: string, status: string) => 
    apiCall(`/integrated-services/${serviceId}/status`, { method: 'PUT', body: { status } }),
};

// ✅ NEW: Advanced Search API (Batch 16 SQL-migrated endpoints)
export const advancedSearchApi = {
  universalSearch: (query: string, type?: string, limit?: number) => 
    apiCall('/advanced-search/universal', { method: 'POST', body: { query, type, limit: limit || 20 } }),
  vendorSearch: (query: string, location?: { lat: number; lng: number }, radius?: number) => 
    apiCall('/advanced-search/vendors', { method: 'POST', body: { query, location, radius } }),
};

// ✅ NEW: Vendor Analytics API (Batch 16 SQL-migrated endpoints)
export const vendorAnalyticsApi = {
  getAnalytics: (vendorId: string, period?: 'day' | 'week' | 'month' | 'year' | 'all') => {
    const query = period ? `?period=${period}` : '';
    return apiCall(`/vendor/${vendorId}/analytics${query}`);
  },
};

// ✅ NEW: Search Analytics API (Batch 16 SQL-migrated endpoints)
export const searchAnalyticsApi = {
  trackQuery: (query: string, userId: string, results: { count: number }) => 
    apiCall('/search/analytics/track', { method: 'POST', body: { query, userId, results } }),
  trackClick: (eventId: string, clicked: string, timeToClick?: number) => 
    apiCall('/search/analytics/click', { method: 'POST', body: { eventId, clicked, timeToClick } }),
  trackConversion: (eventId: string, conversionType: string, value?: number) => 
    apiCall('/search/analytics/convert', { method: 'POST', body: { eventId, conversionType, value } }),
  getPopular: (limit?: number, days?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (days) params.append('days', days.toString());
    return apiCall(`/search/analytics/popular?${params}`);
  },
};

// ✅ NEW: Health Problems API (Batch 16 SQL-migrated endpoints)
export const healthProblemsApi = {
  getAll: (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return apiCall(`/health-problems${query}`);
  },
  getById: (id: string) => apiCall(`/health-problems/${id}`),
  create: (data: { name: string; displayName: string; icon?: string }) => 
    apiCall('/admin/health-problems', { method: 'POST', body: data }),
  update: (id: string, data: any) => apiCall(`/admin/health-problems/${id}`, { method: 'PUT', body: data }),
  delete: (id: string) => apiCall(`/admin/health-problems/${id}`, { method: 'DELETE' }),
};

// ✅ NEW: Elasticsearch Proxy API (Batch 16 SQL-migrated endpoints)
export const elasticsearchProxyApi = {
  search: (query: string, type?: string) => {
    const params = new URLSearchParams({ q: query });
    if (type) params.append('type', type);
    return apiCall(`/search/elastic?${params}`);
  },
  autocomplete: (query: string) => apiCall(`/search/autocomplete?q=${query}`),
  reindex: () => apiCall('/search/index', { method: 'POST' }),
};

// ✅ NEW: Bank Verification API (Batch 16 SQL-migrated endpoints)
export const bankVerificationApi = {
  verifyRazorpay: (vendorId: string, accountNumber: string, ifscCode: string, accountHolderName: string) => 
    apiCall('/payment/bank-account/verify-razorpay', { method: 'POST', body: { vendorId, accountNumber, ifscCode, accountHolderName } }),
  getVerificationStatus: (accountId: string) => apiCall(`/payment/bank-account/verification-status/${accountId}`),
  pennyDrop: (vendorId: string, accountNumber: string, ifscCode: string) => 
    apiCall('/payment/bank-account/penny-drop', { method: 'POST', body: { vendorId, accountNumber, ifscCode } }),
  getVendorBankAccount: (vendorId: string) => apiCall(`/payment/bank-account/${vendorId}`),
};
