/**
 * Domain-specific hook for booking management
 * Provides consistent booking data fetching, mutations, and state management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

export interface Booking {
  id: string;
  customer_id: string;
  vendor_id: string;
  service_id?: string;
  booking_date: string;
  booking_time: string;
  booking_status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  payment_status: 'pending' | 'paid' | 'refunded';
  total_amount: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// QUERIES
// ============================================================================

export function useBookings(filters?: { status?: string; vendorId?: string; customerId?: string; date?: string }) {
  return useQuery({
    queryKey: ['bookings', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.vendorId) params.append('vendor_id', filters.vendorId);
      if (filters?.customerId) params.append('customer_id', filters.customerId);
      if (filters?.date) params.append('date', filters.date);
      
      const response = await apiClient.get<any>(`/admin/bookings?${params.toString()}`);
      return (response.bookings || response || []) as Booking[];
    },
    staleTime: 30000,
  });
}

export function useBooking(bookingId: string) {
  return useQuery({
    queryKey: ['booking', bookingId],
    queryFn: async () => {
      const response = await apiClient.get<any>(`/admin/bookings/${bookingId}`);
      return response.booking || response as Booking;
    },
    enabled: !!bookingId,
  });
}

// ============================================================================
// MUTATIONS
// ============================================================================

export function useUpdateBookingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookingId, status, notes }: { 
      bookingId: string; 
      status: string; 
      notes?: string;
    }) => {
      return await apiClient.put(`/admin/bookings/${bookingId}/status`, { status, notes });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking', variables.bookingId] });
      toast.success('Booking status updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update booking status');
    },
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason?: string }) => {
      return await apiClient.post(`/admin/bookings/${bookingId}/cancel`, { reason });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking', variables.bookingId] });
      toast.success('Booking cancelled');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to cancel booking');
    },
  });
}
