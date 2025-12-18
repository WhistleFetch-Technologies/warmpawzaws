/**
 * API Service for Vendor Mobile App
 * Comprehensive API client with proper error handling
 * Matches web app API patterns
 */

import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';
import { API_BASE_URL, publicAnonKey } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Error types
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public data?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class NetworkError extends Error {
  constructor(message: string = 'Network error. Please check your connection.') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication required. Please log in.') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// API Response wrapper
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Create axios instance
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor - Add auth token
  client.interceptors.request.use(
    async (config) => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        } else {
          config.headers.Authorization = `Bearer ${publicAnonKey}`;
        }
      } catch (error) {
        console.error('Error getting auth token:', error);
        config.headers.Authorization = `Bearer ${publicAnonKey}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor - Handle errors
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      return response;
    },
    async (error: AxiosError) => {
      if (!error.response) {
        if (error.code === 'ECONNABORTED') {
          throw new NetworkError('Request timeout. Please try again.');
        }
        throw new NetworkError('Unable to connect to server. Please check your internet connection.');
      }

      const status = error.response.status;
      const responseData = error.response.data as any;

      if (status === 401 || status === 403) {
        await AsyncStorage.removeItem('auth_token');
        throw new AuthenticationError(responseData?.error || responseData?.message || 'Authentication failed');
      }

      const errorMessage = responseData?.error || responseData?.message || error.message || 'An error occurred';
      throw new APIError(
        errorMessage,
        status,
        responseData?.code,
        responseData
      );
    }
  );

  return client;
};

const apiClient = createApiClient();

// Generic API call wrapper
async function apiCall<T = any>(
  requestFn: () => Promise<AxiosResponse<T>>
): Promise<T> {
  try {
    const response = await requestFn();
    return response.data;
  } catch (error) {
    if (error instanceof APIError || error instanceof NetworkError || error instanceof AuthenticationError) {
      throw error;
    }
    
    if (error instanceof Error) {
      throw new APIError(error.message);
    }
    
    throw new APIError('An unexpected error occurred');
  }
}

// Set auth token
export const setAuthToken = async (token: string | null): Promise<void> => {
  if (token) {
    await AsyncStorage.setItem('auth_token', token);
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    await AsyncStorage.removeItem('auth_token');
    delete apiClient.defaults.headers.common.Authorization;
  }
};

// Clear auth token
export const clearAuthToken = async (): Promise<void> => {
  await AsyncStorage.removeItem('auth_token');
  delete apiClient.defaults.headers.common.Authorization;
};

// Vendor API
export const vendorAPI = {
  // Get vendor profile
  getProfile: async (vendorId: string) => {
    return apiCall(() => apiClient.get(`/vendor/profile`, { params: { vendorId } }));
  },

  // Get vendor status
  getStatus: async (vendorId: string) => {
    return apiCall(() => apiClient.get(`/vendor/status`, { params: { vendorId } }));
  },

  // Submit application
  submitApplication: async (applicationData: any) => {
    return apiCall(() => apiClient.post('/vendor/application', applicationData));
  },

  // Update application
  updateApplication: async (applicationId: string, applicationData: any) => {
    return apiCall(() => apiClient.put(`/vendor/application/${applicationId}`, applicationData));
  },

  // Get bookings
  getBookings: async (vendorId: string, filters?: any) => {
    return apiCall(() => apiClient.get(`/vendor/bookings`, { params: { vendorId, ...filters } }));
  },

  // Get booking details
  getBookingDetails: async (bookingId: string) => {
    return apiCall(() => apiClient.get(`/vendor/booking/${bookingId}`));
  },

  // Update booking status
  updateBookingStatus: async (bookingId: string, status: string, data?: any) => {
    return apiCall(() => apiClient.post(`/vendor/booking/${bookingId}/update`, { status, ...data }));
  },

  // Get services
  getServices: async (vendorId: string) => {
    return apiCall(() => apiClient.get(`/vendor/services`, { params: { vendorId } }));
  },

  // Create service
  createService: async (vendorId: string, serviceData: any) => {
    return apiCall(() => apiClient.post('/vendor/services/create', { vendorId, ...serviceData }));
  },

  // Update service
  updateService: async (serviceId: string, serviceData: any) => {
    return apiCall(() => apiClient.put(`/vendor/services/${serviceId}`, serviceData));
  },

  // Get staff
  getStaff: async (vendorId: string) => {
    return apiCall(() => apiClient.get(`/vendor/staff`, { params: { vendorId } }));
  },

  // Create staff
  createStaff: async (vendorId: string, staffData: any) => {
    return apiCall(() => apiClient.post('/vendor/staff/create', { vendorId, ...staffData }));
  },

  // Update staff
  updateStaff: async (staffId: string, staffData: any) => {
    return apiCall(() => apiClient.put(`/vendor/staff/${staffId}`, staffData));
  },

  // Get schedule
  getSchedule: async (vendorId: string) => {
    return apiCall(() => apiClient.get(`/vendor/schedule`, { params: { vendorId } }));
  },

  // Update schedule
  updateSchedule: async (vendorId: string, scheduleData: any) => {
    return apiCall(() => apiClient.post('/vendor/schedule/update', { vendorId, ...scheduleData }));
  },
};

// Export default API client
export default apiClient;

