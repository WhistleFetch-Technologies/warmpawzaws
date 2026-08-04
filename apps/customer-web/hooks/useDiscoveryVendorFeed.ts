'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { discoveryNextCursor, discoveryVendorList } from '@/lib/discovery-list';

export type UseDiscoveryVendorFeedOptions = {
  /** Build URL without limit/cursor — hook appends pagination. */
  buildUrl: (base: { limit: number; cursor?: string }) => string;
  enabled?: boolean;
  pageSize?: number;
};

export function useDiscoveryVendorFeed({
  buildUrl,
  enabled = true,
  pageSize = 3,
}: UseDiscoveryVendorFeedOptions) {
  const [vendors, setVendors] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);

  useEffect(() => {
    if (enabled) setLoading(true);
  }, [enabled]);

  const reset = useCallback(() => {
    cursorRef.current = null;
    setVendors([]);
    setNextCursor(null);
    setError(null);
  }, []);

  const loadPage = useCallback(
    async (append: boolean) => {
      if (!enabled) return;
      const cursor = append ? cursorRef.current : null;
      if (append && !cursor) return;
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);
        const url = buildUrl({ limit: pageSize, cursor: cursor ?? undefined });
        const data = await apiClient.get<Record<string, unknown>>(url);
        const batch = discoveryVendorList(data);
        const nc = discoveryNextCursor(data);
        cursorRef.current = nc;
        setNextCursor(nc);
        setVendors((prev) => (append ? [...prev, ...batch] : batch));
        setError(null);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load vendors';
        setError(msg);
        if (!append) setVendors([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [buildUrl, enabled, pageSize]
  );

  const reload = useCallback(() => {
    cursorRef.current = null;
    return loadPage(false);
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (!cursorRef.current || loadingMore) return;
    return loadPage(true);
  }, [loadPage, loadingMore]);

  return {
    vendors,
    loading,
    loadingMore,
    nextCursor,
    hasMore: !!nextCursor,
    error,
    reload,
    loadMore,
    reset,
  };
}
