/** Default tolerance for rupee comparisons (avoids float noise). */
export const DEFAULT_PRICE_REDUCTION_EPSILON = 0.01;

/**
 * True when the customer pays strictly less than the list/base price (real reduction).
 */
export function hasEffectivePriceReduction(
  original: number,
  finalPrice: number,
  epsilon: number = DEFAULT_PRICE_REDUCTION_EPSILON
): boolean {
  if (!Number.isFinite(original) || !Number.isFinite(finalPrice)) {
    return false;
  }
  return original - finalPrice > epsilon;
}
