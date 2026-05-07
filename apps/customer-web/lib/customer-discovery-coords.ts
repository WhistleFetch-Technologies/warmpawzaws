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

/** Same resolution order as useHubVendorDiscovery for discover-services parity. */
export async function resolveCustomerDiscoveryCoords(phone?: string): Promise<{
  latitude?: string;
  longitude?: string;
}> {
  let latitude: string | undefined;
  let longitude: string | undefined;
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
  return { latitude, longitude };
}
