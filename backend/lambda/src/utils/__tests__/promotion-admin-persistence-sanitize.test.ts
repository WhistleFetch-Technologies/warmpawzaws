import { sanitizePromotionsTablePayload } from '../promotion-admin-persistence';

describe('sanitizePromotionsTablePayload', () => {
  it('maps min_order_value to min_order_amount and strips aliases', () => {
    const out = sanitizePromotionsTablePayload({
      name: 'Test',
      min_order_value: 100,
      discountType: 'percentage',
      validFrom: '2026-07-01',
      selected_targets: { categories: ['vet'] },
      discount_value: 10,
    });
    expect(out.min_order_amount).toBe(100);
    expect(out.min_order_value).toBeUndefined();
    expect(out.discountType).toBeUndefined();
    expect(out.validFrom).toBeUndefined();
    expect(out.selected_targets).toBeUndefined();
    expect(out.name).toBe('Test');
    expect(out.discount_value).toBe(10);
  });

  it('keeps existing min_order_amount when both present', () => {
    const out = sanitizePromotionsTablePayload({
      min_order_amount: 50,
      min_order_value: 100,
    });
    expect(out.min_order_amount).toBe(50);
    expect(out.min_order_value).toBeUndefined();
  });
});
