'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  buildWpayVendorsUrl,
  wpayNextCursor,
  wpayVendorsFromResponse,
  type WpayVendorCard,
} from '@/lib/warmpawz-pay/wpay-api';

export function useWpayVendorFeed(opts: {
  category?: string;
  enabled?: boolean;
  pageSize?: number;
}) {
  const { category, enabled = true, pageSize = 5 } = opts;
  const [vendors, setVendors] = useState<WpayVendorCard[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<string | null>(null);

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
        });
        const data = await apiClient.get(url);
        const batch = wpayVendorsFromResponse(data);
        const nc = wpayNextCursor(data);
        cursorRef.current = nc;
        setHasMore(!!nc);
        setVendors((prev) => (append ? [...prev, ...batch] : batch));
        setError(null);
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
    [category, enabled, pageSize]
  );

  useEffect(() => {
    cursorRef.current = null;
    setHasMore(false);
    void loadPage(false);
  }, [loadPage, category]);

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
