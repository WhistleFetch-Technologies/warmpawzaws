'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  VENDOR_PRODUCT_PAGE_SIZE,
  vendorProductListPath,
  type VendorProductServerStatus,
} from '@/lib/vendor-product-list-query';

export interface VendorProductListItem {
  id: string;
  name?: string;
  description?: string;
  price?: number;
  original_price?: number;
  stock?: number;
  stock_quantity?: number;
  sku?: string;
  category_id?: string;
  category?: string;
  status?: string;
  images?: string[];
  emoji?: string;
  is_active?: boolean;
  has_variants?: boolean;
  skus?: Array<{
    id?: string;
    sku?: string;
    stock?: number;
    option_values?: Record<string, string>;
  }>;
  [key: string]: unknown;
}

interface VendorProductListResponse {
  products?: VendorProductListItem[];
  total?: number;
  limit?: number;
  offset?: number;
}

export interface UseVendorProductListOptions {
  sellerId: string;
  mode: 'infinite' | 'paged';
  pageIndex?: number;
  search?: string;
  category?: string;
  serverStatus?: VendorProductServerStatus;
  enabled?: boolean;
}

function dedupeAppend(
  existing: VendorProductListItem[],
  incoming: VendorProductListItem[],
): VendorProductListItem[] {
  const seen = new Set(existing.map((p) => p.id));
  const next = [...existing];
  for (const row of incoming) {
    if (!row.id || seen.has(row.id)) continue;
    seen.add(row.id);
    next.push(row);
  }
  return next;
}

export function useVendorProductList({
  sellerId,
  mode,
  pageIndex = 0,
  search = '',
  category = 'all',
  serverStatus,
  enabled = true,
}: UseVendorProductListOptions) {
  const [products, setProducts] = useState<VendorProductListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const infiniteOffsetRef = useRef(0);
  const refreshTokenRef = useRef(0);

  const filterKey = useMemo(
    () =>
      JSON.stringify({
        sellerId,
        mode,
        pageIndex,
        search: search.trim(),
        category,
        serverStatus: serverStatus ?? null,
      }),
    [sellerId, mode, pageIndex, search, category, serverStatus],
  );

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      if (!sellerId || !enabled) {
        setProducts([]);
        setTotal(0);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const requestId = ++requestIdRef.current;
      const isInitial = !append && offset === 0;

      if (append) {
        setLoadingMore(true);
      } else if (isInitial) {
        setLoading(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const path = vendorProductListPath(sellerId, {
          offset,
          search: search.trim() || undefined,
          category,
          serverStatus,
        });
        const data = await apiClient.get<VendorProductListResponse>(path);

        if (requestId !== requestIdRef.current) return;

        const batch = data?.products ?? [];
        const apiTotal = Number(data?.total ?? batch.length);
        const safeTotal = Number.isFinite(apiTotal) ? apiTotal : batch.length;

        setTotal(safeTotal);

        if (append) {
          setProducts((prev) => dedupeAppend(prev, batch));
          infiniteOffsetRef.current = offset + batch.length;
        } else {
          setProducts(batch);
          infiniteOffsetRef.current = batch.length;
        }
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        console.error('Error loading vendor products:', err);
        setError(err instanceof Error ? err.message : 'Failed to load products');
        if (!append) {
          setProducts([]);
          setTotal(0);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [sellerId, enabled, search, category, serverStatus],
  );

  // Reset and load when filters / mode / page change
  useEffect(() => {
    if (!sellerId || !enabled) {
      setProducts([]);
      setTotal(0);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    infiniteOffsetRef.current = 0;

    if (mode === 'paged') {
      const offset = pageIndex * VENDOR_PRODUCT_PAGE_SIZE;
      void fetchPage(offset, false);
      return;
    }

    void fetchPage(0, false);
  }, [filterKey, sellerId, enabled, mode, pageIndex, fetchPage]);

  const hasMore = products.length < total;

  const loadMore = useCallback(() => {
    if (mode !== 'infinite' || !hasMore || loading || loadingMore) return;
    void fetchPage(infiniteOffsetRef.current, true);
  }, [mode, hasMore, loading, loadingMore, fetchPage]);

  const refresh = useCallback(async () => {
    refreshTokenRef.current += 1;
    if (mode === 'paged') {
      const offset = pageIndex * VENDOR_PRODUCT_PAGE_SIZE;
      await fetchPage(offset, false);
      return;
    }
    infiniteOffsetRef.current = 0;
    await fetchPage(0, false);
  }, [mode, pageIndex, fetchPage]);

  const pageCount = Math.max(1, Math.ceil(total / VENDOR_PRODUCT_PAGE_SIZE));
  const offset = mode === 'paged' ? pageIndex * VENDOR_PRODUCT_PAGE_SIZE : products.length;

  return {
    products,
    total,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
    offset,
    pageCount,
    pageSize: VENDOR_PRODUCT_PAGE_SIZE,
    loadedCount: products.length,
  };
}
