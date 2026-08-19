'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  resolveCustomerDiscoveryCoords,
  LOCATION_UPDATED_EVENT,
} from '@/lib/customer-discovery-coords';
import { filterHubDiscoveryRowsByRadius } from '@/lib/hub-discovery-radius-filter';
import {
  buildBoardingVendorListFromRows,
  mapServicesApiResponseToPlanRows,
  type BoardingListVendor,
} from '@/lib/boarding-vendor-discovery-map';
import type { HubVendorDiscoveryConfig } from '@/lib/service-hub-discovery-config';
import {
  filterPlanRowsForVetHub,
  filterVetHubProviderRows,
  isVetHubDiscoveryConfig,
} from '@/lib/filter-hub-services';
import { useDiscoveryVendorFeed } from '@/hooks/useDiscoveryVendorFeed';

function rowsToHubVendors(
  rows: Record<string, unknown>[],
  config: HubVendorDiscoveryConfig,
  latitude?: string,
  longitude?: string
): { list: BoardingListVendor[]; relaxed: boolean } {
  const filtered = filterHubDiscoveryRowsByRadius(rows, {
    serviceStyle: config.serviceStyle,
    latitude,
    longitude,
    sittingRelaxed: config.discoverCategory === 'sitting',
  });
  const vetFiltered = isVetHubDiscoveryConfig(config)
    ? filterVetHubProviderRows(filtered)
    : filtered;
  const { list, relaxedFilter: relaxed } = buildBoardingVendorListFromRows(vetFiltered, 'all');
  const finalList = isVetHubDiscoveryConfig(config)
    ? list
        .map((v) => ({ ...v, planRows: filterPlanRowsForVetHub(v.planRows) }))
        .filter((v) => {
          if (v.planRows.length > 0) return true;
          // Lean discover-services cards omit embedded services; keep for lazy expand.
          return v.needsServiceFetch;
        })
    : list;
  return { list: finalList, relaxed };
}

/**
 * Shared hub discovery with cursor-paginated vendor feed.
 */
export function useHubVendorDiscovery(
  phone: string,
  config: HubVendorDiscoveryConfig,
  customLoadRows?: () => Promise<Record<string, unknown>[]>
) {
  const customLoadRef = useRef(customLoadRows);
  customLoadRef.current = customLoadRows;

  const [vendors, setVendors] = useState<BoardingListVendor[]>([]);
  const [relaxedFilter, setRelaxedFilter] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [fetchingPlansFor, setFetchingPlansFor] = useState<string | null>(null);
  const coordsRef = useRef<{ latitude?: string; longitude?: string }>({});

  const buildUrl = useCallback(
    ({ limit, cursor }: { limit: number; cursor?: string }) => {
      const { latitude, longitude } = coordsRef.current;
      const locationParams =
        latitude && longitude
          ? `&latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`
          : '';
      const phoneKey = config.phoneQueryParam === 'phone' ? 'phone' : 'customerPhone';
      const phoneParam = phone ? `&${phoneKey}=${encodeURIComponent(phone)}` : '';
      const specParam = config.specialization
        ? `&specialization=${encodeURIComponent(config.specialization)}`
        : '';
      const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
      let endpoint = `/customer/discover-services?category=${encodeURIComponent(config.discoverCategory)}&serviceStyle=${config.serviceStyle}&limit=${limit}${cursorParam}${locationParams}${phoneParam}${specParam}`;
      if (config.discoverRoleId) {
        endpoint += `&roleId=${encodeURIComponent(config.discoverRoleId)}`;
      }
      return endpoint;
    },
    [config, phone]
  );

  const {
    vendors: feedVendors,
    loading: feedLoading,
    loadingMore: feedLoadingMore,
    hasMore: feedHasMore,
    reload: feedReload,
    loadMore: feedLoadMore,
  } = useDiscoveryVendorFeed({
    buildUrl,
    pageSize: 3,
    enabled: !customLoadRows,
  });

  const processFeedRows = useCallback(
    (rows: Record<string, unknown>[]) => {
      const { latitude, longitude } = coordsRef.current;
      const { list, relaxed } = rowsToHubVendors(rows, config, latitude, longitude);
      setRelaxedFilter(relaxed);
      setVendors(list);
    },
    [config]
  );

  const loadVendors = useCallback(async () => {
    if (customLoadRef.current) {
      try {
        setLoading(true);
        const coords = await resolveCustomerDiscoveryCoords(phone);
        coordsRef.current = coords;
        const rows = await customLoadRef.current();
        processFeedRows(rows);
      } catch (e) {
        console.error('[useHubVendorDiscovery]', e);
        setVendors([]);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);
      const coords = await resolveCustomerDiscoveryCoords(phone);
      coordsRef.current = coords;
      await feedReload();
    } catch (e) {
      console.error('[useHubVendorDiscovery]', e);
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }, [phone, feedReload, processFeedRows]);

  useEffect(() => {
    if (!customLoadRows) {
      processFeedRows(feedVendors);
    }
  }, [customLoadRows, feedVendors, processFeedRows]);

  useEffect(() => {
    loadVendors();
  }, [
    config.discoverCategory,
    config.serviceStyle,
    config.discoverRoleId,
    config.specialization,
    phone,
    customLoadRows,
    loadVendors,
  ]);

  useEffect(() => {
    const onLoc = () => {
      void loadVendors();
    };
    window.addEventListener(LOCATION_UPDATED_EVENT, onLoc);
    return () => window.removeEventListener(LOCATION_UPDATED_EVENT, onLoc);
  }, [loadVendors]);

  const loadMore = useCallback(async () => {
    if (customLoadRef.current) return;
    await feedLoadMore();
  }, [feedLoadMore]);

  const fetchVendorPlans = useCallback(
    async (vendorId: string) => {
      setFetchingPlansFor(vendorId);
      try {
        const servicesResponse = await apiClient
          .get(`/customer/vendor/${vendorId}/services?category=${encodeURIComponent(config.servicesApiCategory)}`)
          .catch(() =>
            apiClient.get(
              `/customer/vendor/${vendorId}/services?serviceStyle=${encodeURIComponent(config.serviceStyle)}`
            )
          );
        const mapped = mapServicesApiResponseToPlanRows(servicesResponse);
        const rows = isVetHubDiscoveryConfig(config)
          ? filterPlanRowsForVetHub(mapped)
          : mapped;
        setVendors((prev) =>
          prev.map((v) =>
            v.id === vendorId ? { ...v, planRows: rows, needsServiceFetch: false } : v
          )
        );
      } catch (e) {
        console.error('[useHubVendorDiscovery] vendor services fetch failed', e);
      } finally {
        setFetchingPlansFor(null);
      }
    },
    [config.servicesApiCategory, config.serviceStyle]
  );

  useEffect(() => {
    if (!selectedVendorId) return;
    const v = vendors.find((x) => x.id === selectedVendorId);
    if (!v || !v.needsServiceFetch || v.planRows.length > 0) return;
    if (fetchingPlansFor === selectedVendorId) return;
    fetchVendorPlans(selectedVendorId);
  }, [selectedVendorId, vendors, fetchingPlansFor, fetchVendorPlans]);

  const toggleVendor = useCallback((vendorId: string) => {
    setSelectedVendorId((prev) => (prev === vendorId ? null : vendorId));
  }, []);

  return {
    loading: customLoadRows ? loading : loading || feedLoading,
    loadingMore: feedLoadingMore,
    hasMore: customLoadRows ? false : feedHasMore,
    loadMore,
    vendors,
    relaxedFilter,
    selectedVendorId,
    setSelectedVendorId,
    toggleVendor,
    fetchingPlansFor,
    loadVendors,
    fetchVendorPlans,
    setVendors,
  };
}
