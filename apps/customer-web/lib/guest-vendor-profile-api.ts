import { getApiBaseUrl } from '@/lib/api-client';

export type GuestVendorProfileVendor = {
  id: string;
  businessName?: string;
  roleName?: string;
  category?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number | string;
  longitude?: number | string;
  rating?: number;
  totalReviews?: number;
  operatingHours?: Record<string, unknown> | null;
  description?: string;
  photoUrl?: string;
  vendorType?: string;
  specializations?: string[];
  serviceStyles?: string[];
  facilityPhotos?: string[];
  amenities?: string[];
  customAmenities?: string[];
  boardingDisclaimer?: string;
  boardingDisclaimerPoints?: string[];
};

export type GuestVendorProfileService = {
  id?: string;
  service_id?: string;
  name?: string;
  service_name?: string;
  description?: string;
  price?: number | string;
  custom_price?: number | string;
  duration?: number | string;
  custom_duration?: number | string;
  service_style?: string;
  category?: string;
};

export type GuestVendorProfileReview = {
  id?: string;
  rating?: number;
  comment?: string;
  created_at?: string;
  customer_name?: string;
};

export type GuestVendorProfileResponse = {
  success?: boolean;
  vendor?: GuestVendorProfileVendor;
  services?: GuestVendorProfileService[];
  reviews?: GuestVendorProfileReview[];
  staff?: Record<string, unknown>[];
};

/** Fetch guest-safe vendor profile without auth (GET /public/vendor/:id/profile). */
export async function fetchGuestVendorProfile(
  vendorId: string
): Promise<GuestVendorProfileResponse | null> {
  const id = String(vendorId ?? '').trim();
  if (!id) return null;

  const base = getApiBaseUrl().replace(/\/+$/, '');
  const path = `/public/vendor/${encodeURIComponent(id)}/profile`;

  try {
    const res = await fetch(`${base}${path}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as GuestVendorProfileResponse;
    if (!data?.vendor?.id) return null;
    return data;
  } catch {
    return null;
  }
}

export function guestVendorServiceLabel(row: GuestVendorProfileService): string {
  return String(row.name ?? row.service_name ?? 'Service').trim() || 'Service';
}

export function guestVendorServicePrice(row: GuestVendorProfileService): number {
  const raw = row.custom_price ?? row.price ?? 0;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(n) ? n : 0;
}

export function guestVendorServiceId(row: GuestVendorProfileService): string {
  return String(row.id ?? row.service_id ?? '').trim();
}
