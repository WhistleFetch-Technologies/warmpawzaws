import {
  computeCartPricing,
  computeCouponDiscount,
  calculateVendorDeliveryFee,
  type PricingCartLine,
  type CartPricingCoupon,
} from '../ecommerce/cart-pricing';

const line = (
  partial: Partial<PricingCartLine> & Pick<PricingCartLine, 'id' | 'name' | 'price' | 'quantity'>
): PricingCartLine => ({
  vendorId: 'default',
  ...partial,
});

describe('computeCartPricing', () => {
  it('computes line subtotal for a single vendor', () => {
    const cart = [
      line({ id: 'a', name: 'A', price: 90, quantity: 1 }),
      line({ id: 'b', name: 'B', price: 234, quantity: 1 }),
    ];
    const result = computeCartPricing(cart);
    expect(result.lineSubtotal).toBe(324);
    expect(result.byVendor).toHaveLength(1);
    expect(result.byVendor[0].subtotal).toBe(324);
  });

  it('charges standard delivery on all order values', () => {
    const cart = [line({ id: 'a', name: 'A', price: 100, quantity: 1 })];
    const result = computeCartPricing(cart);
    expect(result.deliveryFees).toBe(150);
    expect(result.freeDeliveryGap).toBe(0);
  });

  it('charges delivery fee even when subtotal is high', () => {
    const cart = [line({ id: 'a', name: 'A', price: 1000, quantity: 1 })];
    const result = computeCartPricing(cart);
    expect(result.deliveryFees).toBe(150);
    expect(result.freeDeliveryGap).toBe(0);
    expect(result.total).toBe(1150);
  });

  it('groups multi-vendor carts but charges one order-level delivery fee (never per-vendor)', () => {
    const cart = [
      line({ id: 'a', name: 'A', price: 100, quantity: 1, vendorId: 'vendor1' }),
      line({ id: 'b', name: 'B', price: 100, quantity: 1, vendorId: 'vendor2' }),
    ];
    const result = computeCartPricing(cart);
    expect(result.byVendor).toHaveLength(2);
    // Order-level rule: flat ₹150 delivery on all cart values.
    expect(result.deliveryFees).toBe(150);
  });

  it('applies percentage coupon with max cap', () => {
    const cart = [line({ id: 'a', name: 'A', price: 2000, quantity: 1 })];
    const coupons: CartPricingCoupon[] = [
      {
        id: '1',
        code: 'HALF',
        type: 'percentage',
        value: 50,
        minOrder: 0,
        maxDiscount: 500,
        description: '50% off max 500',
      },
    ];
    const result = computeCartPricing(cart, { appliedCoupons: coupons });
    expect(result.discount).toBe(500);
    expect(result.subtotalAfterDiscount).toBe(1500);
  });

  it('applies delivery-free coupon', () => {
    const cart = [line({ id: 'a', name: 'A', price: 100, quantity: 1 })];
    const coupons: CartPricingCoupon[] = [
      {
        id: '2',
        code: 'FREEDEL',
        type: 'delivery',
        value: 0,
        minOrder: 0,
        description: 'Free delivery',
      },
    ];
    const result = computeCartPricing(cart, { appliedCoupons: coupons });
    expect(result.deliveryFees).toBe(0);
    expect(result.freeDeliveryGap).toBe(0);
  });

  it('total = subtotalAfterDiscount + deliveryFees + giftWrapFee + protectionFee (GST is informational, never added on top)', () => {
    const cart = [line({ id: 'a', name: 'A', price: 1180, quantity: 1 })];
    const result = computeCartPricing(cart);
    expect(result.subtotalAfterDiscount).toBe(1180);
    expect(result.deliveryFees).toBe(150);
    expect(result.total).toBe(1330);
    // taxAmount is informational only and must not have been added into total.
    expect(result.total).not.toBe(1180 + result.taxAmount);
  });

  it('only ONE promotion applies — the larger of coupon vs seller/admin promotion wins, never both summed', () => {
    const cart = [line({ id: 'a', name: 'A', price: 1000, quantity: 1 })];
    const coupons: CartPricingCoupon[] = [
      { id: '1', code: 'OFF100', type: 'fixed', value: 100, minOrder: 0, description: '100 off' },
    ];
    const result = computeCartPricing(cart, {
      appliedCoupons: coupons,
      sellerPromotion: { autoDiscount: 250, source: 'vendor' },
    });
    // Seller promotion (250) beats the coupon (100) — only the winner is applied, not 350.
    expect(result.discount).toBe(250);
    expect(result.subtotalAfterDiscount).toBe(750);
    expect(result.promotionSource).toBe('vendor');
  });

  it('tags promotionSource as admin when the winning discount is an admin/platform campaign', () => {
    const cart = [line({ id: 'a', name: 'A', price: 1000, quantity: 1 })];
    const result = computeCartPricing(cart, {
      sellerPromotion: { autoDiscount: 150, source: 'admin' },
    });
    expect(result.discount).toBe(150);
    expect(result.promotionSource).toBe('admin');
  });

  it('leaves promotionSource undefined when the legacy coupon wins over the seller promotion', () => {
    const cart = [line({ id: 'a', name: 'A', price: 1000, quantity: 1 })];
    const coupons: CartPricingCoupon[] = [
      { id: '1', code: 'BIG', type: 'fixed', value: 300, minOrder: 0, description: '300 off' },
    ];
    const result = computeCartPricing(cart, {
      appliedCoupons: coupons,
      sellerPromotion: { autoDiscount: 50, source: 'vendor' },
    });
    expect(result.discount).toBe(300);
    expect(result.promotionSource).toBeUndefined();
  });
});

describe('calculateVendorDeliveryFee', () => {
  it('uses express fee when selected', () => {
    expect(
      calculateVendorDeliveryFee('default', 100, { deliverySpeed: 'express' }, 100)
    ).toBe(150);
  });
});

describe('computeCouponDiscount', () => {
  it('sums fixed coupons', () => {
    const coupons: CartPricingCoupon[] = [
      {
        id: '1',
        code: 'OFF200',
        type: 'fixed',
        value: 200,
        minOrder: 0,
        description: '200 off',
      },
    ];
    expect(computeCouponDiscount(1000, coupons)).toBe(200);
  });
});
