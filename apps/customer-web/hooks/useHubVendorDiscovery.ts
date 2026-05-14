'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  buildBoardingVendorListFromRows,
  mapServicesApiResponseToPlanRows,
  type BoardingListVendor,
} from '@/lib/boarding-vendor-discovery-map';
import type { HubVendorDiscoveryConfig } from '@/lib/service-hub-discovery-config';

function extractRows(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data?.vendors && Array.isArray(data.vendors)) return data.vendors;
  if (data?.providers && Array.isArray(data.providers)) return data.providers;
  if (data?.services && Array.isArray(data.services)) return data.services;
  if (data?.results && Array.isArray(data.results)) return data.results;
  if (data?.data && Array.isArray(data.data)) return data.data;
  return [];
}

/**
 * Shared hub discovery: same vendor rows + plan expansion as Pet Boarding,
 * for grooming, training, vet, and pet sitting hubs.
 */
export function useHubVendorDiscovery(
  phone: string,
  config: HubVendorDiscoveryConfig,
  customLoadRows?: () => Promise<any[]>
) {
  const customLoadRef = useRef(customLoadRows);
  customLoadRef.current = customLoadRows;

  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<BoardingListVendor[]>([]);
  const [relaxedFilter, setRelaxedFilter] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [fetchingPlansFor, setFetchingPlansFor] = useState<string | null>(null);

  const loadVendors = useCallback(async () => {
    try {
      setLoading(true);
      let rows: any[] = [];

      if (customLoadRef.current) {
        rows = await customLoadRef.current();
      } else {
        let latitude: string | undefined;
        let longitude: string | undefined;
        try {
          const profileRes = (await apiClient.get(
            `/customer/profile?phone=${encodeURIComponent(phone)}`
          )) as any;
          const profile = profileRes?.profile || profileRes;
          if (profile?.latitude != null && profile?.longitude != null) {
            latitude = String(profile.latitude);
            longitude = String(profile.longitude);
          }
        } catch {
          /* ignore */
        }
        if (latitude == null && typeof window !== 'undefined') {
          try {
            const lat = localStorage.getItem('customer_latitude');
            const lng = localStorage.getItem('customer_longitude');
            if (lat && lng) {
              latitude = lat;
              longitude = lng;
            }
          } catch {
            /* ignore */
          }
        }
        if (latitude == null && typeof navigator !== 'undefined' && navigator.geolocation) {
          try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 5000,
                maximumAge: 300000,
              });
            });
            latitude = String(pos.coords.latitude);
            longitude = String(pos.coords.longitude);
          } catch {
            /* ignore */
          }
        }
        const locationParams =
          latitude && longitude
            ? `&latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`
            : '';

        const phoneKey = config.phoneQueryParam === 'phone' ? 'phone' : 'customerPhone';
        const phoneParam = phone ? `&${phoneKey}=${encodeURIComponent(phone)}` : '';
        const specParam = config.specialization
          ? `&specialization=${encodeURIComponent(config.specialization)}`
          : '';

        let endpoint = `/customer/discover-services?category=${encodeURIComponent(config.discoverCategory)}&serviceStyle=${config.serviceStyle}${locationParams}${phoneParam}${specParam}`;
        if (config.discoverRoleId) {
          endpoint += `&roleId=${encodeURIComponent(config.discoverRoleId)}`;
        }

        try {
          const data = await apiClient.get<any>(endpoint);
          rows = extractRows(data);
        } catch (e) {
          console.warn('[useHubVendorDiscovery] discover-services failed:', e);
        }

        if (rows.length === 0 && config.fallbackByStyle) {
          try {
            let altUrl = `/customer/services/by-style?style=${encodeURIComponent(config.fallbackByStyle.style)}&category=${encodeURIComponent(config.fallbackByStyle.category)}${locationParams}${phoneParam}${specParam}`;
            if (config.fallbackByStyle.roleId) {
              altUrl += `&roleId=${encodeURIComponent(config.fallbackByStyle.roleId)}`;
            }
            const altRes = await apiClient.get<any>(altUrl);
            const alt = altRes?.vendors ?? altRes?.providers ?? altRes;
            if (Array.isArray(alt)) rows = alt;
            else if (alt?.services && Array.isArray(alt.services)) rows = alt.services;
          } catch (e) {
            console.warn('[useHubVendorDiscovery] by-style fallback failed:', e);
          }
        }

        if (rows.length === 0 && config.fallbackVendorSearch) {
          try {
            const lim = config.fallbackVendorSearch.limit ?? 50;
            const vs = await apiClient.get<any>(
              `/customer/vendors/search?roleId=${encodeURIComponent(config.fallbackVendorSearch.roleId)}&limit=${lim}${locationParams}`
            );
            if (Array.isArray(vs)) rows = vs;
            else if (vs?.vendors && Array.isArray(vs.vendors)) rows = vs.vendors;
            else if (vs?.results && Array.isArray(vs.results)) rows = vs.results;
          } catch (e) {
            console.warn('[useHubVendorDiscovery] vendors/search failed:', e);
          }
        }
      }

      const { list, relaxedFilter: relaxed } = buildBoardingVendorListFromRows(rows, 'all');
      setRelaxedFilter(relaxed);
      setVendors(list);
    } catch (e) {
      console.error('[useHubVendorDiscovery]', e);
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }, [phone, config]);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

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
        const rows = mapServicesApiResponseToPlanRows(servicesResponse);
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
