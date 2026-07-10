import {
  computeEcommerceDeliveryFee,
  ECOMMERCE_DEFAULT_DELIVERY_FEE,
} from '../delivery-fee';

describe('computeEcommerceDeliveryFee', () => {
  it('charges flat delivery fee for any subtotal', () => {
    expect(computeEcommerceDeliveryFee(0)).toBe(150);
    expect(computeEcommerceDeliveryFee(999)).toBe(ECOMMERCE_DEFAULT_DELIVERY_FEE);
    expect(computeEcommerceDeliveryFee(1000)).toBe(ECOMMERCE_DEFAULT_DELIVERY_FEE);
    expect(computeEcommerceDeliveryFee(1500)).toBe(ECOMMERCE_DEFAULT_DELIVERY_FEE);
  });

  it('uses configured constant', () => {
    expect(ECOMMERCE_DEFAULT_DELIVERY_FEE).toBe(150);
  });
});
