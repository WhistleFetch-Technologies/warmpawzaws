'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { discoveryNextCursor, discoveryVendorList } from '@/lib/discovery-list';
import {
  extractImageFieldsFromRow,
  logDiscoveryImageStage,
} from '@/lib/warmpawz-pay/debug-log-discovery-image';

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
        const binduRaw = batch.find((row) =>
          /bindu vet clinic/i.test(String(row.name ?? row.businessName ?? '')),
        );
        if (binduRaw) {
          logDiscoveryImageStage('rawAppointmentDiscoveryApiRow', {
            vendorName: binduRaw.name ?? binduRaw.businessName,
            fullRow: binduRaw,
            imageFields: extractImageFieldsFromRow(binduRaw),
          });
        }
        if (!binduRaw && batch.length > 0) {
          const first = batch[0];
          logDiscoveryImageStage('rawAppointmentDiscoveryApiRow.firstProvider', {
            vendorName: first.name ?? first.businessName,
            fullRow: first,
            imageFields: extractImageFieldsFromRow(first),
          });
        }
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
