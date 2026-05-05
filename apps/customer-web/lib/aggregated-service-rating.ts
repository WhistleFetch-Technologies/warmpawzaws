/**
 * Centralized rating derivation to avoid merge drift/hardcoded conflicts.
 *
 * Call with the same service rows shown for the current listing fetch (category / role / location
 * should already be applied server-side). This helper optionally narrows by `serviceStyle` when
 * the user picks a specific style so the header stat stays aligned with visible cards.
 */

import { normalizeRatingCount } from '@/lib/rating-display';

export type ServiceRowForAggregatedRating = {
  vendorRating?: number | null;
  vendorReviewCount?: number | null;
  reviewCount?: number | null;
  serviceStyle?: 'at_home' | 'at_center' | 'tele';
  /** When present, used to keep averages aligned with category/role filters if the API returns a mixed list. */
  categoryName?: string | null;
};

export interface AggregatedRatingFilters {
  category: string;
  roleId: string;
  serviceStyle: 'at_home' | 'at_center' | 'tele' | 'all';
}

function isValidStarRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 5;
}

function rowMatchesCategoryRole(
  row: ServiceRowForAggregatedRating,
  filters: AggregatedRatingFilters
): boolean {
  const cat = filters.category.trim().toLowerCase();
  const role = filters.roleId.trim().toLowerCase();
  if (!cat || cat === 'all') return true;

  const cn = (row.categoryName ?? '').trim().toLowerCase();
  if (!cn) return true;

  const groomingContext = cat === 'grooming' || role === 'pet_groomer';
  const trainingContext = cat === 'training' || role === 'trainer';

  if (groomingContext) {
    return cn.includes('groom');
  }
  if (trainingContext) {
    return cn.includes('train');
  }
  return cn.includes(cat);
}

function narrowByStyle(
  services: ReadonlyArray<ServiceRowForAggregatedRating>,
  serviceStyle: AggregatedRatingFilters['serviceStyle']
): ServiceRowForAggregatedRating[] {
  if (serviceStyle === 'all') return [...services];
  return services.filter((s) => s.serviceStyle === serviceStyle);
}

/** Average vendor rating for the visible slice, one decimal, or em dash when none. */
export function getAggregatedRatingFromServices(
  services: ReadonlyArray<ServiceRowForAggregatedRating>,
  filters: AggregatedRatingFilters
): string {
  const styleScoped = narrowByStyle(services, filters.serviceStyle);

  const cat = filters.category.trim().toLowerCase();
  const shouldNarrowByCategory =
    Boolean(cat) &&
    cat !== 'all' &&
    styleScoped.some((r) => Boolean((r.categoryName ?? '').trim()));

  const categoryScoped = shouldNarrowByCategory
    ? styleScoped.filter((r) => rowMatchesCategoryRole(r, filters))
    : styleScoped;

  const pool = categoryScoped.length > 0 ? categoryScoped : styleScoped;
  const values = pool.flatMap((s) => {
    const rc = normalizeRatingCount(s.vendorReviewCount ?? s.reviewCount);
    if (rc <= 0) return [];
    const vr = s.vendorRating;
    return isValidStarRating(vr) ? [vr] : [];
  });
  if (values.length === 0) return '—';

  const avg = values.reduce((acc, n) => acc + n, 0) / values.length;
  return (Math.round(avg * 10) / 10).toFixed(1);
}
