'use client';

import { useCallback } from 'react';
import { useDiscoveryVendorFeed } from '@/hooks/useDiscoveryVendorFeed';
import { discoveryNextCursor, discoveryVendorList } from '@/lib/discovery-list';

export type WapptStyleFilter = 'all' | 'at_center' | 'at_home';

export function useWarmpawzAppointmentsByCategoryFeed(opts: {
  category: string;
  serviceStyle: WapptStyleFilter;
  enabled?: boolean;
  pageSize?: number;
}) {
  const { category, serviceStyle, enabled = true, pageSize = 3 } = opts;

  const buildUrl = useCallback(
    ({ limit, cursor }: { limit: number; cursor?: string }) => {
      const qs = new URLSearchParams({
        category,
        serviceStyle,
        limit: String(limit),
      });
      if (cursor) qs.set('cursor', cursor);
      return `/customer/warmpawz-appointments/discovery/by-category?${qs}`;
    },
    [category, serviceStyle],
  );

  const feed = useDiscoveryVendorFeed({ buildUrl, enabled, pageSize });

  return {
    vendors: feed.vendors,
    loading: feed.loading,
    loadingMore: feed.loadingMore,
    hasMore: feed.hasMore,
    error: feed.error,
    loadMore: feed.loadMore,
    reload: feed.reload,
  };
}

export { discoveryNextCursor, discoveryVendorList };
