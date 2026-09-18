'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useDiscoveryVendorFeed } from '@/hooks/useDiscoveryVendorFeed';
import { discoveryNextCursor, discoveryVendorList } from '@/lib/discovery-list';
import { resolveCustomerDiscoveryCoords } from '@/lib/customer-discovery-coords';
import { buildWapptByCategoryFeedUrl } from '@/lib/wappt-discovery-feed-url';

export type WapptStyleFilter = 'all' | 'at_center' | 'at_home' | 'tele';

export function useWarmpawzAppointmentsByCategoryFeed(opts: {
  category: string;
  serviceStyle: WapptStyleFilter;
  specialization?: string;
  enabled?: boolean;
  pageSize?: number;
}) {
  const { category, serviceStyle, specialization, enabled = true, pageSize = 3 } = opts;
  const coordsRef = useRef<{ latitude?: string; longitude?: string }>({});

  const buildUrl = useCallback(
    ({ limit, cursor }: { limit: number; cursor?: string }) => {
      return buildWapptByCategoryFeedUrl({
        category,
        serviceStyle,
        limit,
        cursor,
        specialization,
        latitude: coordsRef.current.latitude,
        longitude: coordsRef.current.longitude,
      });
    },
    [category, serviceStyle, specialization],
  );

  const feed = useDiscoveryVendorFeed({ buildUrl, enabled, pageSize });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      const coords = await resolveCustomerDiscoveryCoords();
      if (cancelled) return;
      coordsRef.current = coords;
      await feed.reload();
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, category, serviceStyle, specialization, feed.reload]);

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
