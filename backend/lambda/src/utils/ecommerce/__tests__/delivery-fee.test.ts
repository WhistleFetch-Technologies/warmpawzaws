import {
  computeEcommerceDeliveryFee,
  ECOMMERCE_DEFAULT_DELIVERY_FEE,
} from '../delivery-fee';

describe('computeEcommerceDeliveryFee', () => {
  it('does not charge delivery on any subtotal', () => {
    expect(computeEcommerceDeliveryFee(0)).toBe(0);
    expect(computeEcommerceDeliveryFee(999)).toBe(0);
    expect(computeEcommerceDeliveryFee(1000)).toBe(ECOMMERCE_DEFAULT_DELIVERY_FEE);
    expect(computeEcommerceDeliveryFee(1500)).toBe(0);
  });

  it('uses configured constant', () => {
    expect(ECOMMERCE_DEFAULT_DELIVERY_FEE).toBe(0);
  });
});
