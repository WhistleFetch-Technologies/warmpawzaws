import { benefitAmountsWithinTolerance } from './math';

/**
 * Returns benefit amount when within tolerance; otherwise logs and returns legacy.
 * Production safety guard during Benefit Engine migration.
 */
export function resolveDiscountWithLegacyFallback(
  label: string,
  legacyAmount: number,
  benefitAmount: number
): number {
  if (benefitAmountsWithinTolerance(legacyAmount, benefitAmount)) {
    return benefitAmount;
  }
  console.warn('[benefit-engine] discount mismatch — using legacy result', {
    label,
    legacy: legacyAmount,
    benefit: benefitAmount,
  });
  return legacyAmount;
}

export function resolveBenefitResultWithLegacyFallback(
  label: string,
  legacyDiscount: number,
  originalAmount: number,
  benefitResult: { discountAmount: number; finalAmount: number; appliedBenefit: string }
): { discountAmount: number; finalAmount: number; appliedBenefit: string } {
  const discount = resolveDiscountWithLegacyFallback(
    label,
    legacyDiscount,
    benefitResult.discountAmount
  );
  return {
    discountAmount: discount,
    finalAmount: Math.max(0, originalAmount - discount),
    appliedBenefit: benefitResult.appliedBenefit,
  };
}
