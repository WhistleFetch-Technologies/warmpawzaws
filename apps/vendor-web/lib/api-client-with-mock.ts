/**
 * ============================================================================
 * API CLIENT WITH MOCK FALLBACK
 * ============================================================================
 * Falls back to mock data when API is not available
 * ============================================================================
 */

import { apiClient } from './api-client';
import { createMockApiClient, mockProducts, mockCategories, mockOrders, mockOrderStats, mockSalesAnalytics, mockProductPerformance } from './mock-data';

// Check if we're in local mode (no API available)
const isLocalMode = typeof window !== 'undefined' && 
                    (!process.env.NEXT_PUBLIC_API_BASE_URL || 
                     localStorage.getItem('useMockData') === 'true');

const mockClient = createMockApiClient();

export const apiClientWithMock = {
  get: async <T = any>(endpoint: string): Promise<T> => {
    try {
      if (isLocalMode) {
        console.log('[MOCK] GET', endpoint);
        return await mockClient.get(endpoint) as T;
      }
      return await apiClient.get<T>(endpoint);
    } catch (error: any) {
      // Fallback to mock on error
      if (error.message?.includes('Failed to fetch') || 
          error.message?.includes('NetworkError') ||
          error.status === 0) {
        console.warn('[API] Falling back to mock data for:', endpoint);
        return await mockClient.get(endpoint) as T;
      }
      throw error;
    }
  },

  post: async <T = any>(endpoint: string, data?: any): Promise<T> => {
    try {
      if (isLocalMode) {
        console.log('[MOCK] POST', endpoint, data);
        return await mockClient.post(endpoint, data) as T;
      }
      return await apiClient.post<T>(endpoint, data);
    } catch (error: any) {
      if (error.message?.includes('Failed to fetch') || 
          error.message?.includes('NetworkError') ||
          error.status === 0) {
        console.warn('[API] Falling back to mock data for:', endpoint);
        return await mockClient.post(endpoint, data) as T;
      }
      throw error;
    }
  },

  put: async <T = any>(endpoint: string, data?: any): Promise<T> => {
    try {
      if (isLocalMode) {
        console.log('[MOCK] PUT', endpoint, data);
        return await mockClient.put(endpoint, data) as T;
      }
      return await apiClient.put<T>(endpoint, data);
    } catch (error: any) {
      if (error.message?.includes('Failed to fetch') || 
          error.message?.includes('NetworkError') ||
          error.status === 0) {
        console.warn('[API] Falling back to mock data for:', endpoint);
        return await mockClient.put(endpoint, data) as T;
      }
      throw error;
    }
  },

  delete: async <T = any>(endpoint: string): Promise<T> => {
    try {
      if (isLocalMode) {
        console.log('[MOCK] DELETE', endpoint);
        return await mockClient.delete(endpoint) as T;
      }
      return await apiClient.delete<T>(endpoint);
    } catch (error: any) {
      if (error.message?.includes('Failed to fetch') || 
          error.message?.includes('NetworkError') ||
          error.status === 0) {
        console.warn('[API] Falling back to mock data for:', endpoint);
        return await mockClient.delete(endpoint) as T;
      }
      throw error;
    }
  },
};

// Enable mock mode from console: localStorage.setItem('useMockData', 'true')
if (typeof window !== 'undefined') {
  (window as any).enableMockData = () => {
    localStorage.setItem('useMockData', 'true');
    window.location.reload();
  };
  (window as any).disableMockData = () => {
    localStorage.removeItem('useMockData');
    window.location.reload();
  };
}

