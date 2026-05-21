import { resolveCustomerDiscoveryCoords, resolveCustomerDiscoveryPhone } from '@/lib/customer-discovery-coords';

/**
 * Query params for GET /search aligned with discover-services (coords + phone fallback).
 */
export async function buildSearchDiscoveryQueryParams(phone?: string): Promise<URLSearchParams> {
  const params = new URLSearchParams();
  const resolvedPhone = resolveCustomerDiscoveryPhone(phone);
  if (resolvedPhone) {
    params.set('customerPhone', resolvedPhone);
  }
  const { latitude, longitude } = await resolveCustomerDiscoveryCoords(resolvedPhone);
  if (latitude != null && longitude != null) {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      params.set('userLat', String(lat));
      params.set('userLng', String(lng));
      params.set('latitude', String(lat));
      params.set('longitude', String(lng));
    }
  }
  return params;
}

/** Mirror discover-services query params for a hub slug. */
export function appendDiscoverRoleParams(params: URLSearchParams, hubSlug: string): void {
  const c = hubSlug.trim().toLowerCase();
  if (c === 'walker' || c === 'walking') {
    params.set('roleId', 'walker');
  } else if (c === 'boarding') {
    params.set('roleId', 'pet_boarding');
  } else if (c === 'resort') {
    params.set('roleId', 'pet_resort');
  } else if (c === 'cafe') {
    params.set('roleId', 'pet_cafe');
  } else if (c === 'nutritionist' || c === 'nutrition') {
    params.set('roleId', 'nutritionist');
  }
}
