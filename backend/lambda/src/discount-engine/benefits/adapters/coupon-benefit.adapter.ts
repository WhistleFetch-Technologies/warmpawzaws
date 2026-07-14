import { DiscountDomain } from '../../enums/discount-domain';
import { DiscountOwner } from '../../enums/discount-owner';
import { DiscountSource } from '../../enums/discount-source';
import { buildRuntimeBenefitCandidate } from '../../candidates/runtime-candidate';
import { computeBenefitFromCandidate } from '../../candidates/bridges/candidate-to-benefit-context';

export function computeCouponDiscountAmount(params: {
  discountType: string;
  discountValue: number | string;
  amount: number;
  maxDiscountAmount?: number | null;
  legacyAmount: number;
}): number {
  const candidate = buildRuntimeBenefitCandidate({
    domain: DiscountDomain.ECOMMERCE,
    owner: DiscountOwner.PLATFORM,
    source: DiscountSource.PLATFORM_COUPON,
    benefits: {
      type: 'coupon',
      discountType: params.discountType === 'percentage' ? 'percentage' : 'fixed',
      value: parseFloat(String(params.discountValue || 0)),
      maxDiscount: params.maxDiscountAmount,
    },
  });
  return computeBenefitFromCandidate(candidate, {
    originalAmount: params.amount,
    currentAmount: params.amount,
    eligibleAmount: params.amount,
    legacyAmount: params.legacyAmount,
    label: 'admin-coupon',
  });
}
