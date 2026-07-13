import {
  ECOMMERCE_EXCLUDED_MEAL_PRODUCT_CATEGORIES,
  isEcommerceExcludedMealProductCategory,
  isMealProductLegacyCategory,
  isMealProductPurchaseType,
  isProductRowExcludedFromEcommerceStorefront,
  MEAL_PRODUCT_LEGACY_CATEGORIES,
  STOREFRONT_EXCLUDE_MEAL_PRODUCTS_SQL,
} from '../ecommerce-storefront-product-filter';

describe('ecommerce-storefront-product-filter', () => {
  it('defines legacy meal categories used by nutrition catalog', () => {
    expect(MEAL_PRODUCT_LEGACY_CATEGORIES).toContain('meal_plan');
    expect(MEAL_PRODUCT_LEGACY_CATEGORIES).toContain('food');
  });

  it('excludes meal_plan and nutrition from storefront but not generic food', () => {
    expect(ECOMMERCE_EXCLUDED_MEAL_PRODUCT_CATEGORIES).toEqual(['meal_plan', 'nutrition']);
    expect(isEcommerceExcludedMealProductCategory('meal_plan')).toBe(true);
    expect(isEcommerceExcludedMealProductCategory('nutrition')).toBe(true);
    expect(isEcommerceExcludedMealProductCategory('food')).toBe(false);
    expect(isMealProductLegacyCategory('food')).toBe(true);
  });

  it('detects meal subscription purchase types', () => {
    expect(isMealProductPurchaseType('WEEKLY_PLAN')).toBe(true);
    expect(isMealProductPurchaseType('MONTHLY_PLAN')).toBe(true);
    expect(isMealProductPurchaseType('ONE_TIME')).toBe(true);
    expect(isMealProductPurchaseType('')).toBe(false);
    expect(isProductRowExcludedFromEcommerceStorefront({ purchase_type: 'WEEKLY_PLAN' })).toBe(true);
    expect(isProductRowExcludedFromEcommerceStorefront({ purchase_type: 'ONE_TIME' })).toBe(false);
  });

  it('flags product rows that belong to meal catalog', () => {
    expect(isProductRowExcludedFromEcommerceStorefront({ category: 'meal_plan' })).toBe(true);
    expect(isProductRowExcludedFromEcommerceStorefront({ category: 'food' })).toBe(false);
    expect(isProductRowExcludedFromEcommerceStorefront({ purchase_type: 'WEEKLY_PLAN' })).toBe(true);
    expect(isProductRowExcludedFromEcommerceStorefront({ category: 'toys' })).toBe(false);
  });

  it('exports SQL fragment for storefront queries', () => {
    expect(STOREFRONT_EXCLUDE_MEAL_PRODUCTS_SQL).toContain('meal_plans');
    expect(STOREFRONT_EXCLUDE_MEAL_PRODUCTS_SQL).toContain("'meal_plan'");
  });
});
