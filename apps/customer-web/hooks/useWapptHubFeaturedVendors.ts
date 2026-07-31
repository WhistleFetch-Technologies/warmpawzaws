'use client';

import { useCallback, useMemo } from 'react';
import { useWarmpawzAppointmentsByCategoryFeed } from '@/hooks/useWarmpawzAppointmentsByCategoryFeed';
import { applyWapptHubDiscoveryToProviders } from '@/lib/filter-hub-services';
import {
  buildBoardingVendorListFromRows,
  type BoardingListVendor,
} from '@/lib/boarding-vendor-discovery-map';
import { getWapptDiscoveryCategory } from '@/lib/wappt-hub-registry';

/**
 * WAPPT featured / top-vendor lists — role-based by-category feed (not marketplace discover-services).
 */
export function useWapptHubFeaturedVendors(category: string, enabled = true) {
  const wapptCategory = getWapptDiscoveryCategory(category);

  const feed = useWarmpawzAppointmentsByCategoryFeed({
    category: wapptCategory,
    serviceStyle: 'all',
    enabled,
    pageSize: 3,
  });

  const vendors = useMemo((): BoardingListVendor[] => {
    const filtered = applyWapptHubDiscoveryToProviders(feed.vendors, wapptCategory);
    const { list } = buildBoardingVendorListFromRows(filtered, 'all');
    return list;
  }, [feed.vendors, wapptCategory]);

  const reload = useCallback(() => {
    void feed.reload();
  }, [feed.reload]);

  return {
    loading: feed.loading,
    loadingMore: feed.loadingMore,
    hasMore: feed.hasMore,
    vendors,
    relaxedFilter: false,
    loadMore: feed.loadMore,
    reload,
  };
}
