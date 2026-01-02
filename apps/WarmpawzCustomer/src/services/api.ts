/**
 * API Service Layer
 * Centralized API calls for Customer App
 * Identical endpoints to web app
 */

import { API_BASE_URL } from '../config/aws';

// Validate API Base URL is configured
if (!API_BASE_URL || API_BASE_URL.includes('api.warmpawz.com')) {
  console.warn('⚠️ API_BASE_URL is not properly configured. Please set AWS_API_GATEWAY_URL environment variable.');
}
import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_TOKEN_KEY = 'warmpawz_session_token';

export class ApiService {
  private static async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await AsyncStorage.getItem(SESSION_TOKEN_KEY);
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
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
  cancelBooking: (bookingId: string, reason?: string) => 
    ApiService.post(`/bookings/${bookingId}/cancel`, { reason }),
  rescheduleBooking: (bookingId: string, newDate: string, newTime: string, reason?: string) =>
    ApiService.post(`/bookings/${bookingId}/reschedule`, { newDate, newTimeSlot: newTime, reason }),
  
  // Orders (E-commerce)
  getOrders: async (identifier: string) => {
    // Support both phone and customerId
    const response = await ApiService.get(`/customer/${identifier}/orders`).catch(() =>
      ApiService.get(`/orders/customer/${identifier}`)
    );
    return response.orders || response;
  },
  getOrderDetails: (orderId: string) => ApiService.get(`/customer/shop/orders/${orderId}`),
  getOrderTracking: (orderId: string) => ApiService.get(`/customer/shop/orders/${orderId}/track`),
  cancelOrder: (orderId: string, reason?: string) => 
    ApiService.post(`/customer/shop/orders/${orderId}/cancel`, { reason }),
  
  // Support Tickets
  getSupportTickets: (phone: string) => ApiService.get(`/crm/tickets?customerPhone=${phone}`),
  createSupportTicket: (phone: string, ticketData: any) => 
    ApiService.post('/crm/tickets', { customerPhone: phone, ...ticketData }),
  
  // Pet Bookings
  getPetBookings: (phone: string, petId: string) => 
    ApiService.get(`/customer/bookings/pet/${phone}/${petId}`),
  
  // OTP
  generateOtp: (phone: string) => ApiService.post('/otp/generate', { phone }),
  verifyOtp: (phone: string, otp: string) => ApiService.post('/otp/verify', { phone, otp }),
  
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
  
  // Wishlist
  getWishlist: (customerId: string) => ApiService.get(`/customer/${customerId}/wishlist`),
  addToWishlist: (customerId: string, productId: string) => ApiService.post(`/customer/${customerId}/wishlist`, { productId }),
  removeFromWishlist: (wishlistItemId: string) => ApiService.delete(`/customer/wishlist/${wishlistItemId}`),
  
  // Order Operations
  getOrderInvoice: (orderId: string) => ApiService.get(`/orders/${orderId}/invoice`),
  reorder: (orderId: string, customerId: string) => 
    ApiService.post(`/customer/shop/orders/${orderId}/reorder`, { customerId }),
  
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

