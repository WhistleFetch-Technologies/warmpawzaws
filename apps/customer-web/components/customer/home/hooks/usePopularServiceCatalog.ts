'use client';

import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  POPULAR_SERVICE_CATALOG,
  type PopularServiceCatalogEntry,
} from '../constants/popular-service-catalog';
import {
  filterEntriesByStyleLaunch,
  loadCustomerServiceLaunchCatalog,
} from '@/lib/customer-service-style-launch';

function minPriceFromDiscoverRows(rows: Record<string, unknown>[]): number | undefined {
  let min: number | undefined;
  for (const row of rows) {
    const raw = row.price ?? row.basePrice ?? row.base_price ?? row.salePrice;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (min === undefined || n < min) min = n;
  }
  return min;
}

function extractDiscoverRows(resp: Record<string, unknown> | null): Record<string, unknown>[] {
  if (!resp) return [];
  const list = (resp.services || resp.vendors || []) as Record<string, unknown>[];
  return Array.isArray(list) ? list : [];
}

/**
 * Popular home category cards with optional "from" prices from discover-services min API.
 */
export function usePopularServiceCatalog(phone?: string) {
  const [priceById, setPriceById] = useState<Record<string, number>>({});
  const [launchCatalog, setLaunchCatalog] = useState<
    Awaited<ReturnType<typeof loadCustomerServiceLaunchCatalog>>
  >([]);

  useEffect(() => {
    if (!phone) {
      setLaunchCatalog([]);
      return;
    }
    let cancelled = false;
    void loadCustomerServiceLaunchCatalog(phone).then((catalog) => {
      if (!cancelled) setLaunchCatalog(catalog);
    });
    return () => {
      cancelled = true;
    };
  }, [phone]);

  const visibleCatalog = useMemo(
    () =>
      filterEntriesByStyleLaunch(
        launchCatalog,
        POPULAR_SERVICE_CATALOG.map((entry) => ({
          ...entry,
          discoverCategory: entry.discoverCategory,
          serviceStyle: entry.serviceStyle,
        }))
      ),
    [launchCatalog]
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!visibleCatalog.length) {
        setPriceById({});
        return;
      }
      let locationParams = '';
      if (typeof window !== 'undefined') {
        try {
          const lat = localStorage.getItem('customer_latitude');
          const lng = localStorage.getItem('customer_longitude');
          if (lat && lng) {
            locationParams = `&latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}`;
          }
        } catch {
          /* ignore */
        }
      }
      const phoneParam = phone ? `&phone=${encodeURIComponent(phone)}` : '';

      const results = await Promise.allSettled(
        visibleCatalog.map((entry) =>
          apiClient.get(
            `/customer/discover-services?category=${encodeURIComponent(entry.discoverCategory)}&serviceStyle=${encodeURIComponent(entry.serviceStyle)}${locationParams}${phoneParam}`
          )
        )
      );

      if (cancelled) return;

      const next: Record<string, number> = {};
      results.forEach((result, index) => {
        if (result.status !== 'fulfilled') return;
        const entry = visibleCatalog[index];
        const resp = result.value as Record<string, unknown>;
        const min = minPriceFromDiscoverRows(extractDiscoverRows(resp));
        if (min !== undefined) next[entry.id] = min;
      });
      setPriceById(next);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [phone, visibleCatalog]);

  const items: PopularServiceCatalogEntry[] = useMemo(
    () =>
      visibleCatalog.map((entry) => ({
        ...entry,
        priceFrom: priceById[entry.id],
      })),
    [visibleCatalog, priceById]
  );

  return { items };
}
