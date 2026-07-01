import { getBenefitCalculator } from '../benefit-calculator';
import { resolveDiscountWithLegacyFallback } from '../compare';
import type { BenefitContext } from '../types';
import { FLAT_BENEFIT_TYPE, PERCENTAGE_BENEFIT_TYPE } from '../strategies';

export function computeCouponDiscountAmount(params: {
  discountType: string;
  discountValue: number | string;
  amount: number;
  maxDiscountAmount?: number | null;
  legacyAmount: number;
}): number {
  const ctx: BenefitContext = {
    originalAmount: params.amount,
    currentAmount: params.amount,
    eligibleAmount: params.amount,
    discountType: params.discountType === 'percentage' ? 'percentage' : 'fixed',
    discountValue: parseFloat(String(params.discountValue || 0)),
    maxDiscount: params.maxDiscountAmount,
  };
  const strategy =
    ctx.discountType === 'percentage' ? PERCENTAGE_BENEFIT_TYPE : FLAT_BENEFIT_TYPE;
  const result = getBenefitCalculator().calculateWithStrategy(ctx, strategy);
  return resolveDiscountWithLegacyFallback(
    'admin-coupon',
    params.legacyAmount,
    result.discountAmount
  );
}
