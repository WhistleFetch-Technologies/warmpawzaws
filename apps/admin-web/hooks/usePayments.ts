/**
 * Domain-specific hook for payment management
 * Provides consistent payment data fetching, mutations, and state management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

export interface Payment {
  id: string;
  booking_id?: string;
  order_id?: string;
  customer_id: string;
  vendor_id?: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  created_at: string;
  completed_at?: string;
}

// ============================================================================
// QUERIES
// ============================================================================

export function usePayments(filters?: { status?: string; customerId?: string; vendorId?: string }) {
  return useQuery({
    queryKey: ['payments', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.customerId) params.append('customer_id', filters.customerId);
      if (filters?.vendorId) params.append('vendor_id', filters.vendorId);
      
      const response = await apiClient.get<any>(`/admin/payments?${params.toString()}`);
      return (response.payments || response || []) as Payment[];
    },
    staleTime: 30000,
  });
}

export function usePayment(paymentId: string) {
  return useQuery({
    queryKey: ['payment', paymentId],
    queryFn: async () => {
      const response = await apiClient.get<any>(`/admin/payments/${paymentId}`);
      return response.payment || response as Payment;
    },
    enabled: !!paymentId,
  });
}

// ============================================================================
// MUTATIONS
// ============================================================================

export function useRefundPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ paymentId, amount, reason }: { 
      paymentId: string; 
      amount?: number; 
      reason?: string;
    }) => {
      return await apiClient.post(`/admin/payments/${paymentId}/refund`, { amount, reason });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['payment', variables.paymentId] });
      toast.success('Payment refunded');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to refund payment');
    },
  });
}
