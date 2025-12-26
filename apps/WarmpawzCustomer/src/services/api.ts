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

