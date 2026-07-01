import type { BenefitContext, BenefitResult, BenefitStrategy } from '../types';
import {
  applyMaximumDiscount,
  calculateRemainingAmount,
  lineItemsSubtotal,
} from '../math';

export const BOGO_BENEFIT_TYPE = 'buy_x_get_y';

export class BogoBenefitStrategy implements BenefitStrategy {
  readonly benefitType = BOGO_BENEFIT_TYPE;

  supports(context: BenefitContext): boolean {
    return (
      context.benefitType === BOGO_BENEFIT_TYPE ||
      context.promotionType === BOGO_BENEFIT_TYPE
    );
  }

  calculate(context: BenefitContext): BenefitResult {
    const items = context.items ?? [];
    const buyQty = context.buyQuantity || 2;
    const getQty = context.getQuantity || 1;
    const discountPercent = context.getDiscountPercent ?? 100;

    const totalQty = items.reduce((s, i) => s + i.quantity, 0);
    const setSize = buyQty + getQty;
    const completeSets = Math.floor(totalQty / setSize);

    if (completeSets === 0 || items.length === 0) {
      return {
        discountAmount: 0,
        finalAmount: context.originalAmount,
        appliedBenefit: BOGO_BENEFIT_TYPE,
      };
    }

    const sorted = [...items].sort((a, b) => a.unitPrice - b.unitPrice);
    let freeRemaining = completeSets * getQty;
    let discountAmount = 0;

    for (const item of sorted) {
      if (freeRemaining <= 0) break;
      const freeFrom = Math.min(freeRemaining, item.quantity);
      discountAmount += (item.unitPrice * freeFrom * discountPercent) / 100;
      freeRemaining -= freeFrom;
    }

    const cartTotal = lineItemsSubtotal(items);
    discountAmount = applyMaximumDiscount(
      discountAmount,
      context.maxDiscount,
      cartTotal
    );

    return {
      discountAmount,
      finalAmount: calculateRemainingAmount(context.originalAmount, discountAmount),
      appliedBenefit: BOGO_BENEFIT_TYPE,
      calculationMetadata: { buyQty, getQty, discountPercent, completeSets },
    };
  }
}
