/**
 * useTaxCategories Hook
 * 
 * React hook for managing tax categories
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api-client';

export interface TaxCategory {
  id: string;
  category_name: string;
  tax_rate: number;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface TaxCategoryFilters {
  isActive?: boolean;
}

export function useTaxCategories(filters?: TaxCategoryFilters) {
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTaxCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (filters?.isActive !== undefined) {
        params.append('isActive', filters.isActive.toString());
      }

      const response = await apiClient.get<{ taxCategories: TaxCategory[] }>(
        `/admin/tax-categories${params.toString() ? `?${params.toString()}` : ''}`
      );
      
      setTaxCategories(response.taxCategories || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tax categories');
      console.error('Error fetching tax categories:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchTaxCategories();
  }, [fetchTaxCategories]);

  const createTaxCategory = useCallback(async (data: Partial<TaxCategory>) => {
    try {
      const response = await apiClient.post<{ taxCategory: TaxCategory }>('/admin/tax-categories', data);
      await fetchTaxCategories();
      return response.taxCategory;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to create tax category');
    }
  }, [fetchTaxCategories]);

  const updateTaxCategory = useCallback(async (id: string, data: Partial<TaxCategory>) => {
    try {
      const response = await apiClient.put<{ taxCategory: TaxCategory }>(`/admin/tax-categories/${id}`, data);
      await fetchTaxCategories();
      return response.taxCategory;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to update tax category');
    }
  }, [fetchTaxCategories]);

  const deleteTaxCategory = useCallback(async (id: string) => {
    try {
      await apiClient.delete(`/admin/tax-categories/${id}`);
      await fetchTaxCategories();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to delete tax category');
    }
  }, [fetchTaxCategories]);

  return {
    taxCategories,
    loading,
    error,
    refetch: fetchTaxCategories,
    createTaxCategory,
    updateTaxCategory,
    deleteTaxCategory,
  };
}

