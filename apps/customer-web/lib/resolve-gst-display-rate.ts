/**
 * Aligns GST % labels with charged amounts when:
 * - API omits or zeroes `items[0].taxRate`, or
 * - `taxRate` disagrees with totals (e.g. HSN says 10% but `gst_rules.igst_percentage` charged 18% IGST).
 */
const MONEY_TOLERANCE_INR = 0.05;

export function resolveGstDisplayRatePercent(
  subtotal: number,
  totalTax: number,
  declaredRate: number,
  fallbackWhenInvalid = 18
): number {
  let rate = Number(declaredRate);
  if (!Number.isFinite(rate)) {
    rate = fallbackWhenInvalid;
  }

  if (subtotal <= 0) {
    return Number.isFinite(rate) && rate >= 0 ? rate : fallbackWhenInvalid;
  }

  const impliedRaw = (totalTax / subtotal) * 100;
  const roundedImplied = Math.round(impliedRaw * 100) / 100;
  const expectedTaxFromDeclared = (subtotal * rate) / 100;
  const taxDelta = Math.abs(expectedTaxFromDeclared - totalTax);

  if (totalTax <= 0) {
    if (rate > 0 && taxDelta > MONEY_TOLERANCE_INR) {
      return 0;
    }
    return rate < 0 ? fallbackWhenInvalid : rate;
  }

  if (rate <= 0 || taxDelta > MONEY_TOLERANCE_INR) {
    return roundedImplied;
  }

  if (!Number.isFinite(rate) || rate < 0) {
    return fallbackWhenInvalid;
  }
  return rate;
}
