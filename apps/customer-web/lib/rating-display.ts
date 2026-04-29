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
