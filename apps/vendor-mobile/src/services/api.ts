/**
 * API Service for Vendor Mobile App
 * Uses shared API client for all API calls
 */

import { createApiClient, vendorApi, ApiClient } from '@warmpawz/shared-api';
import { API_BASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/api';

// Create API client instance
const apiClient: ApiClient = createApiClient({
  baseURL: API_BASE_URL,
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
});

// Vendor API Service
export const vendorService = {
  // Dashboard
  getDashboard: async (vendorId: string) => {
    return vendorApi.getDashboard(apiClient, vendorId);
  },

  // Bookings
  getBookings: async (vendorId: string) => {
    return vendorApi.getBookings(apiClient, vendorId);
  },

  // Services
  getServices: async (vendorId: string) => {
    return vendorApi.getServices(apiClient, vendorId);
  },

  createService: async (serviceData: any) => {
    return vendorApi.createService(apiClient, serviceData);
  },

  updateService: async (serviceId: string, serviceData: any) => {
    return vendorApi.updateService(apiClient, serviceId, serviceData);
  },

  deleteService: async (serviceId: string) => {
    return vendorApi.deleteService(apiClient, serviceId);
  },

  // Staff
  getStaff: async (vendorId: string) => {
    return vendorApi.getStaff(apiClient, vendorId);
  },

  createStaff: async (staffData: any) => {
    return vendorApi.createStaff(apiClient, staffData);
  },
};

// Set auth token (call after login)
export const setAuthToken = (token: string) => {
  apiClient.setAuthToken(token);
};

// Clear auth token (call on logout)
export const clearAuthToken = () => {
  apiClient.clearAuthToken();
};

export default vendorService;

