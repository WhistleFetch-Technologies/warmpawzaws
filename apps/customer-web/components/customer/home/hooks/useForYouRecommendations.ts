'use client';

import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import { readHomeSessionCache, writeHomeSessionCache } from '@/lib/home-session-cache';
import { getCategoryCardImageUrl } from '../constants/category-card-images';
import {
  FOR_YOU_CATALOG,
  type ForYouCatalogEntry,
} from '../constants/for-you-catalog';

export interface ForYouRecommendationItem extends ForYouCatalogEntry {
  serviceId?: string;
}

function mapApiService(raw: Record<string, unknown>, index: number): ForYouRecommendationItem | null {
  const title = String(raw.name || raw.serviceName || '').trim();
  if (!title) return null;
  const screen = String(raw.screen || raw.category || 'vet').trim();
  const catalogMatch =
    FOR_YOU_CATALOG.find((entry) => entry.screen === screen) ||
    FOR_YOU_CATALOG[index % FOR_YOU_CATALOG.length];
  return {
    id: String(raw.id || catalogMatch.id),
    title,
    description: catalogMatch.description,
    screen,
    imageUrl:
      String(raw.imageUrl || raw.image || '').trim() ||
      getCategoryCardImageUrl(screen) ||
      catalogMatch.imageUrl,
    serviceId: raw.id != null ? String(raw.id) : undefined,
  };
}

/** Personalized picks from recommended-services API with static catalog fallback. */
export function useForYouRecommendations(phone?: string) {
  const [apiItems, setApiItems] = useState<ForYouRecommendationItem[]>(() => {
    if (!phone) return [];
    return readHomeSessionCache<ForYouRecommendationItem[]>(phone, 'for_you') ?? [];
  });
  const [loading, setLoading] = useState(() => {
    if (!phone) return false;
    const cached = readHomeSessionCache<ForYouRecommendationItem[]>(phone, 'for_you');
    return !(Array.isArray(cached) && cached.length > 0);
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const hadCache =
        ((phone
          ? readHomeSessionCache<ForYouRecommendationItem[]>(phone, 'for_you')?.length
          : 0) ?? 0) > 0;
      if (!hadCache) setLoading(true);
      if (!phone) {
        setApiItems([]);
        setLoading(false);
        return;
      }
      try {
        const res = await apiClient
          .get<{ services?: Record<string, unknown>[] }>(`/customer/${phone}/recommended-services`)
          .catch(() => null);
        if (cancelled) return;
        const services = res?.services;
        if (Array.isArray(services) && services.length > 0) {
          const mapped = services
            .slice(0, 3)
            .map((row, index) => mapApiService(row, index))
            .filter((row): row is ForYouRecommendationItem => row != null);
          setApiItems(mapped);
          if (mapped.length > 0) writeHomeSessionCache(phone, 'for_you', mapped);
        } else {
          setApiItems([]);
        }
      } catch {
        if (!cancelled) setApiItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [phone]);

  const items = useMemo(
    () => (apiItems.length > 0 ? apiItems : FOR_YOU_CATALOG.slice(0, 3)),
    [apiItems]
  );

  return { items, loading, fromApi: apiItems.length > 0 };
}
