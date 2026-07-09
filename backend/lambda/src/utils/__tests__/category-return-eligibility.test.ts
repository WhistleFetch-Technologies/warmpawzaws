import { computeItemReturnEligibility, orderHasReturnableItems } from '../category-return-eligibility';
import { isReturnWindowExpired } from '../return-window';

describe('computeItemReturnEligibility', () => {
  const base = {
    orderStatus: 'delivered',
    deliveredAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    productIsReturnable: true,
    categoryReturnsEnabled: true,
    returnWindowDays: 7,
    orderQuantity: 1,
    returnedQuantity: 0,
  };

  it('allows Pet Clothing category when returns_enabled is true', () => {
    const result = computeItemReturnEligibility({
      ...base,
      categoryReturnsEnabled: true,
    });
    expect(result.isReturnable).toBe(true);
    expect(result.blockReason).toBeNull();
  });

  it('blocks non-clothing category when returns_enabled is false', () => {
    const result = computeItemReturnEligibility({
      ...base,
      categoryReturnsEnabled: false,
    });
    expect(result.isReturnable).toBe(false);
    expect(result.blockReason).toContain('not available for this product category');
  });

  it('blocks when return window expired', () => {
    const result = computeItemReturnEligibility({
      ...base,
      deliveredAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
      returnWindowDays: 7,
    });
    expect(result.isReturnable).toBe(false);
    expect(result.blockReason).toContain('Return window');
  });

  it('blocks when product is_returnable is false', () => {
    const result = computeItemReturnEligibility({
      ...base,
      productIsReturnable: false,
    });
    expect(result.isReturnable).toBe(false);
    expect(result.blockReason).toContain('non-returnable');
  });

  it('allows partial eligibility in mixed cart via per-item flags', () => {
    const clothing = computeItemReturnEligibility({ ...base, categoryReturnsEnabled: true });
    const food = computeItemReturnEligibility({ ...base, categoryReturnsEnabled: false });
    expect(clothing.isReturnable).toBe(true);
    expect(food.isReturnable).toBe(false);
    expect(
      orderHasReturnableItems([
        { isReturnable: clothing.isReturnable } as any,
        { isReturnable: food.isReturnable } as any,
      ])
    ).toBe(true);
  });

  it('blocks undelivered orders', () => {
    const result = computeItemReturnEligibility({
      ...base,
      orderStatus: 'shipped',
    });
    expect(result.isReturnable).toBe(false);
    expect(result.blockReason).toContain('delivered');
  });
});

describe('isReturnWindowExpired integration', () => {
  it('treats day 7 as inside a 7-day window', () => {
    const deliveredAt = new Date(Date.now() - 7 * 86_400_000).toISOString();
    expect(isReturnWindowExpired(deliveredAt, 7)).toBe(false);
  });
});
