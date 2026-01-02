/**
 * API Service Layer
 * Centralized API calls for Vendor App
 * Identical endpoints to web app
 */

import { API_BASE_URL } from '../config/aws';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_TOKEN_KEY = 'warmpawz_vendor_session_token';

export class ApiService {
  private static async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await AsyncStorage.getItem(SESSION_TOKEN_KEY);
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
  }

  static async get(endpoint: string) {
    try {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `Request failed with status ${response.status}`);
    }
    
    return response.json();
    } catch (error: any) {
      // Enhanced error handling with retry logic for network errors
      if (error.message?.includes('Network request failed')) {
        throw new Error('Network error. Please check your connection and try again.');
      }
      throw error;
    }
  }

  static async post(endpoint: string, data: any) {
    try {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `Request failed with status ${response.status}`);
    }
    
    return response.json();
    } catch (error: any) {
      if (error.message?.includes('Network request failed')) {
        throw new Error('Network error. Please check your connection and try again.');
      }
      throw error;
    }
  }

  static async put(endpoint: string, data: any) {
    try {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `Request failed with status ${response.status}`);
    }
    
    return response.json();
    } catch (error: any) {
      if (error.message?.includes('Network request failed')) {
        throw new Error('Network error. Please check your connection and try again.');
      }
      throw error;
    }
  }

  static async delete(endpoint: string) {
    try {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `Request failed with status ${response.status}`);
    }
    
    return response.json();
    } catch (error: any) {
      if (error.message?.includes('Network request failed')) {
        throw new Error('Network error. Please check your connection and try again.');
      }
      throw error;
    }
  }

  static async saveSessionToken(token: string): Promise<void> {
    try {
    await AsyncStorage.setItem(SESSION_TOKEN_KEY, token);
    } catch (error) {
      console.error('Error saving session token:', error);
  }
  }

  static async getSessionToken(): Promise<string | null> {
    try {
    return await AsyncStorage.getItem(SESSION_TOKEN_KEY);
    } catch (error) {
      console.error('Error getting session token:', error);
      return null;
    }
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
  getBookings: (vendorId: string) => ApiService.get(`/vendor/bookings/${vendorId}`), // ✅ Fixed: Changed from /vendor/:vendorId/bookings to /vendor/bookings/:vendorId
  acceptBooking: (bookingId: string, vendorId: string) => 
    ApiService.post(`/bookings/${bookingId}/accept`, { vendorId }),
  rejectBooking: (bookingId: string, vendorId: string, reason?: string) => 
    ApiService.post(`/bookings/${bookingId}/reject`, { vendorId, reason }),
  
  // Staff
  getStaff: (vendorId: string) => ApiService.get(`/staff/vendor/${vendorId}`), // ✅ Fixed: Changed from /vendor/:vendorId/staff to /staff/vendor/:vendorId
  addStaff: (vendorId: string, staffData: any) => 
    ApiService.post(`/staff/vendor/${vendorId}`, staffData), // ✅ Fixed: Changed from /vendor/:vendorId/staff to /staff/vendor/:vendorId
  updateStaff: (staffId: string, staffData: any) => 
    ApiService.put(`/staff/${staffId}`, staffData),
  deleteStaff: (staffId: string) => ApiService.delete(`/staff/${staffId}`),
  
  // Dashboard
  getDashboard: (vendorId: string, timeframe?: 'today' | 'week' | 'month') => {
    const query = timeframe ? `?timeframe=${timeframe}` : '';
    return ApiService.get(`/vendor/dashboard/${vendorId}${query}`);
  },
  
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
  deleteBreak: (staffId: string, breakId: string) => ApiService.delete(`/staff/${staffId}/breaks/${breakId}`),
  getPreferences: (staffId: string) => ApiService.get(`/staff/${staffId}/preferences`),
  updatePreferences: (staffId: string, preferences: any) => 
    ApiService.put(`/staff/${staffId}/preferences`, preferences),
  getHolidays: (staffId: string) => ApiService.get(`/staff/${staffId}/holidays`),
  createHoliday: (staffId: string, holidayData: any) => 
    ApiService.post(`/staff/${staffId}/holidays`, holidayData),
};

// ✅ NEW: Vendor Booking Actions API (Batch 9 SQL-migrated endpoints)
// ✅ MIGRATED: Removed Supabase path, using API Gateway directly
export const VendorBookingActionsApi = {
  completeBooking: (vendorId: string, bookingId: string, otp?: string) => 
    ApiService.post(`/vendor/bookings/${bookingId}/complete`, { vendorId, otp }),
  startSession: (vendorId: string, bookingId: string) => 
    ApiService.post(`/vendor/${vendorId}/bookings/${bookingId}/start-session`, {}),
  endSession: (vendorId: string, bookingId: string) => 
    ApiService.post(`/vendor/${vendorId}/bookings/${bookingId}/end-session`, {}),
};

// ✅ NEW: Staff API (Staff-specific endpoints)
// ✅ MIGRATED: Removed Supabase path, using API Gateway directly
export const StaffApi = {
  // Staff Appointments
  getAppointments: (staffId: string, status?: string) => {
    const query = status ? `?status=${status}` : '';
    return ApiService.get(`/staff/${staffId}/appointments${query}`);
  },
  getActiveBookings: (staffId: string) => 
    ApiService.get(`/staff/${staffId}/bookings/active`),
  getSchedule: (staffId: string, date?: string) => {
    const query = date ? `?date=${date}` : '';
    return ApiService.get(`/staff/${staffId}/schedule${query}`);
  },
  
  // Staff Earnings
  getEarnings: (staffId: string, period?: 'day' | 'week' | 'month' | 'year') => {
    const query = period ? `?period=${period}` : '';
    return ApiService.get(`/staff/${staffId}/earnings${query}`);
  },
  
  // Staff Analytics
  getAnalytics: (staffId: string, period?: 'day' | 'week' | 'month' | 'year') => {
    const query = period ? `?period=${period}` : '';
    return ApiService.get(`/staff/${staffId}/analytics${query}`);
  },
  
  // Staff Assignment Actions
  acceptAssignment: (staffId: string, bookingId: string) => 
    ApiService.post(`/automation/staff/accept`, { staffId, bookingId }),
  rejectAssignment: (staffId: string, bookingId: string, reason?: string) => 
    ApiService.post(`/automation/staff/reject`, { staffId, bookingId, reason }),
};

// ✅ NEW: Booking Actions API (Batch 1)
// ✅ MIGRATED: Removed Supabase path, using API Gateway directly
export const BookingActionsApi = {
  startService: (bookingId: string, staffId?: string, otp?: string) => 
    ApiService.post(`/bookings/${bookingId}/start-service`, { staffId, otp }),
  startSession: (bookingId: string, staffId?: string, otp?: string) => 
    ApiService.post(`/bookings/${bookingId}/start-session`, { staffId, otp }),
  endSession: (bookingId: string, staffId?: string) => 
    ApiService.post(`/bookings/${bookingId}/end-session`, { staffId }),
  checkIn: (bookingId: string, staffId?: string, notes?: string, petCondition?: string) => 
    ApiService.post(`/bookings/${bookingId}/check-in`, { staffId, notes, petCondition }),
};

// ✅ NEW: Appointment Detail API (Batch 1)
// ✅ MIGRATED: Removed Supabase path, using API Gateway directly
export const AppointmentDetailApi = {
  getBookingDetails: (bookingId: string) => 
    ApiService.get(`/bookings/${bookingId}`),
  uploadPrescription: (data: any) => {
    const formData = new FormData();
    if (data.file) {
      formData.append('file', {
        uri: data.file,
        type: 'image/jpeg',
        name: data.fileName || 'prescription.jpg',
      } as any);
    }
    formData.append('bookingId', data.bookingId);
    formData.append('vendorId', data.vendorId);
    if (data.uploadType) {
      formData.append('uploadType', data.uploadType);
    }
    return ApiService.post(`/files/upload`, formData);
  },
  getPrescription: (bookingId: string) => 
    ApiService.get(`/bookings/${bookingId}/prescription`),
  logActivity: (bookingId: string, activity: any) => 
    ApiService.post(`/bookings/${bookingId}/activity`, activity),
};

// ✅ NEW: Call API (Batch 2)
export const CallApi = {
  initiateCall: (bookingId: string, callType: 'audio' | 'video', vendorId: string) => 
    ApiService.post(`/call/initiate`, { bookingId, callType, vendorId }),
  answerCall: (callId: string) => 
    ApiService.post(`/call/${callId}/answer`, {}),
  endCall: (callId: string) => 
    ApiService.post(`/call/${callId}/end`, {}),
  rejectCall: (callId: string) => 
    ApiService.post(`/call/${callId}/reject`, {}),
  getCall: (callId: string) => 
    ApiService.get(`/call/${callId}`),
  getCallHistory: (vendorId: string) => 
    ApiService.get(`/call/history/${vendorId}`),
};

// ✅ NEW: Slot Availability API (Batch 1)
export const SlotAvailabilityApi = {
  getAvailableSlots: (vendorId: string, serviceId: string, date: string) => 
    ApiService.get(`/slots/available?vendorId=${vendorId}&serviceId=${serviceId}&date=${date}`),
  checkAvailability: (vendorId: string, serviceId: string, date: string, time: string) => 
    ApiService.get(`/slots/check?vendorId=${vendorId}&serviceId=${serviceId}&date=${date}&time=${time}`),
};

// ✅ NEW: Booking Validation API (Batch 1)
export const BookingValidationApi = {
  validateBooking: (bookingData: any) => 
    ApiService.post(`/bookings/validate`, bookingData),
};

// ✅ NEW: Integrated Services API (Batch 1)
export const IntegratedServicesApi = {
  getIntegratedServices: (vendorId: string) => 
    ApiService.get(`/vendor/${vendorId}/integrated-services`),
};

// ✅ NEW: Logistics Routing API (Batch 1)
export const LogisticsRoutingApi = {
  optimizeRoute: (vendorId: string, bookingIds: string[]) => 
    ApiService.post(`/logistics/optimize-route`, { vendorId, bookingIds }),
  getRoute: (routeId: string) => 
    ApiService.get(`/logistics/route/${routeId}`),
};

// ✅ NEW: Analytics Events API (Batch 1)
export const AnalyticsEventsApi = {
  trackEvent: (event: string, data: any) => 
    ApiService.post(`/analytics/events`, { event, data }),
};

// ✅ NEW: Schedule Settings API (Batch 1)
export const ScheduleSettingsApi = {
  getScheduleSettings: (vendorId: string) => 
    ApiService.get(`/vendor/${vendorId}/schedule-settings`),
  updateScheduleSettings: (vendorId: string, settings: any) => 
    ApiService.put(`/vendor/${vendorId}/schedule-settings`, settings),
};

// ✅ NEW: Vendor Catalog API (Batch 1)
export const VendorCatalogApi = {
  getCatalog: (vendorId: string) => 
    ApiService.get(`/vendor/${vendorId}/catalog`),
  updateCatalog: (vendorId: string, catalog: any) => 
    ApiService.put(`/vendor/${vendorId}/catalog`, catalog),
};

// ✅ NEW: Chat API (Batch 2)
export const ChatApi = {
  getMessages: (bookingId: string, vendorId: string) => 
    ApiService.get(`/chat/booking/${bookingId}/messages?vendorId=${vendorId}`),
  sendMessage: (bookingId: string, vendorId: string, customerId: string, message: string) => 
    ApiService.post(`/chat/booking/${bookingId}/message`, { message, senderId: vendorId, senderType: 'vendor', customerId }),
  markAsRead: (bookingId: string, userId: string) => 
    ApiService.post(`/chat/booking/${bookingId}/read`, { userId }),
};

// ✅ NEW: Notification API (Batch 2)
export const NotificationApi = {
  getNotifications: (vendorId: string) => 
    ApiService.get(`/vendor/${vendorId}/notifications`),
  markAsRead: (notificationId: string) => 
    ApiService.post(`/notifications/${notificationId}/read`, {}),
  markAllAsRead: (vendorId: string) => 
    ApiService.post(`/vendor/${vendorId}/notifications/read-all`, {}),
};

// ✅ NEW: Emergency API (Batch 2)
export const EmergencyApi = {
  reportEmergency: (vendorId: string, emergencyData: any) => 
    ApiService.post(`/emergency/report`, { vendorId, ...emergencyData }),
};

// ✅ NEW: Location Sharing API (Batch 2)
export const LocationSharingApi = {
  shareLocation: (bookingId: string, location: any) => 
    ApiService.post(`/location/share`, { bookingId, location }),
  startSharing: (bookingId: string, vendorId: string, customerId: string, location: { latitude: number; longitude: number }) => 
    ApiService.post(`/location/start-sharing`, { bookingId, vendorId, customerId, location }),
  updateLocation: (bookingId: string, location: { latitude: number; longitude: number }) => 
    ApiService.post(`/location/update`, { bookingId, location }),
  stopSharing: (bookingId: string) => 
    ApiService.post(`/location/stop-sharing`, { bookingId }),
};

// ✅ NEW: Route Optimization API (Batch 2)
export const RouteOptimizationApi = {
  optimizeRoute: (vendorId: string, bookingIds: string[]) => 
    ApiService.post(`/route/optimize`, { vendorId, bookingIds }),
  getOptimizedRoute: (routeId: string) => 
    ApiService.get(`/route/${routeId}`),
};

// ✅ NEW: Real-time Updates API (Batch 2)
export const RealTimeUpdatesApi = {
  getUpdates: (vendorId: string) => 
    ApiService.get(`/vendor/${vendorId}/updates`),
  connectStream: (vendorId: string) => {
    // WebSocket connection - returns WebSocket URL
    // ✅ MIGRATED: Using API Gateway WebSocket endpoint (if configured)
    // For HTTP-based real-time, use polling or SSE instead
    const wsBaseUrl = process.env.WS_BASE_URL || 'wss://api.warmpawz.com';
    return `${wsBaseUrl}/ws/updates/${vendorId}`;
  },
};

// ✅ NEW: Connection Status API (Batch 2)
export const ConnectionStatusApi = {
  checkConnection: () => 
    ApiService.get(`/health/check`),
};

// ✅ NEW: Offline Mode API (Batch 2)
export const OfflineModeApi = {
  syncPendingActions: (vendorId: string) => 
    ApiService.post(`/offline/sync`, { vendorId }),
  getPendingActions: (vendorId: string) => 
    ApiService.get(`/offline/pending/${vendorId}`),
  clearPendingActions: (vendorId: string) => 
    ApiService.post(`/offline/clear`, { vendorId }),
};

// ✅ NEW: Earnings API (Batch 3)
export const EarningsApi = {
  getEarnings: (vendorId: string, period?: 'day' | 'week' | 'month' | 'year' | 'lifetime') => {
    const query = period ? `?period=${period}` : '';
    return ApiService.get(`/vendor/${vendorId}/earnings${query}`);
  },
  getEarningsSummary: (vendorId: string) => 
    ApiService.get(`/vendor/${vendorId}/earnings/summary`),
};

// ✅ NEW: Payouts API (Batch 3)
export const PayoutsApi = {
  getPayouts: (vendorId: string) => 
    ApiService.get(`/vendor/${vendorId}/payouts`),
  getPayoutDetails: (payoutId: string) => 
    ApiService.get(`/payouts/${payoutId}`),
  requestPayout: (vendorId: string, amount: number) => 
    ApiService.post(`/vendor/${vendorId}/payouts/request`, { amount }),
};

// ✅ NEW: Commission API (Batch 3)
export const CommissionApi = {
  getCommissionBreakdown: (vendorId: string, period?: 'day' | 'week' | 'month' | 'year') => {
    const query = period ? `?period=${period}` : '';
    return ApiService.get(`/vendor/${vendorId}/commission${query}`);
  },
};

// ✅ NEW: Reports API (Batch 3)
export const ReportsApi = {
  getReports: (vendorId: string) => 
    ApiService.get(`/vendor/${vendorId}/reports`),
  generateReport: (vendorId: string, reportType: string, period: string) => 
    ApiService.post(`/vendor/${vendorId}/reports/generate`, { reportType, period }),
};

// ✅ NEW: Data Export API (Batch 3)
export const DataExportApi = {
  exportData: (vendorId: string, format: 'csv' | 'pdf' | 'excel', dataType: string) => 
    ApiService.post(`/vendor/${vendorId}/export`, { format, dataType }),
};

// ✅ NEW: Performance Metrics API (Batch 3)
export const PerformanceMetricsApi = {
  getMetrics: (vendorId: string, period?: 'day' | 'week' | 'month' | 'year') => {
    const query = period ? `?period=${period}` : '';
    return ApiService.get(`/vendor/${vendorId}/performance${query}`);
  },
};

// ✅ NEW: Revenue Analytics API (Batch 3)
export const RevenueAnalyticsApi = {
  getAnalytics: (vendorId: string, period?: 'day' | 'week' | 'month' | 'year') => {
    const query = period ? `?period=${period}` : '';
    return ApiService.get(`/vendor/${vendorId}/revenue${query}`);
  },
};

// ✅ NEW: Transaction History API (Batch 3)
export const TransactionHistoryApi = {
  getHistory: (vendorId: string, period?: 'day' | 'week' | 'month' | 'year') => {
    const query = period ? `?period=${period}` : '';
    return ApiService.get(`/vendor/${vendorId}/transactions${query}`);
  },
  getTransactions: (vendorId: string, filter?: 'all' | 'earnings' | 'payouts' | 'refunds') => {
    const query = filter ? `?filter=${filter}` : '';
    return ApiService.get(`/vendor/${vendorId}/transactions${query}`);
  },
};

// Alias for backward compatibility
export const TransactionApi = TransactionHistoryApi;

// ✅ NEW: Financial Summary API (Batch 3)
export const FinancialSummaryApi = {
  getSummary: (vendorId: string) => 
    ApiService.get(`/vendor/${vendorId}/financial/summary`),
};

// Alias for backward compatibility
export const FinancialApi = FinancialSummaryApi;

// ✅ NEW: Tax Documents API (Batch 3)
export const TaxDocumentsApi = {
  getDocuments: (vendorId: string) => 
    ApiService.get(`/vendor/${vendorId}/tax-documents`),
  downloadDocument: (documentId: string) => 
    ApiService.get(`/tax-documents/${documentId}/download`),
  generateDocument: (vendorId: string, type: string, year: number) => 
    ApiService.post(`/vendor/${vendorId}/tax-documents/generate`, { type, year }),
};

// Alias for backward compatibility
export const TaxApi = TaxDocumentsApi;

// ✅ NEW: Settings API (Batch 4)
export const SettingsApi = {
  getSettings: (vendorId: string) => 
    ApiService.get(`/vendor/${vendorId}/settings`),
  updateSettings: (vendorId: string, settings: any) => 
    ApiService.put(`/vendor/${vendorId}/settings`, settings),
};

// ✅ NEW: Profile API (Batch 4)
export const ProfileApi = {
  getProfile: (vendorId: string) => 
    ApiService.get(`/vendor/${vendorId}/profile`),
  updateProfile: (vendorId: string, profile: any) => 
    ApiService.put(`/vendor/${vendorId}/profile`, profile),
};

// ✅ NEW: Preferences API (Batch 4)
export const PreferencesApi = {
  getPreferences: (vendorId: string) => 
    ApiService.get(`/vendor/${vendorId}/preferences`),
  updatePreferences: (vendorId: string, preferences: any) => 
    ApiService.put(`/vendor/${vendorId}/preferences`, preferences),
};

// ✅ NEW: Account API (Batch 4)
export const AccountApi = {
  getAccount: (vendorId: string) => 
    ApiService.get(`/vendor/${vendorId}/account`),
  updateAccount: (vendorId: string, account: any) => 
    ApiService.put(`/vendor/${vendorId}/account`, account),
};

// ✅ NEW: Security API (Batch 4)
export const SecurityApi = {
  changePassword: (vendorId: string, oldPassword: string, newPassword: string) => 
    ApiService.post(`/vendor/${vendorId}/security/change-password`, { oldPassword, newPassword }),
  enable2FA: (vendorId: string) => 
    ApiService.post(`/vendor/${vendorId}/security/enable-2fa`, {}),
  disable2FA: (vendorId: string) => 
    ApiService.post(`/vendor/${vendorId}/security/disable-2fa`, {}),
};

// ✅ NEW: Notifications Settings API (Batch 4)
export const NotificationsSettingsApi = {
  getSettings: (vendorId: string) => 
    ApiService.get(`/vendor/${vendorId}/notifications/settings`),
  updateSettings: (vendorId: string, settings: any) => 
    ApiService.put(`/vendor/${vendorId}/notifications/settings`, settings),
};

// ✅ NEW: Privacy API (Batch 4)
export const PrivacyApi = {
  getSettings: (vendorId: string) => 
    ApiService.get(`/vendor/${vendorId}/privacy/settings`),
  updateSettings: (vendorId: string, settings: any) => 
    ApiService.put(`/vendor/${vendorId}/privacy/settings`, settings),
};

// ✅ NEW: Help API (Batch 4)
export const HelpApi = {
  getHelpArticles: () => 
    ApiService.get(`/help/articles`),
  getFAQ: () => 
    ApiService.get(`/help/faq`),
  contactSupport: (vendorId: string, message: { subject: string; message: string }) => 
    ApiService.post(`/help/contact`, { vendorId, ...message }),
};

// ✅ NEW: About API (Batch 4)
export const AboutApi = {
  getAppInfo: () => 
    ApiService.get(`/about/app-info`),
  getVersion: () => 
    ApiService.get(`/about/version`),
};

// ✅ NEW: Logout API (Batch 4)
export const LogoutApi = {
  logout: (vendorId: string) => 
    ApiService.post(`/auth/logout`, { vendorId }),
};

// ✅ NEW: Staff Assignment API (Batch 1)
export const StaffAssignmentApi = {
  getAssignableStaff: (vendorId: string, bookingId: string) => 
    ApiService.get(`/vendor/${vendorId}/assignable-staff?bookingId=${bookingId}`),
  assignStaff: (bookingId: string, staffIds: string[], assignmentTypes: string[]) => 
    ApiService.post(`/automation/staff/assign`, { bookingId, staffIds, assignmentTypes }),
};

// ✅ NEW: Settlement Tier System API (Batch 1)
export const SettlementTierSystemApi = {
  getTier: (vendorId: string) => ApiService.get(`/vendor/${vendorId}/tier`),
  verifyBankAccount: (vendorId: string, accountDetails: any) => 
    ApiService.post(`/bank-account/verify`, { vendorId, accountDetails }),
};

// ✅ NEW: GPS Tracking API (Batch 1)
export const GPSTrackingApi = {
  updateLocation: (bookingId: string, location: { latitude: number; longitude: number; accuracy?: number; speed?: number; heading?: number }, sessionNumber?: number) => 
    ApiService.post(`/bookings/${bookingId}/update-location`, { location, sessionNumber }),
  startTracking: (bookingId: string, vendorId: string, currentLocation: { latitude: number; longitude: number }) => 
    ApiService.post(`/home-service/${bookingId}/start-ride`, { vendorId, currentLocation }),
  stopTracking: (bookingId: string, vendorId: string) => 
    ApiService.post(`/home-service/${bookingId}/end-ride`, { vendorId }),
  getActiveTrackings: (vendorId: string) => 
    ApiService.get(`/vendor/${vendorId}/active-trackings`),
};
