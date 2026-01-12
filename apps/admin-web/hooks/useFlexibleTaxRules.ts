/**
 * ============================================================================
 * USE FLEXIBLE TAX RULES HOOK
 * ============================================================================
 * 
 * React hook for managing flexible tax system rules and configurations.
 * 
 * Date: 2026-01-28
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { TaxRule, TaxConfiguration } from '@/types/tax-system';

export interface UseFlexibleTaxRulesOptions {
  includeInactive?: boolean;
}

export function useFlexibleTaxRules(options: UseFlexibleTaxRulesOptions = {}) {
  const [taxRules, setTaxRules] = useState<TaxRule[]>([]);
  const [taxConfig, setTaxConfig] = useState<TaxConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTaxRules = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try to fetch from API, fallback to default config
      try {
        const response = await apiClient.get<{ rules?: TaxRule[]; configuration?: TaxConfiguration }>('/admin/tax/flexible/rules');
        if (response.rules) {
          setTaxRules(response.rules);
        }
        if (response.configuration) {
          setTaxConfig(response.configuration);
        }
      } catch (apiError) {
        // If API doesn't exist yet, use empty configuration
        console.warn('Tax rules API not available');
        setTaxConfig(null);
        setTaxRules([]);
      }
    } catch (err: any) {
      console.error('Error loading tax rules:', err);
      setError(err.message || 'Failed to load tax rules');
    } finally {
      setLoading(false);
    }
  };

  const createTaxRule = async (rule: Partial<TaxRule>): Promise<TaxRule> => {
    try {
      const response = await apiClient.post<{ rule: TaxRule }>('/admin/tax/flexible/rules', rule);
      await loadTaxRules();
      return response.rule;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to create tax rule');
    }
  };

  const updateTaxRule = async (ruleId: string, updates: Partial<TaxRule>): Promise<TaxRule> => {
    try {
      const response = await apiClient.put<{ rule: TaxRule }>(`/admin/tax/flexible/rules/${ruleId}`, updates);
      await loadTaxRules();
      return response.rule;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to update tax rule');
    }
  };

  const deleteTaxRule = async (ruleId: string): Promise<void> => {
    try {
      await apiClient.delete(`/admin/tax/flexible/rules/${ruleId}`);
      await loadTaxRules();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to delete tax rule');
    }
  };

  const updateTaxConfiguration = async (config: Partial<TaxConfiguration>): Promise<TaxConfiguration> => {
    try {
      const response = await apiClient.put<{ configuration: TaxConfiguration }>('/admin/tax/flexible/configuration', config);
      await loadTaxRules();
      return response.configuration;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to update tax configuration');
    }
  };

  useEffect(() => {
    loadTaxRules();
  }, []);

  return {
    taxRules,
    taxConfig,
    loading,
    error,
    createTaxRule,
    updateTaxRule,
    deleteTaxRule,
    updateTaxConfiguration,
    reload: loadTaxRules,
  };
}

