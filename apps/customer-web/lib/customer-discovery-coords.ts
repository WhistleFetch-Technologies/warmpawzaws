import { apiClient } from '@/lib/api-client';
import { readPersistedLocation, writePersistedLocation } from '@/lib/location-storage';

/** Dispatched when discovery lat/lng change so vendor lists can reload. */
export const LOCATION_UPDATED_EVENT = 'warmpawz:location-updated';

/** Phone for discovery: prop first, then localStorage (parity with api-client / hub). */
export function resolveCustomerDiscoveryPhone(candidate?: string): string {
  const fromArg = (candidate || '').trim();
  if (fromArg.length >= 8) return fromArg;
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem('customerPhone') ||
    localStorage.getItem('customer_phone') ||
    ''
  ).trim();
}

export type CustomerDiscoveryCoordsSource =
  | 'profile'
  | 'localStorage'
  | 'geolocation'
  | 'location_context';

/** Synchronous read of persisted discovery coordinates (no network). */
export function readStoredCustomerDiscoveryCoords(): {
  latitude?: string;
  longitude?: string;
} {
  if (typeof window === 'undefined') return {};
  try {
    const lat = localStorage.getItem('customer_latitude');
    const lng = localStorage.getItem('customer_longitude');
    if (lat && lng) return { latitude: lat, longitude: lng };
  } catch {
    /* ignore */
  }
  return {};
}

export function hasStoredDiscoveryCoords(): boolean {
  const { latitude, longitude } = readStoredCustomerDiscoveryCoords();
  if (!latitude || !longitude) return false;
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function persistDiscoveryCoords(
  latitude: string,
  longitude: string,
  source: CustomerDiscoveryCoordsSource
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('customer_latitude', latitude);
    localStorage.setItem('customer_longitude', longitude);
    const prev = readPersistedLocation();
    writePersistedLocation({
      v: 1,
      latitude: Number(latitude),
      longitude: Number(longitude),
      locality: prev?.locality,
      city: prev?.city,
      pincode: prev?.pincode,
      state: prev?.state,
      accuracyM: prev?.accuracyM,
      timestamp: Date.now(),
      source: source === 'geolocation' || source === 'location_context' ? 'gps' : 'cached',
      permissionState: 'granted',
    });
    window.dispatchEvent(new CustomEvent(LOCATION_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}

/**
 * Discovery coordinates: localStorage → profile API → Capacitor/browser GPS.
 * Persists to legacy keys + warmpawz_location_v1 so guest + authed lists share one source.
 */
export async function resolveCustomerDiscoveryCoords(
  phone?: string,
  options?: { persist?: boolean }
): Promise<{
  latitude?: string;
  longitude?: string;
  source?: CustomerDiscoveryCoordsSource;
}> {
  const persist = options?.persist !== false;
  let latitude: string | undefined;
  let longitude: string | undefined;
  let source: CustomerDiscoveryCoordsSource | undefined;

  const stored = readStoredCustomerDiscoveryCoords();
  if (stored.latitude && stored.longitude) {
    latitude = stored.latitude;
    longitude = stored.longitude;
    source = 'localStorage';
  }

  const ph = (phone || '').trim();
  if (latitude == null && ph.length >= 8) {
    try {
      const profileRes = (await apiClient.get(
        `/customer/profile?phone=${encodeURIComponent(ph)}`
      )) as Record<string, unknown>;
      const profile = (profileRes?.profile as Record<string, unknown>) || profileRes;
      if (profile?.latitude != null && profile?.longitude != null) {
        latitude = String(profile.latitude);
        longitude = String(profile.longitude);
        source = 'profile';
      }
    } catch {
      /* ignore */
    }
  }

  if (latitude == null) {
    try {
      const { resolveCurrentGeolocationCoords } = await import('@/lib/address-from-geolocation');
      const coords = await resolveCurrentGeolocationCoords();
      latitude = String(coords.latitude);
      longitude = String(coords.longitude);
      source = 'geolocation';
    } catch {
      /* permission denied / unavailable — leave unset so UI can show Detect CTA */
    }
  }

  if (
    persist &&
    typeof window !== 'undefined' &&
    latitude != null &&
    longitude != null &&
    source != null &&
    source !== 'localStorage'
  ) {
    persistDiscoveryCoords(latitude, longitude, source);
  }

  return { latitude, longitude, source };
}
