import { apiClient } from '@/lib/api-client';
import { serviceBaseOnpincode } from '@/components/customer/homepage/constants/helpers';
import { readPersistedLocation } from '@/lib/location-storage';
import { readStoredCustomerDiscoveryCoords } from '@/lib/customer-discovery-coords';

export interface CustomerLocation {
  city: string;
  state: string;
}

const inflight = new Map<string, Promise<CustomerLocation>>();

function cacheKey(phone: string): string {
  return (phone || '').replace(/\D/g, '') || 'guest';
}

/**
 * Strip trailing Indian pincodes (6-digit number) from a state or city name.
 * Addresses from Google Maps sometimes arrive as "Karnataka 560001" — the
 * pincode gets appended to the state component. This causes the service-launch
 * config API's exact state-name lookup to fail, hiding all services.
 * e.g. "Karnataka 560001" → "Karnataka", "Maharashtra" → "Maharashtra"
 */
function cleanStateName(value: string): string {
  return value.replace(/\s*\d{6}\s*$/, '').trim();
}

function readCachedLocation(phone: string): CustomerLocation | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`warmpawz_customer_location_${cacheKey(phone)}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CustomerLocation;
    if (typeof parsed.city === 'string' && typeof parsed.state === 'string') {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeCachedLocation(phone: string, location: CustomerLocation): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      `warmpawz_customer_location_${cacheKey(phone)}`,
      JSON.stringify(location)
    );
  } catch {
    /* ignore */
  }
}

function readCachedProfileForLocation(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('customerData');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function hasUsablePhone(phone: string): boolean {
  return (phone?.replace(/\D/g, '') ?? '').length >= 8;
}

async function resolveGuestLocationFallback(): Promise<CustomerLocation> {
  const persisted = readPersistedLocation();
  let city = cleanStateName(String(persisted?.city || '').trim());
  let state = cleanStateName(String(persisted?.state || '').trim());

  if (city && state) {
    return { city, state };
  }

  const coords = readStoredCustomerDiscoveryCoords();
  const lat = coords.latitude != null ? Number(coords.latitude) : NaN;
  const lng = coords.longitude != null ? Number(coords.longitude) : NaN;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    try {
      const { reverseGeocodeCoordinates } = await import('@/lib/address-from-geolocation');
      const geo = await reverseGeocodeCoordinates(lat, lng);
      if (!city && geo.city) city = cleanStateName(String(geo.city).trim());
      if (!state && geo.state) state = cleanStateName(String(geo.state).trim());
    } catch {
      /* ignore */
    }
  }

  return { city, state };
}

/** Single shared location resolver per phone (dedupes parallel home fetches). */
export async function resolveCustomerLocation(phone: string): Promise<CustomerLocation> {
  const key = cacheKey(phone);
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async (): Promise<CustomerLocation> => {
    let city = '';
    let state = '';

    try {
      if (hasUsablePhone(phone)) {
        const addressesResponse = (await apiClient
          .get(`/customer/addresses?phone=${encodeURIComponent(phone)}`)
          .catch(() => null)) as { addresses?: Array<{ city?: string; state?: string; isDefault?: boolean }> } | null;
        const addresses = addressesResponse?.addresses || [];
        const defaultAddress = addresses.find((a) => a.isDefault) || addresses[0];
        if (defaultAddress) {
          city = cleanStateName((defaultAddress.city || '').trim());
          state = cleanStateName((defaultAddress.state || '').trim());
        }
      }
    } catch {
      /* keep fallback */
    }

    if ((!city || !state) && hasUsablePhone(phone)) {
      const { getHomeBootstrapReady } = await import('@/lib/customer-home-bootstrap');
      await getHomeBootstrapReady().catch(() => undefined);
      const cachedProfile = readCachedProfileForLocation();
      if (cachedProfile) {
        const profileLocation = serviceBaseOnpincode(
          cachedProfile,
          (cachedProfile.pincode as string) || ''
        );
        if (!city && profileLocation.city) city = cleanStateName(String(profileLocation.city).trim());
        if (!state && profileLocation.state) state = cleanStateName(String(profileLocation.state).trim());
      }
    }

    if (!city || !state) {
      const guestLoc = await resolveGuestLocationFallback();
      if (!city && guestLoc.city) city = guestLoc.city;
      if (!state && guestLoc.state) state = guestLoc.state;
    }

    const location = { city, state };
    if (city || state) {
      writeCachedLocation(phone, location);
    } else {
      const cached = readCachedLocation(phone);
      if (cached) return cached;
    }
    return location;
  })();

  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}

/** Instant location from session cache (same session refresh). */
export function readCachedCustomerLocation(phone: string): CustomerLocation | null {
  return readCachedLocation(phone);
}

/**
 * Invalidate the location session cache for a phone number.
 * Must be called after the customer updates their address so the next home
 * page load re-fetches the correct city/state from the addresses API.
 */
export function invalidateCustomerLocationCache(phone: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(`warmpawz_customer_location_${cacheKey(phone)}`);
  } catch {
    /* ignore */
  }
}
