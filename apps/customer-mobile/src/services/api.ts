/**
 * API Service for Customer Mobile App
 * Uses shared API client for all API calls
 */

import { createApiClient, customerApi, ApiClient } from '@warmpawz/shared-api';
import { API_BASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/api';

// Create API client instance
const apiClient: ApiClient = createApiClient({
  baseURL: API_BASE_URL,
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
});

// Customer API Service
export const customerService = {
  // Featured Services
  getFeaturedServices: async () => {
    return customerApi.getFeaturedServices(apiClient);
  },

  // Bookings
  getBookings: async (customerId: string) => {
    return customerApi.getBookings(apiClient, customerId);
  },

  createBooking: async (bookingData: any) => {
    return customerApi.createBooking(apiClient, bookingData);
  },

  // Previous Providers
  getPreviousProviders: async (customerId: string) => {
    return customerApi.getPreviousProviders(apiClient, customerId);
  },

  // Problem Search
  problemSearch: async (query: string, location?: { lat: number; lng: number }) => {
    return customerApi.problemSearch(apiClient, query, location);
  },

  // GPS Tracking
  getTrackingStatus: async (trackingId: string) => {
    return customerApi.getTrackingStatus(apiClient, trackingId);
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

export default customerService;

