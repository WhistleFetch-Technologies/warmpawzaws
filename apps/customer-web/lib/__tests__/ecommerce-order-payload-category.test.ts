import { computeCartPricing } from '../ecommerce/cart-pricing';

jest.mock('@/lib/customer-id-storage', () => ({
  getResolvedCustomerId: () => 'customer-uuid',
}));

jest.mock('@/lib/ecommerce/cart-pricing', () => {
  const actual = jest.requireActual('../ecommerce/cart-pricing');
  return {
    ...actual,
    readPricingOptionsForCheckout: () => ({}),
  };
});

import { buildEcommerceOrderPayload } from '@/components/customer/ecommerce/useEcommerceCheckout';
import type { CartItem } from '@/context/CartContext';

describe('buildEcommerceOrderPayload category fields (Step A test 6)', () => {
  const cart: CartItem[] = [
    {
      id: 'prod-bed',
      name: 'Zara Luxury Wooden Pet Bed',
      price: 18999,
      quantity: 1,
      vendorId: 'vendor-1',
      categoryId: '11111111-1111-4111-8111-111111111111',
    },
  ];

  const pricing = computeCartPricing(cart, {
    sellerPromotion: { autoDiscount: 2849.85, source: 'admin' },
  });

  it('adds categoryId without changing discount, total, tax, or shipping', () => {
    const payload = buildEcommerceOrderPayload(
      '9999999999',
      cart,
      pricing,
      { city: 'Mumbai', state: 'Maharashtra', pincode: '400001' }
    );

    expect(payload.items[0].categoryId).toBe('11111111-1111-4111-8111-111111111111');
    expect(payload.items[0].category).toBe('11111111-1111-4111-8111-111111111111');
    expect(payload.discountAmount).toBe(pricing.discount);
    expect(payload.totalAmount).toBe(pricing.total);
    expect(payload.taxAmount).toBe(pricing.taxAmount);
    expect(payload.shippingFee).toBe(pricing.deliveryFees);
    expect(payload.subtotal).toBe(pricing.lineSubtotal);
    expect(payload.discountAmount).toBe(2849.85);
    expect(payload.shippingFee).toBe(150);
    expect(payload.totalAmount).toBe(18999 - 2849.85 + 150);
  });
});
