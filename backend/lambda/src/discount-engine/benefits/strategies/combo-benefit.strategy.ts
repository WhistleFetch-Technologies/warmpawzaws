import type { BenefitContext, BenefitResult, BenefitStrategy } from '../types';
import {
  applyMaximumDiscount,
  calculateRemainingAmount,
  computePercentageDiscount,
} from '../math';

export const COMBO_BENEFIT_TYPE = 'combo';

export class ComboBenefitStrategy implements BenefitStrategy {
  readonly benefitType = COMBO_BENEFIT_TYPE;

  supports(context: BenefitContext): boolean {
    return (
      context.benefitType === COMBO_BENEFIT_TYPE ||
      context.promotionType === COMBO_BENEFIT_TYPE
    );
  }

  calculate(context: BenefitContext): BenefitResult {
    const base = context.currentAmount;
    const pct = context.comboDiscountPercent ?? context.discountValue ?? 0;
    const raw = computePercentageDiscount(base, pct);
    const discountAmount = applyMaximumDiscount(raw, context.maxDiscount, base);

    return {
      discountAmount,
      finalAmount: calculateRemainingAmount(context.originalAmount, discountAmount),
      appliedBenefit: COMBO_BENEFIT_TYPE,
      calculationMetadata: { pct },
    };
  }
}
