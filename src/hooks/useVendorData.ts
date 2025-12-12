/**
 * useVendorData Hook
 * Cached vendor data fetching with React Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { cacheManager } from '../utils/cache-manager';
import PerformanceMonitor from '../utils/performance-monitor';
import Analytics from '../utils/analytics';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

export interface VendorData {
  id: string;
  phone: string;
  roleId: string;
  roleName?: string;
  status: string;
  fullName: string;
  email: string;
  businessName?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  isSoloProvider?: boolean;
  centerId?: string;
  autoLinkedStaffId?: string;
  centres?: any[];
  serviceStyle?: string;
  serviceStyles?: string[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

/**
 * Fetch vendor data by ID
 */
export function useVendorData(vendorId?: string) {
  return useQuery({
    queryKey: ['vendor', vendorId],
    queryFn: async (): Promise<VendorData> => {
      if (!vendorId) throw new Error('Vendor ID is required');

      PerformanceMonitor.markStart(`fetch-vendor-${vendorId}`);

      // Try cache first (with shorter TTL for user-specific data)
      const cached = cacheManager.get<VendorData>(`vendor_${vendorId}`);
      if (cached) {
        console.log('💾 Using cached vendor data');
        PerformanceMonitor.markEnd(`fetch-vendor-${vendorId}`);
        return cached;
      }

      // Fetch from API
      const response = await fetch(`${API_BASE}/vendor/${vendorId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch vendor: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch vendor data');
      }

      const vendorData = data.vendor;

      // Cache for 5 minutes
      cacheManager.save(`vendor_${vendorId}`, vendorData, 5 * 60 * 1000);

      const duration = PerformanceMonitor.markEnd(`fetch-vendor-${vendorId}`);
      
      // Track analytics
      if (duration > 2000) {
        Analytics.track('slow_vendor_fetch', {
          vendor_id: vendorId,
          duration_ms: duration
        });
      }

      return vendorData;
    },
    enabled: !!vendorId,
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Fetch vendor data by phone
 */
export function useVendorByPhone(phone?: string) {
  return useQuery({
    queryKey: ['vendor', 'by-phone', phone],
    queryFn: async (): Promise<VendorData | null> => {
      if (!phone) throw new Error('Phone is required');

      const response = await fetch(`${API_BASE}/vendor/by-phone`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phone })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch vendor: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        return null;
      }

      return data.vendor;
    },
    enabled: !!phone,
    staleTime: 2 * 60 * 1000, // 2 minutes (shorter for login flow)
  });
}

/**
 * Update vendor data
 */
export function useUpdateVendor(vendorId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<VendorData>) => {
      const response = await fetch(`${API_BASE}/vendor/${vendorId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error(`Failed to update vendor: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to update vendor');
      }

      return data.vendor;
    },
    onSuccess: (updatedVendor) => {
      // Invalidate and update cache
      queryClient.setQueryData(['vendor', vendorId], updatedVendor);
      cacheManager.save(`vendor_${vendorId}`, updatedVendor, 5 * 60 * 1000);
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['vendor', vendorId] });
      
      console.log('✅ Vendor updated successfully');
    },
    onError: (error) => {
      console.error('❌ Failed to update vendor:', error);
      Analytics.trackError(error as Error, {
        context: 'update_vendor',
        vendor_id: vendorId
      });
    }
  });
}

/**
 * Refresh vendor data (force refetch)
 */
export function useRefreshVendor(vendorId: string) {
  const queryClient = useQueryClient();

  return () => {
    // Clear cache
    cacheManager.invalidateVendor(vendorId);
    
    // Invalidate React Query cache
    queryClient.invalidateQueries({ queryKey: ['vendor', vendorId] });
    
    console.log('🔄 Vendor data refreshed');
  };
}
