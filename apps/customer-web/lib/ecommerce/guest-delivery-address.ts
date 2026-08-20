/**
 * Bridge startup guest location (warmpawz_location_v1) into ecommerce delivery address.
 */
import {
  isFiniteGuestHomeCoordinate,
  readPersistedLocation,
  type PersistedLocationV1,
} from '@/lib/location-storage';
import type { DeliveryAddress } from '@/lib/ecommerce/load-customer-addresses';

export const GUEST_LOCATION_ADDRESS_ID = 'guest-location';

function hasUsableLocation(loc: PersistedLocationV1): boolean {
  const city = (loc.city || '').trim();
  const pincode = (loc.pincode || '').trim();
  const hasCoords =
    isFiniteGuestHomeCoordinate(loc.latitude) &&
    isFiniteGuestHomeCoordinate(loc.longitude);
  return Boolean(city || pincode || hasCoords);
}

function formatGuestAddressLine1(loc: PersistedLocationV1): string {
  const stored = (loc.addressLine1 || '').trim();
  if (stored) return stored;

  const locality = (loc.locality || '').trim();
  if (locality) return locality;

  const city = (loc.city || '').trim();
  const pincode = (loc.pincode || '').trim();
  if (city && pincode) return `${city} ${pincode}`;
  if (city) return city;
  if (pincode) return pincode;
  return 'Current location';
}

/** Map persisted discovery location to a synthetic checkout delivery address. */
export function locationToGuestDeliveryAddress(
  loc: PersistedLocationV1 | null | undefined
): DeliveryAddress | null {
  if (!loc || loc.v !== 1 || !hasUsableLocation(loc)) return null;

  const addressLine1 = formatGuestAddressLine1(loc);
  const city = (loc.city || '').trim() || undefined;
  const pincode = (loc.pincode || '').trim() || undefined;
  const state = (loc.state || '').trim() || undefined;

  return {
    id: GUEST_LOCATION_ADDRESS_ID,
    fullName: 'Current location',
    name: 'Current location',
    addressLine1,
    street: addressLine1,
    addressLine2: (loc.locality || '').trim() || undefined,
    city,
    state,
    pincode,
    isDefault: true,
  };
}

/** Read guest delivery address from localStorage location cache. */
export function readGuestDeliveryAddressFromLocation(): DeliveryAddress | null {
  return locationToGuestDeliveryAddress(readPersistedLocation());
}
