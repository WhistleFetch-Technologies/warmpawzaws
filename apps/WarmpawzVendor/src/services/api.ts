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
