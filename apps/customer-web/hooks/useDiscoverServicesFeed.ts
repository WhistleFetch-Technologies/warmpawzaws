'use client';

import { useCallback, useEffect, useRef } from 'react';
import { resolveCustomerDiscoveryCoords } from '@/lib/customer-discovery-coords';
import { useDiscoveryVendorFeed } from '@/hooks/useDiscoveryVendorFeed';

export type UseDiscoverServicesFeedOptions = {
  phone: string;
  category: string;
  serviceStyle: string;
  roleId?: string;
  specialization?: string;
  enabled?: boolean;
  pageSize?: number;
};

/**
 * Cursor-paginated GET /customer/discover-services feed.
 */
export function useDiscoverServicesFeed({
  phone,
  category,
  serviceStyle,
  roleId,
  specialization,
  enabled = true,
  pageSize = 3,
}: UseDiscoverServicesFeedOptions) {
  const coordsRef = useRef<{ latitude?: string; longitude?: string }>({});

  const buildUrl = useCallback(
    ({ limit, cursor }: { limit: number; cursor?: string }) => {
      const { latitude, longitude } = coordsRef.current;
      const locationParams =
        latitude && longitude
          ? `&latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`
          : '';
      const phoneParam = phone ? `&phone=${encodeURIComponent(phone)}` : '';
      const roleParam = roleId ? `&roleId=${encodeURIComponent(roleId)}` : '';
      const specParam = specialization
        ? `&specialization=${encodeURIComponent(specialization)}`
        : '';
      const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
      return `/customer/discover-services?category=${encodeURIComponent(category)}&serviceStyle=${encodeURIComponent(serviceStyle)}&limit=${limit}${cursorParam}${locationParams}${phoneParam}${roleParam}${specParam}`;
    },
    [phone, category, serviceStyle, roleId, specialization]
  );

  const {
    vendors: feedVendors,
    loading: feedLoading,
    loadingMore: feedLoadingMore,
    hasMore: feedHasMore,
    reload: feedReload,
    loadMore: feedLoadMore,
    error: feedError,
  } = useDiscoveryVendorFeed({ buildUrl, pageSize, enabled });

  const reloadWithCoords = useCallback(async () => {
    if (!enabled) return;
    const coords = await resolveCustomerDiscoveryCoords(phone);
    coordsRef.current = coords;
    await feedReload();
  }, [enabled, feedReload, phone]);

  useEffect(() => {
    void reloadWithCoords();
  }, [enabled, phone, category, serviceStyle, roleId, specialization, reloadWithCoords]);

  return {
    rows: feedVendors,
    loading: feedLoading,
    loadingMore: feedLoadingMore,
    hasMore: feedHasMore,
    loadMore: feedLoadMore,
    reload: reloadWithCoords,
    error: feedError,
  };
}
