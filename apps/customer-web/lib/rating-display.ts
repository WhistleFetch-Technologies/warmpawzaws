export function normalizeRatingCount(count: unknown): number {
  const parsed = Number(count);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.floor(parsed);
}

export function hasRatings(count: unknown): boolean {
  return normalizeRatingCount(count) > 0;
}

export function getAverageRatingLabel(
  rating: unknown,
  ratingCount: unknown,
  fractionDigits = 1
): string {
  if (!hasRatings(ratingCount)) {
    return 'No customer reviews';
  }

  const parsedRating = Number(rating);
  if (!Number.isFinite(parsedRating) || parsedRating <= 0) {
    return 'No customer reviews';
  }

  return parsedRating.toFixed(fractionDigits);
}

export function getReviewCountLabel(reviewCount: unknown): string {
  const count = normalizeRatingCount(reviewCount);
  if (count === 0) {
    return 'No customer reviews';
  }
  return `${count} ${count === 1 ? 'review' : 'reviews'}`;
}

/** Dashboard / header chip: averaged stars from rows that have real reviews — never a placeholder number. */
export function aggregateAverageRatingStat(
  rows: ReadonlyArray<{
    rating?: unknown;
    vendorRating?: unknown;
    reviewCount?: unknown;
    review_count?: unknown;
  }>
): string {
  const values: number[] = [];
  for (const r of rows) {
    const rc = normalizeRatingCount(r.reviewCount ?? r.review_count);
    if (rc <= 0) continue;
    const raw =
      r.vendorRating !== undefined && r.vendorRating !== null ? r.vendorRating : r.rating;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0 && n <= 5) values.push(n);
  }
  if (values.length === 0) return '—';
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return (Math.round(avg * 10) / 10).toFixed(1);
}

/** One-decimal rating for inline text, or em dash when missing / invalid. */
export function formatRatingNumberOrDash(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 5) return '—';
  return (Math.round(n * 10) / 10).toFixed(1);
}

/** Profile / detail row: show average only when review count says we have real ratings. */
export function formatAverageForDisplay(average: unknown, reviewCount: unknown): string {
  if (!hasRatings(reviewCount)) return '—';
  return formatRatingNumberOrDash(average);
}

/** Average of valid 1–5 stars; em dash if none (no fake filler values). */
export function averageStarDisplayFromNumbers(values: ReadonlyArray<unknown>): string {
  const nums: number[] = [];
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0 && n <= 5) nums.push(n);
  }
  if (nums.length === 0) return '—';
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return (Math.round(avg * 10) / 10).toFixed(1);
}

/**
 * Headers that prefix a star with `*` should not prefix the no-data dash.
 */
export function headerRatingStatValue(display: string): string {
  if (display === '—') return '—';
  return `*${display}`;
}
