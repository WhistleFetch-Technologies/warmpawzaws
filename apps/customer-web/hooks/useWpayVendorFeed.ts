'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  buildWpayVendorsUrl,
  wpayNextCursor,
  wpayResolvedCategory,
  wpayVendorsFromResponse,
  type WpayVendorCard,
} from '@/lib/warmpawz-pay/wpay-api';
import { mapServiceKeyToWpayCategory } from '@/lib/commerce-switch-routing/map-service-to-wpay-category';

export function useWpayVendorFeed(opts: {
  category?: string;
  q?: string;
  enabled?: boolean;
  pageSize?: number;
  onResolvedCategory?: (categoryId: string | null) => void;
}) {
  const { category, q, enabled = true, pageSize = 5, onResolvedCategory } = opts;
  const [vendors, setVendors] = useState<WpayVendorCard[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const onResolvedCategoryRef = useRef(onResolvedCategory);
  onResolvedCategoryRef.current = onResolvedCategory;

  const loadPage = useCallback(
    async (append: boolean) => {
      if (!enabled) return;
      if (append && !cursorRef.current) return;
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);
        const url = buildWpayVendorsUrl({
          limit: pageSize,
          cursor: append ? cursorRef.current ?? undefined : undefined,
          category,
          q,
        });
        const data = await apiClient.get(url);
        const batch = wpayVendorsFromResponse(data);
        const nc = wpayNextCursor(data);
        cursorRef.current = nc;
        setHasMore(!!nc);
        setVendors((prev) => (append ? [...prev, ...batch] : batch));
        setError(null);

        if (!append && q?.trim()) {
          const resolved = wpayResolvedCategory(data);
          const chipId = resolved ? mapServiceKeyToWpayCategory(resolved) : null;
          onResolvedCategoryRef.current?.(chipId === 'all' ? null : chipId);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load vendors';
        setError(msg);
        if (!append) setVendors([]);
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [category, enabled, pageSize, q]
  );

  useEffect(() => {
    cursorRef.current = null;
    setHasMore(false);
    void loadPage(false);
  }, [loadPage, category, q]);

  const loadMore = useCallback(() => {
    if (!cursorRef.current || loadingMore) return;
    return loadPage(true);
  }, [loadPage, loadingMore]);

  return {
    vendors,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    reload: () => loadPage(false),
  };
}
