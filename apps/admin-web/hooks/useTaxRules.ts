/**
 * useTaxRules Hook
 * 
 * React hook for managing tax rules
 * Follows existing design patterns and UI migration approach
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api-client';

export interface TaxRule {
  id: string;
  rule_name: string;
  enabled: boolean;
  priority: number;
  role_id?: string;
  role_name?: string;
  service_style?: 'at_center' | 'at_home' | 'tele' | 'hybrid';
  category?: string;
  min_amount?: number;
  max_amount?: number;
  customer_state?: string;
  vendor_state?: string;
  gst_type: 'percentage' | 'fixed';
  gst_rate: number;
  cgst_percentage?: number;
  sgst_percentage?: number;
  igst_percentage?: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface TaxRuleFilters {
  enabled?: boolean;
  roleId?: string;
  serviceStyle?: string;
  category?: string;
}

export function useTaxRules(filters?: TaxRuleFilters) {
  const [taxRules, setTaxRules] = useState<TaxRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTaxRules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (filters?.enabled !== undefined) {
        params.append('enabled', filters.enabled.toString());
      }
      if (filters?.roleId) {
        params.append('roleId', filters.roleId);
      }
      if (filters?.serviceStyle) {
        params.append('serviceStyle', filters.serviceStyle);
      }
      if (filters?.category) {
        params.append('category', filters.category);
      }

      const response = await apiClient.get<{ taxRules: TaxRule[] }>(
        `/admin/tax-rules${params.toString() ? `?${params.toString()}` : ''}`
      );
      
      setTaxRules(response.taxRules || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tax rules');
      console.error('Error fetching tax rules:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchTaxRules();
  }, [fetchTaxRules]);

  const createTaxRule = useCallback(async (data: Partial<TaxRule>) => {
    try {
      const response = await apiClient.post<{ taxRule: TaxRule }>('/admin/tax-rules', data);
      await fetchTaxRules();
      return response.taxRule;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to create tax rule');
    }
  }, [fetchTaxRules]);

  const updateTaxRule = useCallback(async (id: string, data: Partial<TaxRule>) => {
    try {
      const response = await apiClient.put<{ taxRule: TaxRule }>(`/admin/tax-rules/${id}`, data);
      await fetchTaxRules();
      return response.taxRule;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to update tax rule');
    }
  }, [fetchTaxRules]);

  const deleteTaxRule = useCallback(async (id: string) => {
    try {
      await apiClient.delete(`/admin/tax-rules/${id}`);
      await fetchTaxRules();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to delete tax rule');
    }
  }, [fetchTaxRules]);

  return {
    taxRules,
    loading,
    error,
    refetch: fetchTaxRules,
    createTaxRule,
    updateTaxRule,
    deleteTaxRule,
  };
}

