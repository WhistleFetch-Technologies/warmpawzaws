/**
 * ============================================================================
 * API CLIENT WITH MOCK FALLBACK - CUSTOMER WEB
 * ============================================================================
 */

import { apiClient } from './api-client';
import { mockCustomerOrders, mockOrderStats, mockTrackingInfo } from './mock-data';

const isLocalMode = typeof window !== 'undefined' && 
                    (!process.env.NEXT_PUBLIC_API_BASE_URL || 
                     localStorage.getItem('useMockData') === 'true');

export const apiClientWithMock = {
  get: async <T = any>(endpoint: string): Promise<T> => {
    try {
      if (isLocalMode) {
        console.log('[MOCK] GET', endpoint);
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (endpoint.includes('/orders/customer/')) {
          return { orders: mockCustomerOrders, stats: mockOrderStats } as T;
        }
        if (endpoint.includes('/orders/') && endpoint.includes('/tracking')) {
          return mockTrackingInfo as T;
        }
        if (endpoint.includes('/orders/') && !endpoint.includes('/tracking') && !endpoint.includes('/customer/')) {
          const orderId = endpoint.split('/orders/')[1];
          const order = mockCustomerOrders.find(o => o.id === orderId);
          return { order: order || mockCustomerOrders[0] } as T;
        }
      }
      return await apiClient.get<T>(endpoint);
    } catch (error: any) {
      if (error.message?.includes('Failed to fetch') || 
          error.message?.includes('NetworkError') ||
          error.status === 0) {
        console.warn('[API] Falling back to mock data for:', endpoint);
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (endpoint.includes('/orders/customer/')) {
          return { orders: mockCustomerOrders, stats: mockOrderStats } as T;
        }
        if (endpoint.includes('/orders/') && endpoint.includes('/tracking')) {
          return mockTrackingInfo as T;
        }
        return { orders: mockCustomerOrders } as T;
      }
      throw error;
    }
  },

  post: async <T = any>(endpoint: string, data?: any): Promise<T> => {
    try {
      if (isLocalMode) {
        console.log('[MOCK] POST', endpoint, data);
        await new Promise(resolve => setTimeout(resolve, 300));
        return { success: true, message: 'Mock operation successful' } as T;
      }
      return await apiClient.post<T>(endpoint, data);
    } catch (error: any) {
      if (error.message?.includes('Failed to fetch') || 
          error.message?.includes('NetworkError') ||
          error.status === 0) {
        console.warn('[API] Falling back to mock data for:', endpoint);
        await new Promise(resolve => setTimeout(resolve, 300));
        return { success: true, message: 'Mock operation successful' } as T;
      }
      throw error;
    }
  },
};

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

