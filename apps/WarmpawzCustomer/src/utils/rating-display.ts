/**
 * Customer-facing rating helpers: never invent a score when there are no reviews.
 */

export function normalizeReviewCount(count: unknown): number {
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

/** Average rating to show only when review count is positive; otherwise null. */
export function customerFacingRating(rating: unknown, reviewCount: unknown): number | null {
  if (normalizeReviewCount(reviewCount) === 0) return null;
  const r = Number(rating);
  if (!Number.isFinite(r) || r <= 0) return null;
  return r;
}
