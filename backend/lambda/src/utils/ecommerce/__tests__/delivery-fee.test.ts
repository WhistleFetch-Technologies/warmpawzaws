import {
  computeEcommerceDeliveryFee,
  ECOMMERCE_DEFAULT_DELIVERY_FEE,
  ECOMMERCE_FREE_DELIVERY_MIN_SUBTOTAL,
} from '../delivery-fee';

describe('computeEcommerceDeliveryFee', () => {
  it('charges default fee below free-delivery threshold', () => {
    expect(computeEcommerceDeliveryFee(999)).toBe(ECOMMERCE_DEFAULT_DELIVERY_FEE);
    expect(computeEcommerceDeliveryFee(0)).toBe(150);
  });

  it('is free at or above threshold', () => {
    expect(computeEcommerceDeliveryFee(1000)).toBe(0);
    expect(computeEcommerceDeliveryFee(1500)).toBe(0);
  });

  it('uses configured constants', () => {
    expect(ECOMMERCE_FREE_DELIVERY_MIN_SUBTOTAL).toBe(1000);
    expect(ECOMMERCE_DEFAULT_DELIVERY_FEE).toBe(150);
  });
});
