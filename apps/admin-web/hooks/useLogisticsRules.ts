/**
 * React Hook for Logistics Rules Management
 */

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

export interface LogisticsRule {
  id: string;
  rule_name: string;
  rule_type: string;
  rule_config: {
    conditions?: {
      minWeight?: number;
      maxWeight?: number;
      minOrderValue?: number;
      maxOrderValue?: number;
      pickupStates?: string[];
      deliveryStates?: string[];
      pickupPincodes?: string[];
      deliveryPincodes?: string[];
    };
    partnerPriority?: string[];
    defaultPartner?: string;
    priority?: number;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useLogisticsRules() {
  const [rules, setRules] = useState<LogisticsRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRules = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<{ success: boolean; rules: LogisticsRule[] }>('/admin/logistics-rules');
      setRules(response.rules || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch logistics rules');
      setRules([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const createRule = async (data: Partial<LogisticsRule>) => {
    try {
      const response = await apiClient.post<{ success: boolean; rule: LogisticsRule }>('/admin/logistics-rules', data);
      await fetchRules();
      return response.rule;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to create logistics rule');
    }
  };

  const updateRule = async (id: string, data: Partial<LogisticsRule>) => {
    try {
      const response = await apiClient.put<{ success: boolean; rule: LogisticsRule }>(`/admin/logistics-rules/${id}`, data);
      await fetchRules();
      return response.rule;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to update logistics rule');
    }
  };

  const deleteRule = async (id: string) => {
    try {
      await apiClient.delete(`/admin/logistics-rules/${id}`);
      await fetchRules();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to delete logistics rule');
    }
  };

  return {
    rules,
    loading,
    error,
    refetch: fetchRules,
    createRule,
    updateRule,
    deleteRule,
  };
}

