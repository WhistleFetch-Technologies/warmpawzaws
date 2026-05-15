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

function mapHsnRow(row: Record<string, unknown> | null | undefined): HSNCode | null {
  if (!row || row.id == null) return null;
  return {
    id: String(row.id),
    hsn_code: String(row.hsn_code ?? row.code ?? ''),
    description: row.description != null ? String(row.description) : undefined,
    gst_rate: Number(row.gst_rate ?? 0),
    is_active: row.is_active !== false,
    created_at: row.created_at != null ? String(row.created_at) : '',
  };
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

      // Same source as Finance → GST Configuration. Legacy `/admin/hsn-codes` uses SQL on `hsn_code` only and can 500 when DB has `code`; finance route is schema-tolerant.
      const response = await apiClient.get<Record<string, unknown>>('/admin/finance/gst/hsn-codes');
      const raw = (response.hsnCodes ??
        response.codes ??
        (response.data as Record<string, unknown> | undefined)?.hsnCodes) as HSNCode[] | undefined;
      let list = Array.isArray(raw) ? raw : [];

      if (filters?.isActive === true) {
        list = list.filter((h: HSNCode & { is_active?: boolean }) => (h as any).is_active !== false);
      } else if (filters?.isActive === false) {
        list = list.filter((h: HSNCode & { is_active?: boolean }) => (h as any).is_active === false);
      }

      if (filters?.search?.trim()) {
        const q = filters.search.trim().toLowerCase();
        list = list.filter((h: any) => {
          const code = String(h.hsn_code ?? h.code ?? '').toLowerCase();
          const desc = String(h.description ?? '').toLowerCase();
          return code.includes(q) || desc.includes(q);
        });
      }

      const normalized: HSNCode[] = list.map((h: any) => ({
        id: String(h.id),
        hsn_code: String(h.hsn_code ?? h.code ?? ''),
        description: h.description != null ? String(h.description) : undefined,
        gst_rate: Number(h.gst_rate ?? 0),
        is_active: h.is_active !== false,
        created_at: h.created_at != null ? String(h.created_at) : '',
      }));

      setHsnCodes(normalized);
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

  const createHSNCode = useCallback(
    async (data: Partial<HSNCode> & { category_id?: string; categoryId?: string }) => {
      try {
        const codeVal = data.hsn_code ?? (data as { code?: string }).code;
        if (codeVal == null || !String(codeVal).trim()) {
          throw new Error('HSN code is required');
        }
        if (data.gst_rate === undefined || data.gst_rate === null) {
          throw new Error('GST rate is required');
        }
        const categoryId = data.categoryId ?? data.category_id;
        const response = await apiClient.post<{
          success?: boolean;
          code?: Record<string, unknown>;
          error?: string;
        }>('/admin/finance/gst/hsn-codes', {
          code: String(codeVal).trim(),
          description: data.description ?? '',
          gstRate: data.gst_rate,
          categoryId: categoryId != null && String(categoryId).trim() !== '' ? String(categoryId).trim() : undefined,
          isActive: data.is_active !== false,
        });
        if (response.success === false && response.error) {
          throw new Error(response.error);
        }
        await fetchHSNCodes();
        return mapHsnRow(response.code) ?? undefined;
      } catch (err: any) {
        const msg =
          err?.responseData?.error ?? err?.response?.error ?? err?.message ?? 'Failed to create HSN code';
        throw new Error(typeof msg === 'string' ? msg : 'Failed to create HSN code');
      }
    },
    [fetchHSNCodes]
  );

  const updateHSNCode = useCallback(async (id: string, data: Partial<HSNCode>) => {
    try {
      const body: Record<string, unknown> = {};
      if (data.hsn_code !== undefined) body.code = data.hsn_code;
      if (data.description !== undefined) body.description = data.description;
      if (data.gst_rate !== undefined) body.gstRate = data.gst_rate;
      if (data.is_active !== undefined) body.isActive = data.is_active;
      const ext = data as Partial<HSNCode> & { category_id?: string; categoryId?: string };
      if (ext.categoryId !== undefined || ext.category_id !== undefined) {
        const cid = ext.categoryId ?? ext.category_id;
        body.categoryId = cid != null && String(cid).trim() !== '' ? String(cid).trim() : null;
      }

      const response = await apiClient.put<{
        success?: boolean;
        code?: Record<string, unknown>;
        error?: string;
      }>(`/admin/finance/gst/hsn-codes/${id}`, body);
      if (response.success === false && response.error) {
        throw new Error(response.error);
      }
      await fetchHSNCodes();
      return mapHsnRow(response.code) ?? undefined;
    } catch (err: any) {
      const msg =
        err?.responseData?.error ?? err?.response?.error ?? err?.message ?? 'Failed to update HSN code';
      throw new Error(typeof msg === 'string' ? msg : 'Failed to update HSN code');
    }
  }, [fetchHSNCodes]);

  const deleteHSNCode = useCallback(async (id: string) => {
    try {
      const response = await apiClient.delete<{ success?: boolean; error?: string }>(
        `/admin/finance/gst/hsn-codes/${id}`
      );
      if (response.success === false && response.error) {
        throw new Error(response.error);
      }
      await fetchHSNCodes();
    } catch (err: any) {
      const msg =
        err?.responseData?.error ?? err?.response?.error ?? err?.message ?? 'Failed to delete HSN code';
      throw new Error(typeof msg === 'string' ? msg : 'Failed to delete HSN code');
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

