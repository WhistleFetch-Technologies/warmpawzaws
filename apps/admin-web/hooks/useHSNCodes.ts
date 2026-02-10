/**
 * useHSNCodes Hook
 * 
 * React hook for managing HSN codes
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api-client';

export interface HSNCode {
  id: string;
  hsn_code: string;
  description?: string;
  gst_rate: number;
  is_active: boolean;
  created_at: string;
}

export interface HSNCodeFilters {
  isActive?: boolean;
  search?: string;
}

export function useHSNCodes(filters?: HSNCodeFilters) {
  const [hsnCodes, setHsnCodes] = useState<HSNCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);

  const fetchHSNCodes = useCallback(async () => {
    // Don't retry if we have an auth error
    if (authError) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (filters?.isActive !== undefined) {
        params.append('isActive', filters.isActive.toString());
      }
      if (filters?.search) {
        params.append('search', filters.search);
      }

      const response = await apiClient.get<{ hsnCodes: HSNCode[] }>(
        `/admin/hsn-codes${params.toString() ? `?${params.toString()}` : ''}`
      );
      
      setHsnCodes(response.hsnCodes || []);
      setAuthError(false); // Reset auth error on success
    } catch (err: any) {
      // Stop retrying on authentication errors
      if (err?.response?.code === 'AUTH_REQUIRED' || err?.message?.includes('Authentication required') || err?.response?.error === 'Authentication required') {
        setError('Authentication required. Please log in again.');
        setAuthError(true); // Set flag to prevent retries
        setLoading(false);
        return;
      }
      setError(err.message || 'Failed to fetch HSN codes');
      console.error('Error fetching HSN codes:', err);
    } finally {
      setLoading(false);
    }
  }, [filters?.isActive, filters?.search, authError]);

  useEffect(() => {
    fetchHSNCodes();
  }, [fetchHSNCodes]);

  const createHSNCode = useCallback(async (data: Partial<HSNCode>) => {
    try {
      const response = await apiClient.post<{ hsnCode: HSNCode }>('/admin/hsn-codes', data);
      await fetchHSNCodes();
      return response.hsnCode;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to create HSN code');
    }
  }, [fetchHSNCodes]);

  const updateHSNCode = useCallback(async (id: string, data: Partial<HSNCode>) => {
    try {
      const response = await apiClient.put<{ hsnCode: HSNCode }>(`/admin/hsn-codes/${id}`, data);
      await fetchHSNCodes();
      return response.hsnCode;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to update HSN code');
    }
  }, [fetchHSNCodes]);

  const deleteHSNCode = useCallback(async (id: string) => {
    try {
      await apiClient.delete(`/admin/hsn-codes/${id}`);
      await fetchHSNCodes();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to delete HSN code');
    }
  }, [fetchHSNCodes]);

  return {
    hsnCodes,
    loading,
    error,
    refetch: fetchHSNCodes,
    createHSNCode,
    updateHSNCode,
    deleteHSNCode,
  };
}

