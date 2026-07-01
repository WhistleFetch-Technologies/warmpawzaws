import type { BenefitContext, BenefitResult, BenefitStrategy } from '../types';
import {
  applyMaximumDiscount,
  calculateRemainingAmount,
  computeFlatDiscount,
  computePercentageDiscount,
} from '../math';

export const LOYALTY_BENEFIT_TYPE = 'loyalty';

/** Service booking loyalty — percentage or fixed on booking amount. */
export class LoyaltyBenefitStrategy implements BenefitStrategy {
  readonly benefitType = LOYALTY_BENEFIT_TYPE;

  supports(context: BenefitContext): boolean {
    return (
      context.benefitType === LOYALTY_BENEFIT_TYPE ||
      context.promotionType === LOYALTY_BENEFIT_TYPE
    );
  }

  calculate(context: BenefitContext): BenefitResult {
    const base = context.currentAmount;
    const value = context.discountValue ?? 0;
    const raw =
      context.discountType === 'fixed'
        ? computeFlatDiscount(value)
        : computePercentageDiscount(base, value);
    const discountAmount = applyMaximumDiscount(raw, context.maxDiscount, base);

    return {
      discountAmount,
      finalAmount: calculateRemainingAmount(context.originalAmount, discountAmount),
      appliedBenefit: LOYALTY_BENEFIT_TYPE,
      calculationMetadata: { discountType: context.discountType },
    };
  }
}
