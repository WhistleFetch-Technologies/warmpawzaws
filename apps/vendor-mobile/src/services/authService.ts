/**
 * Authentication Service for Vendor Mobile App
 * Handles OTP sending and verification
 */

import { API_BASE_URL } from '../config/api';
import axios from 'axios';

const authClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const authService = {
  /**
   * Send OTP to phone number
   */
  sendOTP: async (phone: string) => {
    try {
      const response = await authClient.post('/vendor/auth/send-otp', {
        phone,
      });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Verify OTP and get auth token
   */
  verifyOTP: async (phone: string, otp: string) => {
    try {
      const response = await authClient.post('/vendor/auth/verify-otp', {
        phone,
        otp,
      });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Refresh auth token
   */
  refreshToken: async (refreshToken: string) => {
    try {
      const response = await authClient.post('/vendor/auth/refresh', {
        refreshToken,
      });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
};

export default authService;

