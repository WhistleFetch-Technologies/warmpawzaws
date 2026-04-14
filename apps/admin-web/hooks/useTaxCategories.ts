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

function mapTaxCategoryRow(row: Record<string, unknown> | null | undefined): TaxCategory | null {
  if (!row || row.id == null) return null;
  return {
    id: String(row.id),
    category_name: String(row.category_name ?? row.name ?? '').trim() || '—',
    tax_rate: Number(row.tax_rate ?? row.default_gst_rate ?? 0),
    description: row.description != null ? String(row.description) : undefined,
    is_active: row.is_active !== false,
    created_at: row.created_at != null ? String(row.created_at) : '',
  };
}

function taxCategoryToFinanceBody(data: Partial<TaxCategory> & { name?: string }) {
  const name = data.category_name ?? data.name;
  const body: Record<string, unknown> = {};
  if (name !== undefined) body.name = typeof name === 'string' ? name : String(name);
  if (data.description !== undefined) body.description = data.description;
  if (data.tax_rate !== undefined) body.defaultGSTRate = data.tax_rate;
  if (data.is_active !== undefined) body.isActive = data.is_active;
  return body;
}

export function useTaxCategories(filters?: TaxCategoryFilters) {
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);

  const fetchTaxCategories = useCallback(async () => {
    // Don't retry if we have an auth error
    if (authError) {
      return;
    }
    try {
      setLoading(true);
      setError(null);

      // Same source as Finance → GST Configuration (`/admin/finance/gst/tax-categories`).
      // Legacy `/admin/tax-categories` wraps lists in `{ data: { taxCategories } }`; hooks used to read top-level and always got [].
      const response = await apiClient.get<Record<string, unknown>>('/admin/finance/gst/tax-categories');
      const raw = (response.categories ??
        (response.data as Record<string, unknown> | undefined)?.taxCategories ??
        response.taxCategories) as TaxCategory[] | undefined;
      let list = Array.isArray(raw) ? raw : [];

      if (filters?.isActive === true) {
        list = list.filter((c: TaxCategory & { is_active?: boolean }) => (c as any).is_active !== false);
      } else if (filters?.isActive === false) {
        list = list.filter((c: TaxCategory & { is_active?: boolean }) => (c as any).is_active === false);
      }

      const normalized: TaxCategory[] = list.map((c: any) => ({
        id: String(c.id),
        category_name: String(c.category_name ?? c.name ?? '').trim() || '—',
        tax_rate: Number(c.tax_rate ?? c.default_gst_rate ?? 0),
        description: c.description != null ? String(c.description) : undefined,
        is_active: c.is_active !== false,
        created_at: c.created_at != null ? String(c.created_at) : '',
      }));

      setTaxCategories(normalized);
      setAuthError(false); // Reset auth error on success
    } catch (err: any) {
      // Stop retrying on authentication errors
      if (err?.response?.code === 'AUTH_REQUIRED' || err?.message?.includes('Authentication required') || err?.response?.error === 'Authentication required') {
        setError('Authentication required. Please log in again.');
        setAuthError(true); // Set flag to prevent retries
        setLoading(false);
        return;
      }
      setError(err.message || 'Failed to fetch tax categories');
      console.error('Error fetching tax categories:', err);
    } finally {
      setLoading(false);
    }
  }, [filters?.isActive, authError]);

  useEffect(() => {
    fetchTaxCategories();
  }, [fetchTaxCategories]);

  const createTaxCategory = useCallback(async (data: Partial<TaxCategory> & { name?: string }) => {
    try {
      const name = data.category_name ?? data.name;
      if (!name || !String(name).trim()) {
        throw new Error('Category name is required');
      }
      const taxRate = data.tax_rate ?? 0;
      const response = await apiClient.post<{
        success?: boolean;
        category?: Record<string, unknown>;
        error?: string;
      }>('/admin/finance/gst/tax-categories', {
        name: String(name).trim(),
        description: data.description ?? '',
        defaultGSTRate: taxRate,
        isActive: data.is_active !== false,
      });
      if (response.success === false && response.error) {
        throw new Error(response.error);
      }
      await fetchTaxCategories();
      return mapTaxCategoryRow(response.category) ?? undefined;
    } catch (err: any) {
      const msg =
        err?.responseData?.error ?? err?.response?.error ?? err?.message ?? 'Failed to create tax category';
      throw new Error(typeof msg === 'string' ? msg : 'Failed to create tax category');
    }
  }, [fetchTaxCategories]);

  const updateTaxCategory = useCallback(async (id: string, data: Partial<TaxCategory>) => {
    try {
      const body = taxCategoryToFinanceBody(data);
      const response = await apiClient.put<{
        success?: boolean;
        category?: Record<string, unknown>;
        error?: string;
      }>(`/admin/finance/gst/tax-categories/${id}`, body);
      if (response.success === false && response.error) {
        throw new Error(response.error);
      }
      await fetchTaxCategories();
      return mapTaxCategoryRow(response.category) ?? undefined;
    } catch (err: any) {
      const msg =
        err?.responseData?.error ?? err?.response?.error ?? err?.message ?? 'Failed to update tax category';
      throw new Error(typeof msg === 'string' ? msg : 'Failed to update tax category');
    }
  }, [fetchTaxCategories]);

  const deleteTaxCategory = useCallback(async (id: string) => {
    try {
      const response = await apiClient.delete<{ success?: boolean; error?: string }>(
        `/admin/finance/gst/tax-categories/${id}`
      );
      if (response.success === false && response.error) {
        throw new Error(response.error);
      }
      await fetchTaxCategories();
    } catch (err: any) {
      const msg =
        err?.responseData?.error ?? err?.response?.error ?? err?.message ?? 'Failed to delete tax category';
      throw new Error(typeof msg === 'string' ? msg : 'Failed to delete tax category');
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

