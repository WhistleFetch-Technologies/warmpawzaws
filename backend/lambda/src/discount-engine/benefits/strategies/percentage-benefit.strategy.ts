import type { BenefitContext, BenefitResult, BenefitStrategy } from '../types';
import {
  applyMaximumDiscount,
  calculateRemainingAmount,
  computePercentageDiscount,
} from '../math';

export const PERCENTAGE_BENEFIT_TYPE = 'percentage';

export class PercentageBenefitStrategy implements BenefitStrategy {
  readonly benefitType = PERCENTAGE_BENEFIT_TYPE;

  supports(context: BenefitContext): boolean {
    return context.discountType === 'percentage';
  }

  calculate(context: BenefitContext): BenefitResult {
    const base = context.eligibleAmount ?? context.currentAmount;
    const raw = computePercentageDiscount(base, context.discountValue ?? 0);
    const discountAmount = applyMaximumDiscount(
      raw,
      context.maxDiscount,
      base
    );
    return {
      discountAmount,
      finalAmount: calculateRemainingAmount(context.originalAmount, discountAmount),
      appliedBenefit: PERCENTAGE_BENEFIT_TYPE,
      calculationMetadata: { base, percent: context.discountValue },
    };
  }
}
