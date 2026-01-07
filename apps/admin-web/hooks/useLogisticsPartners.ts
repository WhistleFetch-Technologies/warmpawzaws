/**
 * React Hook for Logistics Partners Management
 */

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

export interface LogisticsPartner {
  id: string;
  partner_id: string;
  partner_name: string;
  partner_type: 'shiprocket' | 'delhivery' | 'dunzo' | 'other';
  email?: string;
  password?: string;
  api_key?: string;
  api_secret?: string;
  enabled: boolean;
  config: any;
  created_at: string;
  updated_at: string;
}

export function useLogisticsPartners() {
  const [partners, setPartners] = useState<LogisticsPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPartners = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<{ success: boolean; partners: LogisticsPartner[] }>('/admin/logistics-partners');
      setPartners(response.partners || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch logistics partners');
      setPartners([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const createPartner = async (data: Partial<LogisticsPartner>) => {
    try {
      const response = await apiClient.post<{ success: boolean; partner: LogisticsPartner }>('/admin/logistics-partners', data);
      await fetchPartners();
      return response.partner;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to create logistics partner');
    }
  };

  const updatePartner = async (id: string, data: Partial<LogisticsPartner>) => {
    try {
      const response = await apiClient.put<{ success: boolean; partner: LogisticsPartner }>(`/admin/logistics-partners/${id}`, data);
      await fetchPartners();
      return response.partner;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to update logistics partner');
    }
  };

  const deletePartner = async (id: string) => {
    try {
      await apiClient.delete(`/admin/logistics-partners/${id}`);
      await fetchPartners();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to delete logistics partner');
    }
  };

  return {
    partners,
    loading,
    error,
    refetch: fetchPartners,
    createPartner,
    updatePartner,
    deletePartner,
  };
}

