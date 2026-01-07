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

  const fetchHSNCodes = useCallback(async () => {
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
    } catch (err: any) {
      setError(err.message || 'Failed to fetch HSN codes');
      console.error('Error fetching HSN codes:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

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

