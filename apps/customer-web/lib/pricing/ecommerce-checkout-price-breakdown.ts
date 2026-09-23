import type { CartPricingBreakdown } from '@/lib/ecommerce/cart-pricing';
import type { PriceBreakdownLine } from './types';

export type EcommerceCheckoutBreakdownOptions = {
  /** e.g. "10% OFF" or campaign name from calculate-cart */
  promotionLabel?: string;
  /** Wallet amount applied at checkout (display only). */
  walletAmount?: number;
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

  const walletAmount = Math.max(0, Number(options.walletAmount) || 0);
  if (walletAmount > 0.009) {
    lines.push({
      kind: 'wallet',
      label: 'Wallet',
      amount: -walletAmount,
    });
  }

  const payable = Math.max(0, Math.round((pricing.total - walletAmount) * 100) / 100);
  lines.push({
    kind: 'final',
    label: walletAmount > 0.009 ? 'You pay' : 'Total',
    amount: payable,
    emphasis: 'total',
  });

  return lines;
}
