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
// We use a function to check at runtime, not build time
const getIsLocalMode = () => {
  if (typeof window === 'undefined') return false;
  // Check if explicitly set to mock mode
  if (localStorage.getItem('useMockData') === 'true') return true;
  // Check runtime config for API URL (deployed apps use this)
  const runtimeConfig = (window as any).__WARMPAWZ_RUNTIME_CONFIG__;
  if (runtimeConfig?.apiBaseUrl) return false;
  // Check build-time env var
  if (process.env.NEXT_PUBLIC_API_BASE_URL) return false;
  // Default to mock only if no API URL is configured
  return true;
};

const mockClient = createMockApiClient();

export const apiClientWithMock = {
  get: async <T = any>(endpoint: string): Promise<T> => {
    try {
      if (getIsLocalMode()) {
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
      if (getIsLocalMode()) {
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
      if (getIsLocalMode()) {
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
      if (getIsLocalMode()) {
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

