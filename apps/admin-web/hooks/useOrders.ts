/**
 * Domain-specific hook for order management
 * Provides consistent order data fetching, mutations, and state management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  vendor_id?: string;
  order_status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned' | 'refunded';
  total_amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
  tracking_number?: string;
  shipped_at?: string;
  delivered_at?: string;
  cancelled_at?: string;
}

// ============================================================================
// QUERIES
// ============================================================================

export function useOrders(filters?: { status?: string; vendorId?: string; customerId?: string }) {
  return useQuery({
    queryKey: ['orders', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.vendorId) params.append('vendor_id', filters.vendorId);
      if (filters?.customerId) params.append('customer_id', filters.customerId);
      
      const response = await apiClient.get<any>(`/admin/orders?${params.toString()}`);
      return (response.orders || response || []) as Order[];
    },
    staleTime: 30000,
  });
}

export function useOrder(orderId: string) {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const response = await apiClient.get<any>(`/admin/orders/${orderId}`);
      return response.order || response as Order;
    },
    enabled: !!orderId,
  });
}

// ============================================================================
// MUTATIONS
// ============================================================================

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, status, trackingNumber, notes }: { 
      orderId: string; 
      status: string; 
      trackingNumber?: string; 
      notes?: string;
    }) => {
      return await apiClient.put(`/orders/${orderId}/status`, { status, trackingNumber, notes });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', variables.orderId] });
      toast.success('Order status updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update order status');
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason?: string }) => {
      return await apiClient.post(`/orders/${orderId}/cancel`, { reason });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', variables.orderId] });
      toast.success('Order cancelled');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to cancel order');
    },
  });
}
