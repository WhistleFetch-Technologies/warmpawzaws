/**
 * Persist latest known location for UX continuity.
 * Cached coords are never presented as live GPS without freshness checks.
 */

import type { LocationPermissionState, LocationSource } from './location-constants';

export const LOCATION_STORAGE_KEY = 'warmpawz_location_v1';

export type PersistedLocationV1 = {
  v: 1;
  latitude: number | null;
  longitude: number | null;
  locality?: string;
  city?: string;
  pincode?: string;
  state?: string;
  accuracyM?: number | null;
  /** When coordinates were obtained (ms epoch) — location_updated_at */
  timestamp: number;
  source: LocationSource;
  permissionState?: LocationPermissionState;
};

function isFiniteCoord(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/** Migrate legacy customer_latitude / customer_longitude into v1 shape. */
export function migrateLegacyLocationCache(): PersistedLocationV1 | null {
  if (typeof window === 'undefined') return null;
  try {
    const latRaw = localStorage.getItem('customer_latitude');
    const lngRaw = localStorage.getItem('customer_longitude');
    if (latRaw == null || lngRaw == null) return null;
    const latitude = Number(latRaw);
    const longitude = Number(lngRaw);
    if (!isFiniteCoord(latitude) || !isFiniteCoord(longitude)) return null;
    return {
      v: 1,
      latitude,
      longitude,
      timestamp: Date.now(),
      source: 'cached',
      permissionState: 'unknown',
    };
  } catch {
    return null;
  }
}

export function readPersistedLocation(): PersistedLocationV1 | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedLocationV1;
      if (parsed?.v === 1) return parsed;
    }
    const legacy = migrateLegacyLocationCache();
    if (legacy) {
      writePersistedLocation(legacy);
      return legacy;
    }
  } catch {
    // ignore
  }
  return null;
}

export function writePersistedLocation(loc: PersistedLocationV1): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(loc));
    // Keep legacy keys in sync for existing discovery consumers until Phase 2.
    if (isFiniteCoord(loc.latitude) && isFiniteCoord(loc.longitude)) {
      localStorage.setItem('customer_latitude', String(loc.latitude));
      localStorage.setItem('customer_longitude', String(loc.longitude));
    }
  } catch {
    // ignore quota / private mode
  }
}

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
