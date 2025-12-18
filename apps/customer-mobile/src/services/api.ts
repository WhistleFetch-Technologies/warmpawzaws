/**
 * API Service for Customer Mobile App
 * Comprehensive API client with proper error handling
 * Matches web app API patterns
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
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
    timeout: 30000, // 30 seconds
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
          // Use public anon key as fallback
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
      // Handle network errors
      if (!error.response) {
        if (error.code === 'ECONNABORTED') {
          throw new NetworkError('Request timeout. Please try again.');
        }
        throw new NetworkError('Unable to connect to server. Please check your internet connection.');
      }

      const status = error.response.status;
      const responseData = error.response.data as any;

      // Handle authentication errors
      if (status === 401 || status === 403) {
        // Clear stored token
        await AsyncStorage.removeItem('auth_token');
        throw new AuthenticationError(responseData?.error || responseData?.message || 'Authentication failed');
      }

      // Handle other HTTP errors
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

// Generic API call wrapper with error handling
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
    
    // Handle unexpected errors
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

// Customer API
export const customerAPI = {
  // Get featured services
  getFeaturedServices: async () => {
    return apiCall(() => apiClient.get('/customer/featured-services'));
  },

  // Get bookings
  getBookings: async (customerId?: string) => {
    const params = customerId ? { customerId } : {};
    return apiCall(() => apiClient.get('/customer/bookings', { params }));
  },

  // Get booking details
  getBookingDetails: async (bookingId: string) => {
    return apiCall(() => apiClient.get(`/booking/${bookingId}`));
  },

  // Create booking
  createBooking: async (bookingData: any) => {
    return apiCall(() => apiClient.post('/booking/create', bookingData));
  },

  // Cancel booking
  cancelBooking: async (bookingId: string, reason?: string) => {
    return apiCall(() => apiClient.post(`/booking/${bookingId}/cancel`, { reason }));
  },

  // Get previous providers
  getPreviousProviders: async (customerId: string) => {
    return apiCall(() => apiClient.get(`/customer/${customerId}/previous-providers`));
  },

  // Problem-first search
  problemSearch: async (query: string, filters?: any) => {
    return apiCall(() => apiClient.post('/customer/problem-first-search', { query, filters }));
  },

  // Search services
  searchServices: async (query: string, filters?: any) => {
    return apiCall(() => apiClient.post('/customer/search-services', { query, filters }));
  },
};

// Service API
export const serviceAPI = {
  // Get service details
  getServiceDetails: async (serviceId: string) => {
    return apiCall(() => apiClient.get(`/services/${serviceId}`));
  },

  // Get service providers
  getServiceProviders: async (serviceId: string, filters?: any) => {
    return apiCall(() => apiClient.get(`/services/${serviceId}/providers`, { params: filters }));
  },
};

// GPS Tracking API
export const trackingAPI = {
  // Get tracking status
  getTrackingStatus: async (trackingId: string) => {
    return apiCall(() => apiClient.get(`/gps/tracking/${trackingId}`));
  },
};

// Pet API
export const petAPI = {
  // Get customer pets
  getPets: async (customerId: string) => {
    return apiCall(() => apiClient.get(`/customer/${customerId}/pets`));
  },

  // Add pet
  addPet: async (customerId: string, petData: any) => {
    return apiCall(() => apiClient.post(`/customer/${customerId}/pets`, petData));
  },

  // Update pet
  updatePet: async (customerId: string, petId: string, petData: any) => {
    return apiCall(() => apiClient.put(`/customer/${customerId}/pets/${petId}`, petData));
  },

  // Delete pet
  deletePet: async (customerId: string, petId: string) => {
    return apiCall(() => apiClient.delete(`/customer/${customerId}/pets/${petId}`));
  },
};

// User Profile API
export const userAPI = {
  // Get user profile
  getProfile: async (userId: string) => {
    return apiCall(() => apiClient.get(`/users/${userId}`));
  },

  // Update user profile
  updateProfile: async (userId: string, profileData: any) => {
    return apiCall(() => apiClient.put(`/users/${userId}`, profileData));
  },

  // Upload profile photo
  uploadPhoto: async (userId: string, photoUri: string) => {
    // For file uploads, you'll need to use FormData
    const formData = new FormData();
    formData.append('photo', {
      uri: photoUri,
      type: 'image/jpeg',
      name: 'photo.jpg',
    } as any);

    return apiCall(() => 
      apiClient.post(`/users/${userId}/photo`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
    );
  },
};

// Payment API
export const paymentAPI = {
  // Create payment intent
  createPaymentIntent: async (bookingId: string, amount: number) => {
    return apiCall(() => apiClient.post('/payment/create-intent', { bookingId, amount }));
  },

  // Confirm payment
  confirmPayment: async (paymentId: string, paymentMethod: any) => {
    return apiCall(() => apiClient.post(`/payment/${paymentId}/confirm`, { paymentMethod }));
  },
};

// Chat API
export const chatAPI = {
  // Get chat messages
  getMessages: async (chatId: string) => {
    return apiCall(() => apiClient.get(`/chat/${chatId}/messages`));
  },

  // Send message
  sendMessage: async (chatId: string, message: string) => {
    return apiCall(() => apiClient.post(`/chat/${chatId}/messages`, { message }));
  },
};

// Export default API client for custom requests
export default apiClient;

