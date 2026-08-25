import type { WalkInProvider } from '@/lib/mergeWalkInDiscoveryBatches';
import { resolveWalkInProviderProfileServiceStyle } from '@/lib/resolve-wappt-vendor-profile-service-style';

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
  warmpawzPayEligible: boolean;
  appointmentEligible?: boolean;
  effectiveRadiusKm?: number | null;
  radiusSource?: string | null;
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
  nextCursor?: string | null;
  error?: string;
};

const WALK_IN_PRICE_LABEL: Record<string, string> = {
  vet: 'per visit',
  grooming: 'starts at',
  training: 'starting',
  walker: 'from',
  boarding: '/night',
  sitting: 'from',
  nutrition: 'from',
  nutritionist: 'from',
};

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function mapWalkInCategory(raw: string | null | undefined): string {
  const token = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!token) return 'unknown';
  if (token === 'vet' || token === 'veterinary' || token === 'veterinarian') return 'vet';
  if (token === 'grooming' || token === 'groomer') return 'grooming';
  if (token === 'training' || token === 'trainer') return 'training';
  if (token === 'walker' || token === 'walking' || token === 'dog_walker') return 'walker';
  if (token === 'boarding' || token === 'pet_boarding') return 'boarding';
  if (token === 'sitting' || token === 'sitter' || token === 'pet_sitter' || token === 'pet-sitter') {
    return 'sitting';
  }
  if (token === 'nutrition' || token === 'nutritionist') return 'nutrition';
  if (token === 'behaviorist' || token === 'behaviourist') return 'behaviorist';
  return token;
}

/** Map one nearby Walk-in row. Category is display-only; capabilities come from the API. */
export function adaptWpayNearbyVendorToWalkInProvider(
  dto: WpayNearbyVendorDto
): WalkInProvider | null {
  const warmpawzPayEligible = dto.warmpawzPayEligible === true;
  const appointmentEligible = dto.appointmentEligible === true;
  if (!warmpawzPayEligible && !appointmentEligible) return null;

  const vendorId = String(dto.vendorId ?? '').trim();
  const displayName = String(dto.name ?? '').trim();
  if (!vendorId || !displayName) return null;

  const category =
    mapWalkInCategory(dto.category) !== 'unknown'
      ? mapWalkInCategory(dto.category)
      : mapWalkInCategory(dto.profilePath?.vertical);

  const fromPrice = num(dto.fromPrice);
  const priceLabel = String(dto.priceLabel ?? '').trim() || WALK_IN_PRICE_LABEL[category] || '';

  const profileStyle = dto.profilePath?.serviceStyle;
  const serviceStyle = resolveWalkInProviderProfileServiceStyle({
    category,
    subtitle: String(dto.categoryLabel ?? '').trim(),
    displayName,
    serviceStyle:
      profileStyle === 'at_home' || profileStyle === 'at_center' ? profileStyle : undefined,
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
    warmpawzPayEligible,
    appointmentEligible,
  };
}

/** Map nearby API page. Backend already filtered, sorted, and paginated. */
export function adaptWpayNearbyVendorsToWalkInProviders(
  response: WpayNearbyVendorsResponse
): WalkInProvider[] {
  if (!response?.success || !Array.isArray(response.vendors)) return [];

  const mapped: WalkInProvider[] = [];
  for (const row of response.vendors) {
    const provider = adaptWpayNearbyVendorToWalkInProvider(row);
    if (provider) mapped.push(provider);
  }
  return mapped;
}

export function buildWpayNearbyVendorsUrl(opts: {
  limit: number;
  latitude?: string;
  longitude?: string;
  phone?: string;
  cursor?: string;
  maxDistanceKm?: number | null;
}): string {
  const params = new URLSearchParams();
  params.set('limit', String(opts.limit));

  if (opts.latitude && opts.longitude) {
    params.set('latitude', opts.latitude);
    params.set('longitude', opts.longitude);
  }

  if (opts.maxDistanceKm != null && Number.isFinite(opts.maxDistanceKm) && opts.maxDistanceKm > 0) {
    params.set('maxDistanceKm', String(opts.maxDistanceKm));
  }

  if (opts.cursor?.trim()) {
    params.set('cursor', opts.cursor.trim());
  }

  const phone = String(opts.phone ?? '').trim();
  if (phone) params.set('phone', phone);

  return `/customer/warmpawz-pay/vendors/nearby?${params.toString()}`;
}
