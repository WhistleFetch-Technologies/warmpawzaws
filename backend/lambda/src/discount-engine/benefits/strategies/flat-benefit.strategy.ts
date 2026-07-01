import type { BenefitContext, BenefitResult, BenefitStrategy } from '../types';
import {
  applyMaximumDiscount,
  calculateRemainingAmount,
  computeFlatDiscount,
} from '../math';

export const FLAT_BENEFIT_TYPE = 'flat';

export class FlatBenefitStrategy implements BenefitStrategy {
  readonly benefitType = FLAT_BENEFIT_TYPE;

  supports(context: BenefitContext): boolean {
    return context.discountType === 'fixed';
  }

  calculate(context: BenefitContext): BenefitResult {
    const base = context.eligibleAmount ?? context.currentAmount;
    const raw = computeFlatDiscount(context.discountValue ?? 0);
    const discountAmount = applyMaximumDiscount(raw, context.maxDiscount, base);
    return {
      discountAmount,
      finalAmount: calculateRemainingAmount(context.originalAmount, discountAmount),
      appliedBenefit: FLAT_BENEFIT_TYPE,
      calculationMetadata: { flat: context.discountValue },
    };
  }
}
