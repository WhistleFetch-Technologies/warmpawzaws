/**
 * Same discovery sequence as PetSitterServiceRouter — used by useHubVendorDiscovery for sitting.
 */

import { apiClient } from '@/lib/api-client';

async function resolveLocationParams(phone: string): Promise<string> {
  try {
    const lat =
      typeof localStorage !== 'undefined' && localStorage.getItem('customer_latitude');
    const lng =
      typeof localStorage !== 'undefined' && localStorage.getItem('customer_longitude');
    if (lat && lng)
      return `&latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}`;
  } catch {
    /* ignore */
  }
  if (phone) {
    try {
      const profileRes = (await apiClient.get(
        `/customer/profile?phone=${encodeURIComponent(phone)}`
      )) as any;
      const profile = profileRes?.profile || profileRes;
      if (profile?.latitude != null && profile?.longitude != null) {
        return `&latitude=${encodeURIComponent(String(profile.latitude))}&longitude=${encodeURIComponent(String(profile.longitude))}`;
      }
    } catch {
      /* ignore */
    }
  }
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 8000,
          maximumAge: 600000,
        });
      });
      return `&latitude=${encodeURIComponent(String(pos.coords.latitude))}&longitude=${encodeURIComponent(String(pos.coords.longitude))}`;
    } catch {
      /* ignore */
    }
  }
  return '';
}

function extractProviderList(payload: any): any[] {
  if (!payload || typeof payload !== 'object') return [];
  const inner = payload.data && typeof payload.data === 'object' ? payload.data : payload;
  return inner.vendors || inner.providers || inner.services || [];
}

export async function fetchPetSitterHubRows(phone: string): Promise<any[]> {
  const locationParams = await resolveLocationParams(phone);
  const phoneParam = phone ? `&phone=${encodeURIComponent(phone)}` : '';
  const base = '/customer/discover-services?category=sitting&serviceStyle=at_home';

  const fetchSittersWithLocationSuffix = async (locSuffix: string): Promise<any[]> => {
    let list: any[] = [];
    try {
      const data = await apiClient.get<Record<string, unknown>>(
        `${base}&roleId=pet_sitter${locSuffix}${phoneParam}`
      );
      list = extractProviderList(data);
    } catch {
      list = [];
    }
    if (list.length === 0) {
      try {
        const fallback = await apiClient.get<Record<string, unknown>>(
          `${base}${locSuffix}${phoneParam}`
        );
        list = extractProviderList(fallback);
      } catch {
        list = [];
      }
    }
    if (list.length === 0) {
      try {
        const alt = await apiClient.get<Record<string, unknown>>(
          `${base}&roleId=sitter${locSuffix}${phoneParam}`
        );
        list = extractProviderList(alt);
      } catch {
        list = [];
      }
    }
    if (list.length === 0) {
      try {
        const svc = await apiClient.get<{ services?: any[] }>(
          `/customer/services?roleId=pet_sitter&serviceStyle=at_home${locSuffix}`
        );
        const services = svc.services || [];
        const byVendor = new Map<string, any>();
        for (const s of services) {
          const vid = s.vendorId;
          if (!vid || byVendor.has(vid)) continue;
          const rc = Number(s.vendorReviewCount ?? 0) || 0;
          const raw = s.vendorRating != null ? Number(s.vendorRating) : NaN;
          const vr = rc > 0 && Number.isFinite(raw) && raw > 0 ? raw : 0;
          byVendor.set(vid, {
            id: vid,
            vendorId: vid,
            businessName: s.vendorName,
            name: s.vendorName,
            rating: vr,
            reviewCount: rc,
            basePrice: s.price,
          });
        }
        list = Array.from(byVendor.values());
      } catch {
        /* ignore */
      }
    }
    return list;
  };

  let list = await fetchSittersWithLocationSuffix(locationParams);
  if (list.length === 0 && locationParams) {
    list = await fetchSittersWithLocationSuffix('');
  }
  return list;
}
