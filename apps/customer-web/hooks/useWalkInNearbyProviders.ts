'use client';

import { useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  adaptWpayNearbyVendorsToWalkInProviders,
  buildWpayNearbyVendorsUrl,
  type WpayNearbyVendorsResponse,
} from '@/lib/adapt-wpay-nearby-vendors';
import {
  resolveCustomerDiscoveryCoords,
  resolveCustomerDiscoveryPhone,
} from '@/lib/customer-discovery-coords';
import { readHomeSessionCache, writeHomeSessionCache } from '@/lib/home-session-cache';
import type { WalkInProvider } from '@/lib/mergeWalkInDiscoveryBatches';

export const WALK_IN_NEARBY_CACHE_SUFFIX = 'walk_in_nearby';
/** Home carousel cap — full nearby list uses {@link WALK_IN_NEARBY_MAX_LIMIT}. */
export const WALK_IN_NEARBY_HOME_LIMIT = 8;
/** Backend GET /customer/warmpawz-pay/vendors/nearby MAX_LIMIT. */
export const WALK_IN_NEARBY_MAX_LIMIT = 20;
/** @deprecated Use WALK_IN_NEARBY_HOME_LIMIT or WALK_IN_NEARBY_MAX_LIMIT. */
export const WALK_IN_NEARBY_LIMIT = WALK_IN_NEARBY_HOME_LIMIT;

const STALE_TIME_MS = 5 * 60 * 1000;
const GC_TIME_MS = 10 * 60 * 1000;

export interface CachedWalkInNearby {
  providers: WalkInProvider[];
  latitude: string;
  longitude: string;
  fetchedAt: number;
}

export const walkInNearbyKeys = {
  root: ['walk-in-nearby'] as const,
  list: (phone: string) => [...walkInNearbyKeys.root, phone] as const,
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
      left.fromPrice !== right.fromPrice
    ) {
      return false;
    }
  }
  return true;
}

function readWalkInSessionCache(phone: string): CachedWalkInNearby | null {
  return readHomeSessionCache<CachedWalkInNearby>(phone, WALK_IN_NEARBY_CACHE_SUFFIX);
}

async function fetchWalkInNearbyProviders(phone: string): Promise<WalkInProvider[]> {
  const { latitude, longitude } = await resolveCustomerDiscoveryCoords(phone);
  if (!latitude || !longitude) return [];

  const response = await apiClient.get<WpayNearbyVendorsResponse>(
    buildWpayNearbyVendorsUrl({
      limit: WALK_IN_NEARBY_MAX_LIMIT,
      latitude,
      longitude,
      phone: phone || undefined,
    })
  );

  const mapped = adaptWpayNearbyVendorsToWalkInProviders(response, {
    limit: WALK_IN_NEARBY_MAX_LIMIT,
  });

  const cached = readWalkInSessionCache(phone);
  if (cached && walkInProvidersEqual(cached.providers, mapped)) {
    return cached.providers;
  }

  writeHomeSessionCache(phone, WALK_IN_NEARBY_CACHE_SUFFIX, {
    providers: mapped,
    latitude,
    longitude,
    fetchedAt: Date.now(),
  } satisfies CachedWalkInNearby);

  return mapped;
}

export interface UseWalkInNearbyProvidersParams {
  phone?: string;
  enabled?: boolean;
}

export function useWalkInNearbyProviders(params: UseWalkInNearbyProvidersParams = {}) {
  const { phone, enabled = true } = params;
  const effectivePhone = resolveCustomerDiscoveryPhone(phone);
  const sessionCached = useMemo(
    () => (effectivePhone ? readWalkInSessionCache(effectivePhone) : null),
    [effectivePhone]
  );

  return useQuery({
    queryKey: walkInNearbyKeys.list(effectivePhone),
    enabled: enabled !== false,
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: keepPreviousData,
    initialData: sessionCached?.providers,
    initialDataUpdatedAt: sessionCached?.fetchedAt,
    queryFn: () => fetchWalkInNearbyProviders(effectivePhone),
  });
}
