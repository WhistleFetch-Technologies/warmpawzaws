import type { CartPricingBreakdown } from '@/lib/ecommerce/cart-pricing';
import type { PriceBreakdownLine } from './types';

export type EcommerceCheckoutBreakdownOptions = {
  /** e.g. "10% OFF" or campaign name from calculate-cart */
  promotionLabel?: string;
};

/** Maps ecommerce cart pricing to checkout order-summary lines (Option A: MRP + explicit promo). */
export function buildEcommerceCheckoutPriceLines(
  pricing: CartPricingBreakdown,
  options: EcommerceCheckoutBreakdownOptions = {},
): PriceBreakdownLine[] {
  const lines: PriceBreakdownLine[] = [
    {
      kind: 'subtotal',
      label: 'Item total (MRP)',
      amount: pricing.lineSubtotal,
    },
  ];

  const promotionDiscount = pricing.discount;
  if (promotionDiscount > 0) {
    const promoLabel =
      options.promotionLabel?.trim() ||
      (pricing.promotionSource === 'admin'
        ? 'Platform promotion'
        : pricing.promotionSource === 'vendor'
          ? 'Store offer'
          : 'Promotion savings');

    lines.push({
      kind: 'savings',
      label: promoLabel,
      amount: -promotionDiscount,
      emphasis: 'discount',
    });

    lines.push({
      kind: 'subtotal',
      label: 'After promotion',
      amount: pricing.subtotalAfterDiscount,
      emphasis: 'muted',
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
      label: 'GST (included in MRP)',
      amount: pricing.taxAmount,
      emphasis: 'muted',
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
