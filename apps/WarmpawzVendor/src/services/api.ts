/**
 * API Service Layer
 * Centralized API calls for Vendor App
 * Identical endpoints to web app
 */

import { API_BASE_URL, publicAnonKey } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_TOKEN_KEY = 'warmpawz_vendor_session_token';

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

// Vendor-specific API methods
export const VendorApi = {
  // Onboarding
  submitApplication: (applicationData: any) => ApiService.post('/vendor/apply', applicationData),
  checkPhone: (phone: string) => ApiService.get(`/vendor/check-phone/${phone}`),
  getRoleConfig: (roleId: string) => ApiService.get(`/config/roles/${roleId}`),
  
  // Profile
  getProfile: (vendorId: string) => ApiService.get(`/vendor/${vendorId}`),
  updateProfile: (vendorId: string, data: any) => ApiService.put(`/vendor/${vendorId}`, data),
  
  // Services
  getServiceCatalog: () => ApiService.get('/admin/service-catalog'),
  publishServices: (vendorId: string, services: any) => 
    ApiService.post(`/vendor/${vendorId}/services/publish`, services),
  getVendorServices: (vendorId: string, serviceStyle?: string) => {
    const query = serviceStyle ? `?serviceStyle=${serviceStyle}` : '';
    return ApiService.get(`/vendor/${vendorId}/services${query}`);
  },
  
  // Bookings
  getBookings: (vendorId: string) => ApiService.get(`/vendor/${vendorId}/bookings`),
  acceptBooking: (bookingId: string, vendorId: string) => 
    ApiService.post(`/bookings/${bookingId}/accept`, { vendorId }),
  rejectBooking: (bookingId: string, vendorId: string, reason?: string) => 
    ApiService.post(`/bookings/${bookingId}/reject`, { vendorId, reason }),
  
  // Staff
  getStaff: (vendorId: string) => ApiService.get(`/vendor/${vendorId}/staff`),
  addStaff: (vendorId: string, staffData: any) => 
    ApiService.post(`/vendor/${vendorId}/staff`, staffData),
  updateStaff: (staffId: string, staffData: any) => 
    ApiService.put(`/staff/${staffId}`, staffData),
  deleteStaff: (staffId: string) => ApiService.delete(`/staff/${staffId}`),
  
  // OTP
  generateOtp: (phone: string) => ApiService.post('/otp/generate', { phone }),
  verifyOtp: (phone: string, otp: string) => ApiService.post('/otp/verify', { phone, otp }),
};

// ✅ NEW: Staff Schedule API (SQL-migrated endpoints)
export const StaffScheduleApi = {
  getBreaks: (staffId: string) => ApiService.get(`/staff/${staffId}/breaks`),
  createBreak: (staffId: string, breakData: any) => 
    ApiService.post(`/staff/${staffId}/breaks`, breakData),
  updateBreak: (staffId: string, breakId: string, breakData: any) => 
    ApiService.put(`/staff/${staffId}/breaks/${breakId}`, breakData),
  deleteBreak: (staffId: string, breakId: string) => 
    ApiService.delete(`/staff/${staffId}/breaks/${breakId}`),
  getPreferences: (staffId: string) => ApiService.get(`/staff/${staffId}/preferences`),
  updatePreferences: (staffId: string, preferences: any) => 
    ApiService.put(`/staff/${staffId}/preferences`, preferences),
  getHolidays: (staffId: string) => ApiService.get(`/staff/${staffId}/holidays`),
  createHoliday: (staffId: string, holidayData: any) => 
    ApiService.post(`/staff/${staffId}/holidays`, holidayData),
};

// ✅ NEW: Vendor Booking Actions API (Batch 9 SQL-migrated endpoints)
export const VendorBookingActionsApi = {
  completeBooking: (vendorId: string, bookingId: string) => 
    ApiService.post(`/vendor/${vendorId}/bookings/${bookingId}/complete`, {}),
  startSession: (vendorId: string, bookingId: string) => 
    ApiService.post(`/vendor/${vendorId}/bookings/${bookingId}/start-session`, {}),
  endSession: (vendorId: string, bookingId: string) => 
    ApiService.post(`/vendor/${vendorId}/bookings/${bookingId}/end-session`, {}),
};

// ✅ NEW: Appointment Detail API (Batch 9 SQL-migrated endpoints)
export const AppointmentDetailApi = {
  getBookingDetails: (bookingId: string) => 
    ApiService.get(`/vendor/bookings/${bookingId}/details`),
  uploadPrescription: (prescriptionData: any) => 
    ApiService.post('/vendor/prescription/upload', prescriptionData),
  getPrescription: (bookingId: string, actorId?: string) => {
    const query = actorId ? `?actor_id=${actorId}` : '';
    return ApiService.get(`/vendor/prescription/${bookingId}${query}`);
  },
  logActivity: (bookingId: string, type: string, description: string, actor: string, actorName: string) => 
    ApiService.post('/booking-activity/log', { bookingId, type, description, actor, actorName }),
};

// ✅ NEW: Call API (Batch 9 SQL-migrated endpoints)
export const CallApi = {
  initiateCall: (bookingId: string, callType: 'video' | 'voice', initiatedBy: string) => 
    ApiService.post('/call/initiate', { bookingId, callType, initiatedBy }),
  answerCall: (callId: string) => ApiService.post(`/call/${callId}/answer`, {}),
  endCall: (callId: string) => ApiService.post(`/call/${callId}/end`, {}),
  rejectCall: (callId: string) => ApiService.post(`/call/${callId}/reject`, {}),
  getCall: (callId: string) => ApiService.get(`/call/${callId}`),
  getCallHistory: (bookingId: string) => ApiService.get(`/call/booking/${bookingId}/history`),
  getVendorCallHistory: (vendorId: string) => ApiService.get(`/call/vendor/${vendorId}/history`),
};

// ✅ NEW: Slot Availability API (Batch 17 SQL-migrated endpoints)
export const SlotAvailabilityApi = {
  getVendorAvailability: (vendorId: string, date: string) => 
    ApiService.get(`/vendor/${vendorId}/availability/${date}`),
};

// ✅ NEW: Booking Validation API (Batch 17 SQL-migrated endpoints)
export const BookingValidationApi = {
  validateBooking: (data: { staffId: string; serviceId: string; serviceType: string; customerLocation?: any }) => 
    ApiService.post('/booking/validate', data),
  getBookingEligibility: (staffId: string) => 
    ApiService.get(`/staff/${staffId}/booking-eligibility`),
};

// ✅ NEW: Integrated Services Manager API (Batch 17 SQL-migrated endpoints)
export const IntegratedServicesManagerApi = {
  registerProvider: (providerData: any) => 
    ApiService.post('/integrated-services/register-provider', providerData),
  getAvailableProviders: (lat: number, lng: number, type?: string, maxDistance?: number) => {
    const params = new URLSearchParams({ lat: lat.toString(), lng: lng.toString() });
    if (type) params.append('type', type);
    if (maxDistance) params.append('maxDistance', maxDistance.toString());
    return ApiService.get(`/integrated-services/available?${params}`);
  },
};

// ✅ NEW: Logistics Routing Engine API (Batch 10 SQL-migrated endpoints)
export const LogisticsRoutingEngineApi = {
  routeOrder: (orderData: any) => 
    ApiService.post('/logistics/route-order', orderData),
  createShipment: (order: any, partnerId: string) => 
    ApiService.post('/logistics/create-shipment', { order, partnerId }),
  trackShipment: (trackingId: string) => 
    ApiService.get(`/logistics/track/${trackingId}`),
  getDeliveryRules: () => ApiService.get('/logistics/delivery-rules'),
  updateDeliveryRules: (rules: any) => 
    ApiService.post('/logistics/delivery-rules', rules),
};

// ✅ NEW: Analytics Events API (Batch 10 SQL-migrated endpoints)
export const AnalyticsEventsApi = {
  trackEvents: (events: any[]) => 
    ApiService.post('/analytics/track', { events }),
};

// ✅ NEW: Schedule Settings API (Batch 10 SQL-migrated endpoints - Admin)
export const ScheduleSettingsApi = {
  getScheduleSettings: () => ApiService.get('/admin/schedule-settings'),
  updateScheduleSettings: (settings: any) => 
    ApiService.post('/admin/schedule-settings', settings),
  getPublicScheduleSettings: () => ApiService.get('/schedule-settings/public'),
};

// ✅ NEW: Vendor Catalog API (Batch 10 SQL-migrated endpoints)
export const VendorCatalogApi = {
  getCatalogByRole: (roleId: string) => 
    ApiService.get(`/service-catalog/role/${roleId}`),
  getCatalogDebug: () => ApiService.get('/service-catalog/debug'),
  getCatalogRawDump: () => ApiService.get('/service-catalog/raw-dump'),
};

// ✅ NEW: Settlement Tier System API (Batch 11 SQL-migrated endpoints)
export const SettlementTierSystemApi = {
  getVendorTier: (vendorId: string) => 
    ApiService.get(`/vendor/${vendorId}/tier`),
  upgradeVendorTier: (vendorId: string, targetTierId: string) => 
    ApiService.post(`/vendor/${vendorId}/tier/upgrade`, { targetTierId }),
  processSettlement: (vendorId: string, amount: number) => 
    ApiService.post('/settlement/process', { vendorId, amount }),
  verifyBankAccount: (vendorId: string, accountDetails: any) => 
    ApiService.post('/bank-account/verify', { vendorId, accountDetails }),
};
