import {
  normalizeEcommerceProductPricing,
  productDiscountPercent,
} from '../product-ecommerce-pricing';

describe('product-ecommerce-pricing — single-price model', () => {
  it('accepts price field and returns it as the canonical price', () => {
    const r = normalizeEcommerceProductPricing({ price: 1598 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pricing.price).toBe(1598);
    }
  });

  it('accepts compare_at_price (legacy MRP field) as the canonical price', () => {
    const r = normalizeEcommerceProductPricing({ compare_at_price: 1598 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pricing.price).toBe(1598);
    }
  });

  it('prefers price over compare_at_price when both are present', () => {
    const r = normalizeEcommerceProductPricing({ compare_at_price: 1598, price: 659 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pricing.price).toBe(659);
    }
  });

  it('rejects missing price', () => {
    const r = normalizeEcommerceProductPricing({});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.field).toBe('price');
    }
  });

  it('productDiscountPercent calculates discount from promotion compare_at_price', () => {
    expect(productDiscountPercent(1598, 659)).toBe(59);
    expect(productDiscountPercent(500, 500)).toBe(0);
    expect(productDiscountPercent(0, 100)).toBe(0);
  });
});
