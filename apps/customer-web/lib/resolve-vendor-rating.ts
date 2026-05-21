/**
 * Single source of truth for vendor-level rating on customer UI.
 * Show rating only when reviewCount > 0 and average is a valid 1–5 star value.
 */

import {
  formatAverageForDisplay,
  hasRatings,
  normalizeRatingCount,
} from '@/lib/rating-display';

export type VendorRatingSource = Record<string, unknown>;

export interface ResolvedVendorRating {
  vendorId: string | null;
  average: number | null;
  reviewCount: number;
  shouldShowRating: boolean;
  displayAverage: string;
}

const AVERAGE_FIELD_KEYS = [
  'vendorRating',
  'vendor_rating',
  'averageRating',
  'average_rating',
  'avg_rating',
  'avgRating',
  'rating',
] as const;

function pickVendorId(row: VendorRatingSource): string | null {
  const raw =
    row.vendorId ??
    row.vendor_id ??
    row.id ??
    null;
  if (raw == null || raw === '') return null;
  return String(raw).trim() || null;
}

function pickReviewCount(row: VendorRatingSource): number {
  return normalizeRatingCount(
    row.vendorReviewCount ??
      row.vendor_review_count ??
      row.review_count ??
      row.reviewCount ??
      row.reviewsCount ??
      row.reviews_count ??
      row.totalReviews ??
      row.total_reviews
  );
}

/** First valid 1–5 star among known API fields (vendor + legacy `rating`). */
function pickVendorAverage(row: VendorRatingSource, reviewCount: number): number | null {
  if (!hasRatings(reviewCount)) return null;

  for (const key of AVERAGE_FIELD_KEYS) {
    const raw = row[key];
    const n = typeof raw === 'number' ? raw : raw != null && raw !== '' ? Number(raw) : NaN;
    if (Number.isFinite(n) && n > 0 && n <= 5) return n;
  }

  return null;
}

export function resolveVendorRating(
  row: VendorRatingSource,
  options?: { expectedVendorId?: string }
): ResolvedVendorRating {
  const vendorId = pickVendorId(row);
  const expected = options?.expectedVendorId?.trim();

  if (expected && vendorId && vendorId !== expected) {
    return {
      vendorId,
      average: null,
      reviewCount: 0,
      shouldShowRating: false,
      displayAverage: '—',
    };
  }

  const reviewCount = pickReviewCount(row);
  const average = pickVendorAverage(row, reviewCount);
  const shouldShowRating =
    hasRatings(reviewCount) && average != null && Number.isFinite(average);

  return {
    vendorId,
    average,
    reviewCount,
    shouldShowRating,
    displayAverage: formatAverageForDisplay(average, reviewCount),
  };
}

/**
 * Merge list-card / discovery entity with its raw API row so all rating fields are visible to the resolver.
 * Do not pass `expectedVendorId` for list cards — avoids groupKey vs account id mismatches.
 */
export function vendorRatingRowFromEntity(
  entity: VendorRatingSource,
  preferredVendorId?: string
): VendorRatingSource {
  const vid = (preferredVendorId?.trim() || pickVendorId(entity) || '').trim();
  return {
    ...entity,
    ...(vid ? { vendorId: vid, vendor_id: vid } : {}),
  };
}

/** Resolve for vendor cards (no strict id mismatch). */
export function resolveVendorRatingForCard(
  entity: VendorRatingSource,
  preferredVendorId?: string
): ResolvedVendorRating {
  return resolveVendorRating(vendorRatingRowFromEntity(entity, preferredVendorId));
}

export function applyResolvedRatingToStoredFields(
  row: VendorRatingSource,
  preferredVendorId?: string
): { rating: number; review_count: number } {
  const resolved = resolveVendorRatingForCard(row, preferredVendorId);
  return {
    rating: resolved.shouldShowRating && resolved.average != null ? resolved.average : 0,
    review_count: resolved.reviewCount,
  };
}

/** Props fragment for UniversalVendorCard — omits rating fields when nothing to show. */
export function toUniversalVendorCardRating(
  row: VendorRatingSource,
  vendorId: string
): { vendorRating?: number; vendorReviewCount?: number } {
  const resolved = resolveVendorRatingForCard(row, vendorId);
  if (!resolved.shouldShowRating || resolved.average == null) {
    return { vendorReviewCount: 0 };
  }
  return {
    vendorRating: resolved.average,
    vendorReviewCount: resolved.reviewCount,
  };
}

/** Header stat for single-vendor profile — omit when no reviews. */
export function vendorRatingHeaderStat(
  row: VendorRatingSource,
  vendorId: string
): { value: string; label: 'Rating' } | null {
  const resolved = resolveVendorRating(row, { expectedVendorId: vendorId });
  if (!resolved.shouldShowRating || resolved.average == null) return null;
  return { value: resolved.displayAverage, label: 'Rating' };
}
