/**
 * Authoritative Walk-in discovery location. Independent of generic GPS cache
 * so a selected saved address is not overwritten by stale localStorage/GPS.
 */

export const WALK_IN_DISCOVERY_LOCATION_KEY = 'warmpawz_walk_in_discovery_location_v1';
export const WALK_IN_LOCATION_UPDATED_EVENT = 'warmpawz:walk-in-location-updated';

export type WalkInDiscoveryLocationMode = 'address' | 'current' | 'manual';

export type WalkInDiscoveryLocationV1 = {
  v: 1;
  mode: WalkInDiscoveryLocationMode;
  addressId?: string;
  latitude: number;
  longitude: number;
  label?: string;
  updatedAt: number;
};

export function normalizeWalkInCoord(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function walkInLocationCacheToken(latitude: number, longitude: number): string {
  return `${normalizeWalkInCoord(latitude)}_${normalizeWalkInCoord(longitude)}`;
}

export function sameWalkInCoords(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): boolean {
  return (
    normalizeWalkInCoord(a.latitude) === normalizeWalkInCoord(b.latitude) &&
    normalizeWalkInCoord(a.longitude) === normalizeWalkInCoord(b.longitude)
  );
}

export function readWalkInDiscoveryLocation(): WalkInDiscoveryLocationV1 | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(WALK_IN_DISCOVERY_LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WalkInDiscoveryLocationV1;
    if (
      parsed?.v !== 1 ||
      !Number.isFinite(parsed.latitude) ||
      !Number.isFinite(parsed.longitude)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeWalkInDiscoveryLocation(
  next: Omit<WalkInDiscoveryLocationV1, 'v' | 'updatedAt'>
): WalkInDiscoveryLocationV1 {
  const stored: WalkInDiscoveryLocationV1 = {
    v: 1,
    ...next,
    latitude: Number(next.latitude),
    longitude: Number(next.longitude),
    updatedAt: Date.now(),
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(WALK_IN_DISCOVERY_LOCATION_KEY, JSON.stringify(stored));
      window.dispatchEvent(new CustomEvent(WALK_IN_LOCATION_UPDATED_EVENT));
    } catch {
      /* quota */
    }
  }
  return stored;
}
