import type { CartPricingBreakdown } from '@/lib/ecommerce/cart-pricing';
import type { PriceBreakdownLine } from './types';

/** Maps ecommerce cart pricing to Sprint 1 PriceBreakdown lines — no API changes */
export function buildEcommerceCheckoutPriceLines(
  pricing: CartPricingBreakdown
): PriceBreakdownLine[] {
  const lines: PriceBreakdownLine[] = [
    {
      kind: 'subtotal',
      label: 'Subtotal',
      amount: pricing.lineSubtotal,
    },
  ];

  if ((pricing.couponDiscount ?? 0) > 0) {
    lines.push({
      kind: 'coupon',
      label: 'Coupon discount',
      amount: -(pricing.couponDiscount ?? 0),
      emphasis: 'discount',
    });
  }

  if ((pricing.sellerPromotionDiscount ?? 0) > 0) {
    lines.push({
      kind: 'vendor_discount',
      label: 'Store offer',
      amount: -(pricing.sellerPromotionDiscount ?? 0),
      emphasis: 'discount',
    });
  }

  if (pricing.deliveryFees > 0) {
    lines.push({
      kind: 'delivery_fee',
      label: 'Delivery',
      amount: pricing.deliveryFees,
    });
  }

  if (pricing.taxAmount > 0) {
    lines.push({
      kind: 'tax',
      label: 'Tax',
      amount: pricing.taxAmount,
    });
  }

  lines.push({
    kind: 'final',
    label: 'Total',
    amount: pricing.total,
    emphasis: 'total',
  });

  return lines;
}
