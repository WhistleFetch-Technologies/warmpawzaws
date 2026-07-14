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

/** Guest services page (GET /public/vendor/:id/services) — use limit so PreviewServiceRow applies. */
export async function fetchGuestVendorServices(
  vendorId: string,
  opts?: { limit?: number; offset?: number; serviceStyle?: string; category?: string }
): Promise<{
  services: GuestVendorProfileService[];
  total: number;
  hasMore: boolean;
} | null> {
  const id = String(vendorId ?? '').trim();
  if (!id) return null;
  const base = getApiBaseUrl().replace(/\/+$/, '');
  const limit = opts?.limit ?? 10;
  const offset = opts?.offset ?? 0;
  const qs = new URLSearchParams();
  qs.set('limit', String(limit));
  qs.set('offset', String(offset));
  if (opts?.serviceStyle) qs.set('serviceStyle', opts.serviceStyle);
  if (opts?.category) qs.set('category', opts.category);
  const path = `/public/vendor/${encodeURIComponent(id)}/services?${qs.toString()}`;
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      services?: GuestVendorProfileService[];
      total?: number;
      hasMore?: boolean;
    };
    const services = Array.isArray(data.services) ? data.services : [];
    return {
      services: services.map((s) => ({
        ...s,
        // Map preview fields into legacy guest helpers
        service_name: (s as any).name ?? s.service_name,
        service_style: (s as any).serviceStyle ?? s.service_style,
        description: (s as any).shortDescription ?? s.description,
        custom_price: (s as any).price ?? s.custom_price,
      })),
      total: Number(data.total) || services.length,
      hasMore: !!data.hasMore,
    };
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
