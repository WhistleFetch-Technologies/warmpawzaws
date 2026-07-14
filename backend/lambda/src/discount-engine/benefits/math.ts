/** Matches vendor-promotion-engine PROMOTION_DISCOUNT_TOLERANCE. */
export const BENEFIT_AMOUNT_TOLERANCE = 1;

export function safeCurrencyMath(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value;
}

export function clampNonNegative(amount: number): number {
  return Math.max(0, safeCurrencyMath(amount));
}

export function computePercentageDiscount(base: number, percent: number): number {
  const b = safeCurrencyMath(base);
  const p = safeCurrencyMath(percent);
  if (b <= 0 || p <= 0) return 0;
  return (b * p) / 100;
}

export function computeFlatDiscount(flat: number): number {
  const f = safeCurrencyMath(flat);
  if (f <= 0) return 0;
  return f;
}

/**
 * Applies max discount cap then clamps to maxBase (legacy capDiscount behaviour).
 */
export function applyMaximumDiscount(
  discountAmount: number,
  maxDiscount: number | null | undefined,
  maxBase: number
): number {
  let d = safeCurrencyMath(discountAmount);
  // 0 / negative means "no cap" — seller UI often persists 0.00 instead of NULL.
  if (maxDiscount != null && maxDiscount > 0 && d > maxDiscount) {
    d = maxDiscount;
  }
  return Math.min(clampNonNegative(d), clampNonNegative(maxBase));
}

export function calculateRemainingAmount(original: number, discount: number): number {
  return Math.max(0, safeCurrencyMath(original) - safeCurrencyMath(discount));
}

export function benefitAmountsWithinTolerance(a: number, b: number): boolean {
  return Math.abs(safeCurrencyMath(a) - safeCurrencyMath(b)) <= BENEFIT_AMOUNT_TOLERANCE;
}

export function lineItemsSubtotal(
  items: Array<{ quantity: number; unitPrice: number }>
): number {
  return items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
}
