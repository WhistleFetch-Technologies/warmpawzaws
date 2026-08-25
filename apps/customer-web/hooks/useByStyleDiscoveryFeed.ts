'use client';

import { useCallback, useEffect, useRef } from 'react';
import { resolveCustomerDiscoveryCoords } from '@/lib/customer-discovery-coords';
import { useDiscoveryVendorFeed } from '@/hooks/useDiscoveryVendorFeed';

export type UseByStyleDiscoveryFeedOptions = {
  phone: string;
  serviceStyle: string;
  category: string;
  roleId?: string;
  specialization?: string;
  problemTitle?: string;
  /** Extra query params (sortBy, minRating, maxDistance, …) */
  queryExtras?: Record<string, string | number | undefined | null>;
  enabled?: boolean;
  pageSize?: number;
};

/**
 * Cursor-paginated GET /customer/services/by-style feed.
 */
export function useByStyleDiscoveryFeed({
  phone,
  serviceStyle,
  category,
  roleId,
  specialization,
  problemTitle,
  queryExtras,
  enabled = true,
  pageSize = 3,
}: UseByStyleDiscoveryFeedOptions) {
  const coordsRef = useRef<{ latitude?: string; longitude?: string }>({});

  const buildUrl = useCallback(
    ({ limit, cursor }: { limit: number; cursor?: string }) => {
      const { latitude, longitude } = coordsRef.current;
      const locationParams =
        latitude && longitude
          ? `&latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`
          : '';
      const phoneParam = phone ? `&customerPhone=${encodeURIComponent(phone)}` : '';
      const roleParam = roleId ? `&roleId=${encodeURIComponent(roleId)}` : '';
      const specParam = specialization
        ? `&specialization=${encodeURIComponent(specialization)}`
        : '';
      const problemParam = problemTitle
        ? `&problemTitle=${encodeURIComponent(problemTitle)}`
        : '';
      const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
      let extra = '';
      if (queryExtras) {
        for (const [k, v] of Object.entries(queryExtras)) {
          if (v != null && String(v).trim() !== '') {
            extra += `&${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`;
          }
        }
      }
      return `/customer/services/by-style?style=${encodeURIComponent(serviceStyle)}&category=${encodeURIComponent(category)}&limit=${limit}${cursorParam}${locationParams}${phoneParam}${roleParam}${specParam}${problemParam}${extra}`;
    },
    [phone, serviceStyle, category, roleId, specialization, problemTitle, queryExtras]
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

  const queryExtrasKey = JSON.stringify(queryExtras ?? {});

  useEffect(() => {
    void reloadWithCoords();
  }, [
    enabled,
    phone,
    serviceStyle,
    category,
    roleId,
    specialization,
    problemTitle,
    queryExtrasKey,
    reloadWithCoords,
  ]);

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
