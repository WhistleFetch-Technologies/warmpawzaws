'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  resolveCustomerDiscoveryCoords,
  LOCATION_UPDATED_EVENT,
} from '@/lib/customer-discovery-coords';
import { filterHubDiscoveryRowsByRadius } from '@/lib/hub-discovery-radius-filter';
import type { BoardingServiceSlug } from '@/lib/boarding-service-types';
import {
  buildBoardingVendorListFromRows,
  mapServicesApiResponseToPlanRows,
  type BoardingListVendor,
} from '@/lib/boarding-vendor-discovery-map';
import { useDiscoveryVendorFeed } from '@/hooks/useDiscoveryVendorFeed';

export function useBoardingVendorDiscovery(
  phone: string,
  serviceSlug: BoardingServiceSlug
) {
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
      const phoneParam = phone ? `&customerPhone=${encodeURIComponent(phone)}` : '';
      const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
      return `/customer/discover-services?category=boarding&roleId=pet_boarding&serviceStyle=at_center&limit=${limit}${cursorParam}${locationParams}${phoneParam}`;
    },
    [phone]
  );

  const {
    vendors: feedVendors,
    loading: feedLoading,
    loadingMore: feedLoadingMore,
    hasMore: feedHasMore,
    reload: feedReload,
    loadMore: feedLoadMore,
  } = useDiscoveryVendorFeed({ buildUrl, pageSize: 3 });

  const processRows = useCallback(
    (rows: Record<string, unknown>[]) => {
      const { latitude, longitude } = coordsRef.current;
      const filtered = filterHubDiscoveryRowsByRadius(rows, {
        serviceStyle: 'at_center',
        latitude,
        longitude,
      });
      const { list, relaxedFilter: relaxed } = buildBoardingVendorListFromRows(
        filtered,
        serviceSlug
      );
      setRelaxedFilter(relaxed);
      setVendors(list);
    },
    [serviceSlug]
  );

  const loadVendors = useCallback(async () => {
    try {
      setLoading(true);
      const coords = await resolveCustomerDiscoveryCoords(phone);
      coordsRef.current = coords;
      await feedReload();
    } catch (e) {
      console.error('[useBoardingVendorDiscovery]', e);
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }, [phone, feedReload]);

  useEffect(() => {
    processRows(feedVendors);
  }, [feedVendors, processRows]);

  useEffect(() => {
    void loadVendors();
  }, [loadVendors]);

  useEffect(() => {
    const onLoc = () => {
      void loadVendors();
    };
    window.addEventListener(LOCATION_UPDATED_EVENT, onLoc);
    return () => window.removeEventListener(LOCATION_UPDATED_EVENT, onLoc);
  }, [loadVendors]);

  const fetchVendorPlans = useCallback(async (vendorId: string) => {
    setFetchingPlansFor(vendorId);
    try {
      const servicesResponse = await apiClient
        .get(`/customer/vendor/${vendorId}/services?category=boarding`)
        .catch(() => apiClient.get(`/customer/vendor/${vendorId}/services?serviceStyle=at_center`));
      const rows = mapServicesApiResponseToPlanRows(servicesResponse);
      setVendors((prev) =>
        prev.map((v) =>
          v.id === vendorId ? { ...v, planRows: rows, needsServiceFetch: false } : v
        )
      );
    } catch (e) {
      console.error('[useBoardingVendorDiscovery] vendor services fetch failed', e);
    } finally {
      setFetchingPlansFor(null);
    }
  }, []);

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
    loading: loading || feedLoading,
    loadingMore: feedLoadingMore,
    hasMore: feedHasMore,
    loadMore: feedLoadMore,
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
