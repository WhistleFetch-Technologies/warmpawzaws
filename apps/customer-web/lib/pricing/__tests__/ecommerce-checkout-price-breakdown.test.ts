import type { CartPricingBreakdown } from '@/lib/ecommerce/cart-pricing';
import { buildEcommerceCheckoutPriceLines } from '../ecommerce-checkout-price-breakdown';

const pricing = {
  lineSubtotal: 1000,
  discount: 100,
  subtotalAfterDiscount: 900,
  deliveryFees: 40,
  giftWrapFee: 0,
  protectionFee: 0,
  taxAmount: 0,
  taxResult: { cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
  total: 940,
  promotionSource: 'admin' as const,
  freeDeliveryGap: 0,
  byVendor: [],
  itemCount: 1,
} as unknown as CartPricingBreakdown;

describe('ecommerce checkout wallet line', () => {
  test('adds Wallet and You pay after wallet', () => {
    const lines = buildEcommerceCheckoutPriceLines(pricing, { walletAmount: 50 });
    expect(lines.find((l) => l.kind === 'wallet')).toMatchObject({
      label: 'Wallet',
      amount: -50,
    });
    expect(lines.find((l) => l.kind === 'final')).toMatchObject({
      label: 'You pay',
      amount: 890,
    });
  });

  test('keeps Total when wallet is unused', () => {
    const lines = buildEcommerceCheckoutPriceLines(pricing);
    expect(lines.some((l) => l.kind === 'wallet')).toBe(false);
    expect(lines.find((l) => l.kind === 'final')).toMatchObject({
      label: 'Total',
      amount: 940,
    });
  });
});
