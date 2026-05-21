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

  it('charges standard delivery when below free-delivery threshold', () => {
    const cart = [line({ id: 'a', name: 'A', price: 100, quantity: 1 })];
    const result = computeCartPricing(cart);
    expect(result.deliveryFees).toBe(60);
    expect(result.freeDeliveryGap).toBeGreaterThan(0);
  });

  it('waives delivery when vendor subtotal meets free-delivery minimum', () => {
    const cart = [line({ id: 'a', name: 'A', price: 1000, quantity: 1 })];
    const result = computeCartPricing(cart);
    expect(result.deliveryFees).toBe(0);
    expect(result.freeDeliveryGap).toBe(0);
  });

  it('groups multi-vendor carts and sums delivery per vendor', () => {
    const cart = [
      line({ id: 'a', name: 'A', price: 100, quantity: 1, vendorId: 'vendor1' }),
      line({ id: 'b', name: 'B', price: 100, quantity: 1, vendorId: 'vendor2' }),
    ];
    const result = computeCartPricing(cart);
    expect(result.byVendor).toHaveLength(2);
    expect(result.deliveryFees).toBe(120);
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
  });
});

describe('calculateVendorDeliveryFee', () => {
  it('uses express fee when selected', () => {
    expect(
      calculateVendorDeliveryFee('default', 100, { deliverySpeed: 'express' })
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
