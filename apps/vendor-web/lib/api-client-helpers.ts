/**
 * API Client Helpers
 * Provides bookingApi-like interface using apiClient
 */

import { apiClient } from './api-client';

export const bookingApi = {
  async getVendorBookings(vendorId: string) {
    const response = await apiClient.get(`/vendor/${vendorId}/bookings`);
    return response.data;
  },
  
  async getById(bookingId: string) {
    const response = await apiClient.get(`/bookings/${bookingId}`);
    return response.data;
  },
  
  async updateStatus(bookingId: string, status: string, note?: string) {
    const response = await apiClient.post(`/bookings/${bookingId}/status`, { status, note });
    return response.data;
  },
  
  async verifyOTP(bookingId: string, otp: string, action: string) {
    const response = await apiClient.post(`/bookings/${bookingId}/otp/verify`, { otp, action });
    return response.data;
  }
};
