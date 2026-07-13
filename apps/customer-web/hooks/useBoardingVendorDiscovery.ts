'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { resolveCustomerDiscoveryCoords } from '@/lib/customer-discovery-coords';
import { filterHubDiscoveryRowsByRadius } from '@/lib/hub-discovery-radius-filter';
import type { BoardingServiceSlug } from '@/lib/boarding-service-types';
import {
  buildBoardingVendorListFromRows,
  mapServicesApiResponseToPlanRows,
  type BoardingListVendor,
} from '@/lib/boarding-vendor-discovery-map';

export function useBoardingVendorDiscovery(
  phone: string,
  serviceSlug: BoardingServiceSlug
) {
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<BoardingListVendor[]>([]);
  const [relaxedFilter, setRelaxedFilter] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [fetchingPlansFor, setFetchingPlansFor] = useState<string | null>(null);

  const loadVendors = useCallback(async () => {
    try {
      setLoading(true);
      let latitude: string | undefined;
      let longitude: string | undefined;
      const coords = await resolveCustomerDiscoveryCoords(phone);
      latitude = coords.latitude;
      longitude = coords.longitude;
      const locationParams =
        latitude && longitude
          ? `&latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`
          : '';
      const phoneParam = phone ? `&customerPhone=${encodeURIComponent(phone)}` : '';

      let rows: any[] = [];
      try {
        const endpoint = `/customer/discover-services?category=boarding&roleId=pet_boarding&serviceStyle=at_center${locationParams}${phoneParam}`;
        const data = await apiClient.get<any>(endpoint);
        if (Array.isArray(data)) rows = data;
        else if (data?.vendors && Array.isArray(data.vendors)) rows = data.vendors;
        else if (data?.providers && Array.isArray(data.providers)) rows = data.providers;
        else if (data?.services && Array.isArray(data.services)) rows = data.services;
      } catch (e) {
        console.warn('[useBoardingVendorDiscovery] discover-services failed:', e);
      }

      if (rows.length === 0) {
        try {
          const altRes = await apiClient.get<any>(
            `/customer/services/by-style?style=at_center&category=boarding&roleId=pet_boarding${locationParams}${phoneParam}`
          );
          const alt = altRes?.vendors ?? altRes?.providers ?? altRes;
          if (Array.isArray(alt)) rows = alt;
        } catch (e) {
          console.warn('[useBoardingVendorDiscovery] by-style fallback failed:', e);
        }
      }

      rows = filterHubDiscoveryRowsByRadius(rows, {
        serviceStyle: 'at_center',
        latitude,
        longitude,
      });

      const { list, relaxedFilter: relaxed } = buildBoardingVendorListFromRows(rows, serviceSlug);
      setRelaxedFilter(relaxed);
      setVendors(list);
    } catch (e) {
      console.error('[useBoardingVendorDiscovery]', e);
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }, [phone, serviceSlug]);

  useEffect(() => {
    loadVendors();
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
    loading,
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
