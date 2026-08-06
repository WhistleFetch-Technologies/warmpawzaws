import type { FeaturedProviderCategory } from '@/lib/featured-provider';
import type { WalkInProvider } from '@/lib/mergeWalkInDiscoveryBatches';
import {
  resolveWalkInProviderProfileServiceStyle,
  resolveWapptVendorProfileServiceStyle,
} from '@/lib/resolve-wappt-vendor-profile-service-style';

/** Mirrors GET /customer/warmpawz-pay/vendors/nearby success payload (frontend-only). */
export type WpayNearbyVendorDto = {
  vendorId: string;
  name: string;
  photoUrl: string | null;
  category: string;
  categoryLabel: string;
  rating: number;
  reviewCount: number;
  distanceKm: number | null;
  distanceText: string | null;
  warmpawzPayEligible: true;
  discountPercent: number;
  payViaWarmpawzLabel?: string;
  fromPrice?: number;
  priceLabel?: string;
  profilePath: {
    vertical: string;
    serviceStyle: string;
  };
};

export type WpayNearbyVendorsResponse = {
  success: boolean;
  vendors?: WpayNearbyVendorDto[];
  total?: number;
  error?: string;
};

const WALK_IN_PHASE1_CATEGORIES = new Set<FeaturedProviderCategory>(['vet', 'grooming']);

const WALK_IN_PRICE_LABEL: Record<'vet' | 'grooming', string> = {
  vet: 'per visit',
  grooming: 'starts at',
};

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function mapWalkInCategory(raw: string | null | undefined): FeaturedProviderCategory | null {
  const token = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!token || token === 'unknown') return null;
  if (token === 'vet' || token === 'veterinary' || token === 'veterinarian') return 'vet';
  if (token === 'grooming' || token === 'groomer') return 'grooming';
  return null;
}

function resolveWalkInCategory(dto: WpayNearbyVendorDto): FeaturedProviderCategory | null {
  return (
    mapWalkInCategory(dto.category) ??
    mapWalkInCategory(dto.profilePath?.vertical) ??
    null
  );
}

/** Map one nearby WPay vendor row to WalkInProvider (Phase 1: vet + grooming only). */
export function adaptWpayNearbyVendorToWalkInProvider(
  dto: WpayNearbyVendorDto
): WalkInProvider | null {
  const category = resolveWalkInCategory(dto);
  if (!category || !WALK_IN_PHASE1_CATEGORIES.has(category)) return null;

  const vendorId = String(dto.vendorId ?? '').trim();
  const displayName = String(dto.name ?? '').trim();
  if (!vendorId || !displayName) return null;

  const fromPrice = num(dto.fromPrice);
  const priceLabel =
    String(dto.priceLabel ?? '').trim() ||
    WALK_IN_PRICE_LABEL[category as keyof typeof WALK_IN_PRICE_LABEL];

  const profileStyle = dto.profilePath?.serviceStyle;
  const serviceStyle = resolveWalkInProviderProfileServiceStyle({
    category,
    subtitle: String(dto.categoryLabel ?? '').trim(),
    displayName,
    serviceStyle:
      profileStyle === 'at_home' || profileStyle === 'at_center'
        ? profileStyle
        : undefined,
  });

  return {
    id: vendorId,
    displayName,
    subtitle: String(dto.categoryLabel ?? '').trim(),
    photoUrl: dto.photoUrl ?? null,
    rating: num(dto.rating) ?? 0,
    reviewCount: Math.max(0, Math.trunc(num(dto.reviewCount) ?? 0)),
    distanceKm: num(dto.distanceKm),
    experienceYears: null,
    fromPrice: fromPrice != null && fromPrice > 0 ? fromPrice : null,
    priceLabel,
    category,
    serviceStyle: serviceStyle === 'tele' ? 'at_center' : serviceStyle,
  };
}

/** Map nearby WPay API response to carousel providers (server-sorted; capped client-side). */
export function adaptWpayNearbyVendorsToWalkInProviders(
  response: WpayNearbyVendorsResponse,
  options?: { limit?: number }
): WalkInProvider[] {
  if (!response?.success || !Array.isArray(response.vendors)) return [];

  const limit = options?.limit ?? 8;
  const mapped: WalkInProvider[] = [];

  for (const row of response.vendors) {
    const provider = adaptWpayNearbyVendorToWalkInProvider(row);
    if (provider) mapped.push(provider);
    if (mapped.length >= limit) break;
  }

  return mapped;
}

export function buildWpayNearbyVendorsUrl(opts: {
  limit: number;
  latitude?: string;
  longitude?: string;
  phone?: string;
}): string {
  const params = new URLSearchParams();
  params.set('limit', String(opts.limit));

  if (opts.latitude && opts.longitude) {
    params.set('latitude', opts.latitude);
    params.set('longitude', opts.longitude);
  }

  const phone = String(opts.phone ?? '').trim();
  if (phone) params.set('phone', phone);

  return `/customer/warmpawz-pay/vendors/nearby?${params.toString()}`;
}
