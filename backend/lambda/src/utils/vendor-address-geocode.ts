import { geocodeAddress, geocodeIndiaPincode } from '../lib/utils/geocode';

export type VendorAddressGeocodeInput = {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
};

/**
 * Resolve latitude/longitude from vendor address fields using Google Geocoding
 * (full line first, then Indian postal code centroid fallback).
 */
export async function geocodeVendorAddressFields(
  input: VendorAddressGeocodeInput
): Promise<{ latitude: number; longitude: number } | null> {
  const address = String(input.address ?? '').trim();
  const city = String(input.city ?? '').trim();
  const state = String(input.state ?? '').trim();
  const pincodeRaw = String(input.pincode ?? '').trim();
  const pinDigits = pincodeRaw.replace(/\D/g, '');

  const line = [address, city, state, pincodeRaw].filter((s) => s.length > 0).join(', ');
  if (line.length >= 5) {
    const primary = await geocodeAddress(line);
    if (primary) {
      return { latitude: primary.latitude, longitude: primary.longitude };
    }
  }

  if (pinDigits.length === 6) {
    const pinOnly = await geocodeIndiaPincode(pinDigits);
    if (pinOnly) {
      return { latitude: pinOnly.latitude, longitude: pinOnly.longitude };
    }
  }

  return null;
}
