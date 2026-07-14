import type { BenefitContext, BenefitResult, BenefitStrategy } from '../types';
import {
  applyMaximumDiscount,
  calculateRemainingAmount,
  computePercentageDiscount,
  lineItemsSubtotal,
} from '../math';

export const BUNDLE_BENEFIT_TYPE = 'bundle';

export class BundleBenefitStrategy implements BenefitStrategy {
  readonly benefitType = BUNDLE_BENEFIT_TYPE;

  supports(context: BenefitContext): boolean {
    return (
      context.benefitType === BUNDLE_BENEFIT_TYPE ||
      context.promotionType === BUNDLE_BENEFIT_TYPE
    );
  }

  calculate(context: BenefitContext): BenefitResult {
    const items = context.items ?? [];
    const bundleIds = context.bundleProductIds ?? [];
    const cartIds = new Set(items.map((i) => String(i.productId ?? i.id ?? '')));

    if (bundleIds.length === 0 || !bundleIds.every((id) => cartIds.has(id))) {
      return {
        discountAmount: 0,
        finalAmount: context.originalAmount,
        appliedBenefit: BUNDLE_BENEFIT_TYPE,
      };
    }

    const bundleItems = items.filter((i) =>
      bundleIds.includes(String(i.productId ?? i.id ?? ''))
    );
    const bundleTotal = lineItemsSubtotal(bundleItems);
    const pct = context.bundleDiscountPercent ?? 15;
    const raw = computePercentageDiscount(bundleTotal, pct);
    const cartTotal = lineItemsSubtotal(items);
    const discountAmount = applyMaximumDiscount(raw, context.maxDiscount, cartTotal);

    return {
      discountAmount,
      finalAmount: calculateRemainingAmount(context.originalAmount, discountAmount),
      appliedBenefit: BUNDLE_BENEFIT_TYPE,
      calculationMetadata: { bundleTotal, pct },
    };
  }
}
