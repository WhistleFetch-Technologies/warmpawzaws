/**
 * Normalizes GET /customer/discover-services (and similar) provider rows
 * for consistent “featured vendor” cards across service hubs.
 */

export type FeaturedProviderCategory =
  | 'boarding'
  | 'sitting'
  | 'grooming'
  | 'training'
  | 'vet'
  | 'walker';

export interface FeaturedProvider {
  id: string;
  displayName: string;
  subtitle: string;
  photoUrl: string | null;
  rating: number;
  reviewCount: number;
  distanceKm: number | null;
  experienceYears: number | null;
  fromPrice: number | null;
  priceLabel: string;
}

const CATEGORY_PRICE_LABEL: Record<FeaturedProviderCategory, string> = {
  boarding: '/night',
  sitting: 'from',
  grooming: 'starts at',
  training: 'starting',
  vet: 'per visit',
  walker: 'from',
};

/** Gray subtitle line — matches Featured Vets when API omits role/specialty */
const CATEGORY_DEFAULT_SUBTITLE: Record<FeaturedProviderCategory, string> = {
  boarding: 'Pet boarding & day care',
  sitting: 'In-home pet sitting & visits',
  grooming: 'Professional pet grooming',
  training: 'Certified pet training',
  vet: 'General Veterinarian',
  walker: 'Professional dog walking',
};

/** When API has no price, show a starting figure like legacy hub cards */
const CATEGORY_DEFAULT_FROM_PRICE: Partial<
  Record<FeaturedProviderCategory, number>
> = {
  boarding: 800,
  sitting: 299,
  grooming: 999,
  training: 1500,
  walker: 199,
};

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

/**
 * Prefer vendor/business fields over generic `name` when it might be a service title
 * on legacy rows; discover-services enriched providers use `name` as business display.
 */
function displayNameFromRaw(raw: Record<string, unknown>): string {
  const vendorFirst =
    str(raw.businessName) ||
    str(raw.business_name) ||
    str(raw.vendorName) ||
    str(raw.vendor_name) ||
    str(raw.owner_name) ||
    str(raw.ownerName);
  if (vendorFirst) return vendorFirst;
  return str(raw.name);
}

function subtitleFromRaw(raw: Record<string, unknown>, displayName: string): string {
  let subtitle =
    str(raw.customerService) ||
    str(raw.roleDisplayName) ||
    str(raw.role_display_name) ||
    str(raw.roleCategory) ||
    str(raw.role_category) ||
    str(raw.specialty) ||
    str(raw.role);

  if (subtitle && displayName && subtitle.toLowerCase() === displayName.toLowerCase()) {
    subtitle = '';
  }

  if (!subtitle && Array.isArray(raw.services) && raw.services.length > 0) {
    const s0 = raw.services[0] as Record<string, unknown>;
    const sn = str(s0?.name) || str(s0?.service_name);
    if (sn && sn.toLowerCase() !== displayName.toLowerCase()) {
      subtitle = sn;
    }
  }

  return subtitle;
}

function reviewCountFromRaw(raw: Record<string, unknown>): number {
  const n =
    num(raw.reviewCount) ??
    num(raw.review_count) ??
    num(raw.vendorReviewCount) ??
    num(raw.vendor_review_count) ??
    num(raw.reviewsCount) ??
    num(raw.reviews_count) ??
    num(raw.completedBookings);
  if (n == null) return 0;
  return Math.max(0, Math.round(n));
}

function experienceYearsFromRaw(raw: Record<string, unknown>): number | null {
  const direct =
    num(raw.experience) ??
    num(raw.experience_years) ??
    num(raw.experienceYears) ??
    num(raw.years_experience) ??
    num(raw.yearsOfExperience) ??
    num(raw.years_of_experience);
  if (direct != null && direct > 0) return Math.min(99, Math.round(direct));

  const blob =
    str(raw.experienceText) ||
    str(raw.experience_text) ||
    str(raw.bio) ||
    '';
  const m = blob.match(/(\d+)\s*\+?\s*years?/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n > 0 && n < 100) return n;
  }
  return null;
}

function fromPriceFromRaw(raw: Record<string, unknown>): number | null {
  const priceMin = num(raw.priceMin) ?? num(raw.price_min);
  if (priceMin != null && priceMin > 0) return priceMin;

  if (Array.isArray(raw.services) && raw.services.length > 0) {
    const prices = (raw.services as Record<string, unknown>[])
      .map((s) => num(s.price))
      .filter((p): p is number => p != null && p > 0);
    if (prices.length > 0) return Math.min(...prices);
  }

  const pr = str(raw.priceRange);
  if (pr) {
    const digits = pr.replace(/[^0-9]/g, '');
    if (digits) {
      const parsed = parseInt(digits, 10);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }

  const single =
    num(raw.basePrice) ??
    num(raw.base_price) ??
    num(raw.price) ??
    num(raw.startingPrice);
  if (single != null && single > 0) return single;

  return null;
}

export function normalizeDiscoveryProvider(
  raw: unknown,
  category: FeaturedProviderCategory
): FeaturedProvider | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const id =
    str(r.vendorId) ||
    str(r.vendor_id) ||
    str(r.id) ||
    str(r.providerId);
  if (!id) return null;

  const displayName = displayNameFromRaw(r) || 'Provider';
  let subtitle = subtitleFromRaw(r, displayName);
  if (!subtitle) {
    subtitle = CATEGORY_DEFAULT_SUBTITLE[category];
  }

  const photoUrl =
    str(r.photo) ||
    str(r.photoUrl) ||
    str(r.photo_url) ||
    str(r.logo_url) ||
    str(r.profile_photo_url) ||
    null;

  const ratingRaw =
    num(r.rating) ?? num(r.vendorRating) ?? num(r.vendor_rating) ?? 0;
  const rating = ratingRaw != null && ratingRaw > 0 ? ratingRaw : 0;

  const reviewCount = reviewCountFromRaw(r);

  const distanceKm = num(r.distance) ?? num(r.distanceKm) ?? num(r.distance_km);

  const experienceYears = experienceYearsFromRaw(r);

  let fromPrice = fromPriceFromRaw(r);
  if (fromPrice == null) {
    const fallback = CATEGORY_DEFAULT_FROM_PRICE[category];
    if (fallback != null) fromPrice = fallback;
  }

  return {
    id,
    displayName,
    subtitle,
    photoUrl: photoUrl || null,
    rating,
    reviewCount,
    distanceKm,
    experienceYears,
    fromPrice,
    priceLabel: CATEGORY_PRICE_LABEL[category],
  };
}

export function normalizeAndDedupeDiscoveryProviders(
  rows: unknown[] | null | undefined,
  category: FeaturedProviderCategory
): FeaturedProvider[] {
  const map = new Map<string, FeaturedProvider>();
  for (const row of rows || []) {
    const n = normalizeDiscoveryProvider(row, category);
    if (!n) continue;
    if (!map.has(n.id)) map.set(n.id, n);
  }
  return Array.from(map.values());
}

/** Maps VetServiceRouter’s featured vet row to the shared card shape */
export function featuredProviderFromLegacyVet(v: {
  id: string;
  name?: string;
  specialty?: string;
  rating?: number;
  reviews?: number;
  experience?: number;
  fee?: number;
  photo?: string | null;
  distanceKm?: number | null;
}): FeaturedProvider {
  return {
    id: v.id,
    displayName: v.name || 'Dr. Veterinarian',
    subtitle: v.specialty || CATEGORY_DEFAULT_SUBTITLE.vet,
    photoUrl: v.photo || null,
    rating: v.rating ?? 0,
    reviewCount: v.reviews ?? 0,
    distanceKm:
      v.distanceKm != null && Number.isFinite(v.distanceKm)
        ? v.distanceKm
        : null,
    experienceYears:
      v.experience != null && v.experience > 0
        ? Math.min(99, Math.round(Number(v.experience)))
        : null,
    fromPrice:
      v.fee != null && Number(v.fee) > 0 ? Number(v.fee) : 499,
    priceLabel: CATEGORY_PRICE_LABEL.vet,
  };
}
