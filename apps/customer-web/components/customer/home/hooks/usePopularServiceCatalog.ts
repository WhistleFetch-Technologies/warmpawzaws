'use client';

import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  POPULAR_SERVICE_CATALOG,
  type PopularServiceCatalogEntry,
} from '../constants/popular-service-catalog';

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

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
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
        POPULAR_SERVICE_CATALOG.map((entry) =>
          apiClient.get(
            `/customer/discover-services?category=${encodeURIComponent(entry.discoverCategory)}&serviceStyle=${encodeURIComponent(entry.serviceStyle)}${locationParams}${phoneParam}`
          )
        )
      );

      if (cancelled) return;

      const next: Record<string, number> = {};
      results.forEach((result, index) => {
        if (result.status !== 'fulfilled') return;
        const entry = POPULAR_SERVICE_CATALOG[index];
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
  }, [phone]);

  const items: PopularServiceCatalogEntry[] = useMemo(
    () =>
      POPULAR_SERVICE_CATALOG.map((entry) => ({
        ...entry,
        priceFrom: priceById[entry.id],
      })),
    [priceById]
  );

  return { items };
}
