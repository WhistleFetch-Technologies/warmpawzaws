/**
 * Domain-specific hook for vendor management
 * Provides consistent vendor data fetching, mutations, and state management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'pending' | 'approved' | 'rejected' | 'clarification_requested';
  vendor_type: string;
  created_at: string;
  approved_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
}

export interface VendorStats {
  total: number;
  active: number;
  pending: number;
  deactivated: number;
  rejected: number;
  by_category: Record<string, number>;
}

// ============================================================================
// QUERIES
// ============================================================================

export function useVendors(filters?: { status?: string; search?: string }) {
  return useQuery({
    queryKey: ['vendors', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.search) params.append('search', filters.search);
      
      const response = await apiClient.get<any>(`/admin/vendors?${params.toString()}`);
      return (response.vendors || response || []) as Vendor[];
    },
    staleTime: 30000, // 30 seconds
  });
}

export function useVendorStats() {
  return useQuery({
    queryKey: ['vendor-stats'],
    queryFn: async () => {
      const response = await apiClient.get<any>('/admin/vendors/stats');
      return (response.stats || response.data || response) as VendorStats;
    },
    staleTime: 60000, // 1 minute
  });
}

export function useVendor(vendorId: string) {
  return useQuery({
    queryKey: ['vendor', vendorId],
    queryFn: async () => {
      const response = await apiClient.get<any>(`/admin/vendors/${vendorId}`);
      return response.vendor || response as Vendor;
    },
    enabled: !!vendorId,
  });
}

// ============================================================================
// MUTATIONS
// ============================================================================

export function useApproveVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ vendorId, adminId }: { vendorId: string; adminId?: string }) => {
      return await apiClient.post(`/admin/vendors/${vendorId}/approve`, { adminId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-stats'] });
      toast.success('Vendor approved successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve vendor');
    },
  });
}

export function useRejectVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ vendorId, reason, adminId }: { vendorId: string; reason: string; adminId?: string }) => {
      return await apiClient.post(`/admin/vendors/${vendorId}/reject`, { reason, adminId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-stats'] });
      toast.success('Vendor rejected');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reject vendor');
    },
  });
}

export function useRequestClarification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ vendorId, message, adminId }: { vendorId: string; message: string; adminId?: string }) => {
      return await apiClient.post(`/admin/vendors/${vendorId}/request-clarification`, { message, adminId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-stats'] });
      toast.success('Clarification requested');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to request clarification');
    },
  });
}
