import type { BenefitContext, BenefitResult, BenefitStrategy } from '../types';
import { applyMaximumDiscount, computeFlatDiscount, computePercentageDiscount } from '../math';

export const CASHBACK_BENEFIT_TYPE = 'cashback';

/**
 * Cashback is a reward entitlement, not a payable discount.
 * discountAmount is always 0 so GST / payNow / settlement stay unchanged.
 * Configured value comes from the existing promotion row (discount_value / type).
 */
export class CashbackBenefitStrategy implements BenefitStrategy {
  readonly benefitType = CASHBACK_BENEFIT_TYPE;

  supports(context: BenefitContext): boolean {
    return (
      context.benefitType === CASHBACK_BENEFIT_TYPE ||
      context.promotionType === CASHBACK_BENEFIT_TYPE
    );
  }

  calculate(context: BenefitContext): BenefitResult {
    const base = context.eligibleAmount ?? context.currentAmount;
    const value = context.discountValue ?? 0;
    const raw =
      context.discountType === 'fixed'
        ? computeFlatDiscount(value)
        : computePercentageDiscount(base, value);
    const cashbackAmount = applyMaximumDiscount(raw, context.maxDiscount, base);

    return {
      discountAmount: 0,
      cashbackAmount,
      finalAmount: context.originalAmount,
      appliedBenefit: CASHBACK_BENEFIT_TYPE,
      calculationMetadata: {
        cashbackKind: 'reward',
        payableImpact: 'none',
        base,
        discountType: context.discountType ?? 'percentage',
        configuredValue: value,
      },
    };
  }
}
