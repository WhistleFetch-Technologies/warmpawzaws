import { apiClient } from '@/lib/api-client';
import { serviceBaseOnpincode } from '@/components/customer/homepage/constants/helpers';

export interface CustomerLocation {
  city: string;
  state: string;
}

const inflight = new Map<string, Promise<CustomerLocation>>();

function cacheKey(phone: string): string {
  return (phone || '').replace(/\D/g, '') || 'guest';
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

/** Single shared location resolver per phone (dedupes parallel home fetches). */
export async function resolveCustomerLocation(phone: string): Promise<CustomerLocation> {
  const key = cacheKey(phone);
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async (): Promise<CustomerLocation> => {
    let city = '';
    let state = '';

    try {
      const addressesResponse = (await apiClient
        .get(`/customer/addresses?phone=${encodeURIComponent(phone)}`)
        .catch(() => null)) as { addresses?: Array<{ city?: string; state?: string; isDefault?: boolean }> } | null;
      const addresses = addressesResponse?.addresses || [];
      const defaultAddress = addresses.find((a) => a.isDefault) || addresses[0];
      if (defaultAddress) {
        city = (defaultAddress.city || '').trim();
        state = (defaultAddress.state || '').trim();
      }
    } catch {
      /* keep fallback */
    }

    if (!city || !state) {
      try {
        const profileResponse = await apiClient
          .get(`/customer/profile?phone=${encodeURIComponent(phone)}`)
          .catch(() => null);
        const profile = profileResponse as Record<string, unknown> | null;
        const profileLocation = serviceBaseOnpincode(profile, (profile?.pincode as string) || '');
        if (!city && profileLocation.city) city = String(profileLocation.city).trim();
        if (!state && profileLocation.state) state = String(profileLocation.state).trim();
      } catch {
        /* keep fallback */
      }
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
