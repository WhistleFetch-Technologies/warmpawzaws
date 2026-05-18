import { apiClient } from '@/lib/api-client';

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

export type CustomerDiscoveryCoordsSource = 'profile' | 'localStorage' | 'geolocation';

/**
 * Same resolution order as useHubVendorDiscovery: profile → localStorage → GPS.
 * When coords come from profile or geolocation, they are written to `customer_latitude` /
 * `customer_longitude` so other screens (by-style listings) reuse them without racing.
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

  const ph = (phone || '').trim();
  if (ph.length >= 8) {
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
  if (latitude == null && typeof window !== 'undefined') {
    try {
      const lat = localStorage.getItem('customer_latitude');
      const lng = localStorage.getItem('customer_longitude');
      if (lat && lng) {
        latitude = lat;
        longitude = lng;
        source = 'localStorage';
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
      source = 'geolocation';
    } catch {
      /* ignore */
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
    try {
      localStorage.setItem('customer_latitude', latitude);
      localStorage.setItem('customer_longitude', longitude);
    } catch {
      /* ignore */
    }
  }

  return { latitude, longitude, source };
}
