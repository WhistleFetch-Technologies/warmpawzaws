import { discoveryCardPriceSortValue } from './discovery-list-response';
import { providerWithinRadiusKm, vendorHomeServiceRadiusKm } from '../endpoints/customer/discovery/repos/legacy-helpers.repo';

export type VendorListRadiusOpts = {
  serviceStyleNorm: string;
  customerLat: number | null;
  customerLng: number | null;
  maxDistanceKm: number | null;
  radius: number | null | undefined;
  platformHomeKm: number;
  sittingRelaxed: boolean;
  vendorRadiusLookup: Map<string, { service_radius?: unknown; service_distance_km?: unknown }>;
};

export function filterDiscoveryCardsByMinRating<T extends { rating?: number }>(
  cards: T[],
  minRating: number | null
): T[] {
  if (minRating == null || minRating <= 0) return cards;
  return cards.filter((p) => (p.rating ?? 0) >= minRating);
}

export function applyDiscoveryRadiusFilter<T extends { vendorId?: string; distance?: number | null }>(
  cards: T[],
  opts: VendorListRadiusOpts
): T[] {
  const { customerLat, customerLng, serviceStyleNorm, vendorRadiusLookup } = opts;
  if (customerLat == null || customerLng == null) return cards;

  if (serviceStyleNorm === 'at_home') {
    const withinRadius = cards.filter((p) => {
      const row = vendorRadiusLookup.get(String(p.vendorId));
      const vendorCap = vendorHomeServiceRadiusKm(row || {}) ?? opts.platformHomeKm;
      const cap =
        opts.maxDistanceKm != null && Number.isFinite(opts.maxDistanceKm)
          ? Math.min(opts.maxDistanceKm, vendorCap)
          : opts.radius != null && opts.radius > 0
            ? Math.min(opts.radius, vendorCap)
            : vendorCap;
      return providerWithinRadiusKm(p.distance ?? null, cap, true);
    });
    if (withinRadius.length > 0 || !opts.sittingRelaxed) return withinRadius;
    return cards;
  }

  const effectiveMaxKm = opts.maxDistanceKm ?? (opts.radius != null && opts.radius > 0 ? opts.radius : null);
  if (effectiveMaxKm == null) return cards;
  const withinRadius = cards.filter((p) =>
    providerWithinRadiusKm(p.distance ?? null, effectiveMaxKm, opts.sittingRelaxed)
  );
  if (withinRadius.length > 0 || !opts.sittingRelaxed) return withinRadius;
  return cards;
}

export function sortDiscoveryVendorCards<T extends Record<string, unknown>>(
  cards: T[],
  sortBy: string
): void {
  cards.sort((a, b) => {
    switch (String(sortBy)) {
      case 'distance': {
        const ad = a.distance as number | null | undefined;
        const bd = b.distance as number | null | undefined;
        if (ad == null && bd == null) return 0;
        if (ad == null) return 1;
        if (bd == null) return -1;
        return ad - bd;
      }
      case 'rating':
        return (Number(b.rating) || 0) - (Number(a.rating) || 0);
      case 'price':
        return discoveryCardPriceSortValue(a) - discoveryCardPriceSortValue(b);
      case 'relevance':
      default: {
        const score = (p: Record<string, unknown>) =>
          (Number(p.rating) || 0) * 10 +
          (Number(p.reviewCount) || 0) * 0.5 +
          (p.distance != null ? Math.max(0, 50 - Number(p.distance)) : 0);
        return score(b) - score(a);
      }
    }
  });
}
