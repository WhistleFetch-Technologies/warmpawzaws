import {
  normalizeEcommerceProductPricing,
  productDiscountPercent,
} from '../product-ecommerce-pricing';

describe('product-ecommerce-pricing', () => {
  it('requires MRP and defaults selling to MRP when omitted', () => {
    const r = normalizeEcommerceProductPricing({ compare_at_price: 1598 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pricing.mrp).toBe(1598);
      expect(r.pricing.sellingPrice).toBe(1598);
      expect(productDiscountPercent(r.pricing.mrp, r.pricing.sellingPrice)).toBe(0);
    }
  });

  it('computes discount when selling is below MRP', () => {
    const r = normalizeEcommerceProductPricing({ compare_at_price: 1598, price: 659 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(productDiscountPercent(r.pricing.mrp, r.pricing.sellingPrice)).toBe(59);
    }
  });

  it('rejects selling above MRP', () => {
    const r = normalizeEcommerceProductPricing({ compare_at_price: 100, price: 150 });
    expect(r.ok).toBe(false);
  });

  it('legacy lone price column is treated as MRP', () => {
    const r = normalizeEcommerceProductPricing({ price: 349 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pricing.mrp).toBe(349);
      expect(r.pricing.sellingPrice).toBe(349);
    }
  });
});
