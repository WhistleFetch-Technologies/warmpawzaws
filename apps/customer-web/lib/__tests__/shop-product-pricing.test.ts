import {
  getProductDiscountPercent,
  resolveProductCompareAtPrice,
} from '../shop-product-pricing';

describe('shop-product-pricing', () => {
  it('resolves compare_at_price and original_price aliases', () => {
    expect(resolveProductCompareAtPrice({ compare_at_price: 1598 })).toBe(1598);
    expect(resolveProductCompareAtPrice({ original_price: 999 })).toBe(999);
    expect(
      resolveProductCompareAtPrice({
        price: 669,
        compare_at_price: 1598,
        original_price: 2000,
      }),
    ).toBe(2000);
  });

  it('computes discount from MRP and selling price (matches shop cards)', () => {
    expect(getProductDiscountPercent(659, 1598)).toBe(59);
    expect(getProductDiscountPercent(669, 1598)).toBe(58);
    expect(getProductDiscountPercent(1000, 1000)).toBe(0);
    expect(getProductDiscountPercent(1200, undefined)).toBe(0);
  });
});
