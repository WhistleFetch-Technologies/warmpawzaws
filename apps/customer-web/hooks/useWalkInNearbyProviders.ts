'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDiscoveryVendorFeed } from '@/hooks/useDiscoveryVendorFeed';
import { apiClient } from '@/lib/api-client';
import {
  adaptWpayNearbyVendorsToWalkInProviders,
  buildWpayNearbyVendorsUrl,
  type WpayNearbyVendorDto,
  type WpayNearbyVendorsResponse,
} from '@/lib/adapt-wpay-nearby-vendors';
import { resolveCustomerDiscoveryPhone } from '@/lib/customer-discovery-coords';
import { readHomeSessionCache, writeHomeSessionCache } from '@/lib/home-session-cache';
import type { WalkInProvider } from '@/lib/mergeWalkInDiscoveryBatches';
import {
  sameWalkInCoords,
  walkInLocationCacheToken,
} from '@/lib/walk-in-discovery-location';

export const WALK_IN_NEARBY_CACHE_SUFFIX = 'walk_in_nearby_v4';
const WALK_IN_GEO_CACHE_TOKEN = 'style-v1';
/** Homepage first page size — not a client-side discovery filter. */
export const WALK_IN_NEARBY_HOME_LIMIT = 8;
export const WALK_IN_NEARBY_PAGE_SIZE = 20;
/** @deprecated Use WALK_IN_NEARBY_HOME_LIMIT or WALK_IN_NEARBY_PAGE_SIZE. */
export const WALK_IN_NEARBY_LIMIT = WALK_IN_NEARBY_HOME_LIMIT;
export const WALK_IN_NEARBY_MAX_LIMIT = WALK_IN_NEARBY_PAGE_SIZE;

const STALE_TIME_MS = 5 * 60 * 1000;
const GC_TIME_MS = 10 * 60 * 1000;

export interface CachedWalkInNearby {
  providers: WalkInProvider[];
  latitude: string;
  longitude: string;
  geoToken: string;
  fetchedAt: number;
}

export const walkInNearbyKeys = {
  root: ['walk-in-nearby'] as const,
  list: (opts: { latitude: string; longitude: string; limit: number }) =>
    [
      ...walkInNearbyKeys.root,
      walkInLocationCacheToken(Number(opts.latitude), Number(opts.longitude)),
      WALK_IN_GEO_CACHE_TOKEN,
      opts.limit,
    ] as const,
};

export function walkInProvidersEqual(a: WalkInProvider[], b: WalkInProvider[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (
      left.id !== right.id ||
      left.distanceKm !== right.distanceKm ||
      left.displayName !== right.displayName ||
      left.fromPrice !== right.fromPrice ||
      left.serviceStyle !== right.serviceStyle ||
      left.warmpawzPayEligible !== right.warmpawzPayEligible ||
      left.appointmentEligible !== right.appointmentEligible
    ) {
      return false;
    }
  }
  return true;
}

function sessionSuffix(phone: string, latitude: string, longitude: string) {
  return `${WALK_IN_NEARBY_CACHE_SUFFIX}_${walkInLocationCacheToken(Number(latitude), Number(longitude))}_${WALK_IN_GEO_CACHE_TOKEN}`;
}

function readWalkInSessionCache(
  phone: string,
  latitude: string,
  longitude: string
): CachedWalkInNearby | null {
  const cached = readHomeSessionCache<CachedWalkInNearby>(
    phone,
    sessionSuffix(phone, latitude, longitude)
  );
  if (!cached) return null;
  if (
    !sameWalkInCoords(
      { latitude: Number(cached.latitude), longitude: Number(cached.longitude) },
      { latitude: Number(latitude), longitude: Number(longitude) }
    ) ||
    cached.geoToken !== WALK_IN_GEO_CACHE_TOKEN
  ) {
    return null;
  }
  return cached;
}

export async function fetchWalkInNearbyPage(opts: {
  latitude: string;
  longitude: string;
  phone?: string;
  limit: number;
  cursor?: string;
}): Promise<{ providers: WalkInProvider[]; nextCursor: string | null }> {
  const response = await apiClient.get<WpayNearbyVendorsResponse>(
    buildWpayNearbyVendorsUrl({
      limit: opts.limit,
      latitude: opts.latitude,
      longitude: opts.longitude,
      phone: opts.phone || undefined,
      cursor: opts.cursor,
    })
  );
  return {
    providers: adaptWpayNearbyVendorsToWalkInProviders(response),
    nextCursor: response.nextCursor ?? null,
  };
}

async function fetchWalkInNearbyProviders(
  phone: string,
  latitude: string,
  longitude: string,
  limit: number
): Promise<WalkInProvider[]> {
  const { providers } = await fetchWalkInNearbyPage({
    latitude,
    longitude,
    phone,
    limit,
  });

  const cached = readWalkInSessionCache(phone, latitude, longitude);
  if (cached && walkInProvidersEqual(cached.providers, providers)) {
    return cached.providers;
  }

  writeHomeSessionCache(phone, sessionSuffix(phone, latitude, longitude), {
    providers,
    latitude,
    longitude,
    geoToken: WALK_IN_GEO_CACHE_TOKEN,
    fetchedAt: Date.now(),
  } satisfies CachedWalkInNearby);

  return providers;
}

export interface UseWalkInNearbyProvidersParams {
  phone?: string;
  latitude?: string;
  longitude?: string;
  limit?: number;
  enabled?: boolean;
}

export function useWalkInNearbyProviders(params: UseWalkInNearbyProvidersParams = {}) {
  const { phone, latitude, longitude, limit = WALK_IN_NEARBY_HOME_LIMIT, enabled = true } = params;
  const effectivePhone = resolveCustomerDiscoveryPhone(phone);
  const hasCoords = Boolean(latitude && longitude);
  const sessionCached = useMemo(
    () =>
      hasCoords && latitude && longitude
        ? readWalkInSessionCache(effectivePhone, latitude, longitude)
        : null,
    [effectivePhone, hasCoords, latitude, longitude]
  );

  return useQuery({
    queryKey: walkInNearbyKeys.list({
      latitude: latitude || '',
      longitude: longitude || '',
      limit,
    }),
    enabled: enabled !== false && hasCoords,
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    placeholderData: keepPreviousData,
    initialData: sessionCached?.providers,
    initialDataUpdatedAt: sessionCached?.fetchedAt,
    queryFn: () => fetchWalkInNearbyProviders(effectivePhone, latitude!, longitude!, limit),
  });
}

export function useWalkInNearbyFeed(params: UseWalkInNearbyProvidersParams = {}) {
  const { phone, latitude, longitude, limit = WALK_IN_NEARBY_PAGE_SIZE, enabled = true } = params;
  const hasCoords = Boolean(latitude && longitude);
  const buildUrl = useCallback(
    ({ limit: pageLimit, cursor }: { limit: number; cursor?: string }) =>
      buildWpayNearbyVendorsUrl({
        limit: pageLimit,
        latitude,
        longitude,
        phone,
        cursor,
      }),
    [latitude, longitude, phone]
  );

  const feed = useDiscoveryVendorFeed({
    buildUrl,
    enabled: enabled !== false && hasCoords,
    pageSize: limit,
  });

  useEffect(() => {
    if (enabled === false || !hasCoords) return;
    void feed.reload();
  }, [enabled, hasCoords, latitude, longitude, feed.reload]);

  const providers = useMemo(
    () =>
      adaptWpayNearbyVendorsToWalkInProviders({
        success: true,
        vendors: feed.vendors as WpayNearbyVendorDto[],
      }),
    [feed.vendors]
  );

  return {
    providers,
    isLoading: feed.loading,
    isFetching: feed.loading || feed.loadingMore,
    isError: Boolean(feed.error),
    hasMore: feed.hasMore,
    loadMore: feed.loadMore,
  };
}
