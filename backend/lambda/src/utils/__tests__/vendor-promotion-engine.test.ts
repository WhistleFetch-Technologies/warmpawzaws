import {
  calculateBestCartPromotion,
  evaluatePromotionDiscount,
  normalizePromotionRow,
  type CartLineItem,
  type PromotionRow,
} from '../vendor-promotion-engine';

function promo(overrides: Partial<PromotionRow> & Pick<PromotionRow, 'id'>): PromotionRow {
  return normalizePromotionRow({
    name: 'Test',
    promotion_type: 'flash_sale',
    discount_type: 'percentage',
    discount_value: 10,
    start_date: '2020-01-01T00:00:00.000Z',
    end_date: '2099-12-31T23:59:59.999Z',
    is_active: true,
    ...overrides,
  } as Record<string, unknown>);
}

const lines: CartLineItem[] = [
  { productId: 'p1', quantity: 2, price: 100, categoryId: 'Toys' },
  { productId: 'p2', quantity: 1, price: 50, categoryId: 'Food' },
];

describe('vendor-promotion-engine', () => {
  it('applies percentage to scoped products only', () => {
    const p = promo({
      id: '1',
      applicable_products: ['p1'],
      discount_value: 10,
    });
    const result = evaluatePromotionDiscount(p, lines);
    expect(result?.discountAmount).toBe(20);
  });

  it('category_discount limits to category lines', () => {
    const p = promo({
      id: '2',
      promotion_type: 'category_discount',
      applicable_categories: ['Toys'],
      discount_value: 20,
    });
    const result = evaluatePromotionDiscount(p, lines);
    expect(result?.discountAmount).toBe(40);
  });

  it('bundle requires all bundle products', () => {
    const p = promo({
      id: '3',
      promotion_type: 'bundle',
      bundle_products: ['p1', 'p2'],
      bundle_discount: 10,
    });
    expect(evaluatePromotionDiscount(p, lines)?.discountAmount).toBe(25);

    const partial = promo({
      id: '4',
      promotion_type: 'bundle',
      bundle_products: ['p1', 'p3'],
      bundle_discount: 10,
    });
    expect(evaluatePromotionDiscount(partial, lines)).toBeNull();
  });

  it('BOGO calculates cheapest free items', () => {
    const p = promo({
      id: '5',
      promotion_type: 'buy_x_get_y',
      buy_quantity: 2,
      get_quantity: 1,
      get_discount_percent: 100,
    });
    const bogoLines: CartLineItem[] = [
      { productId: 'a', quantity: 1, price: 100 },
      { productId: 'b', quantity: 2, price: 50 },
    ];
    const result = evaluatePromotionDiscount(p, bogoLines);
    expect(result?.discountAmount).toBe(50);
  });

  it('calculateBestCartPromotion picks highest auto-eligible promo', () => {
    const low = promo({ id: 'low', discount_value: 5 });
    const high = promo({ id: 'high', discount_value: 15 });
    const coded = promo({ id: 'coded', code: 'SAVE', discount_value: 50 });
    const result = calculateBestCartPromotion([low, high, coded], lines);
    expect(result.bestPromotion?.promotionId).toBe('high');
    expect(result.totalSavings).toBe(37.5);
  });

  it('rejects new_users promo for returning customers', () => {
    const p = promo({
      id: 'new',
      target_audience: 'new_users',
      discount_value: 10,
    });
    expect(evaluatePromotionDiscount(p, lines, { priorVendorOrderCount: 1 })).toBeNull();
    expect(evaluatePromotionDiscount(p, lines, { priorVendorOrderCount: 0 })?.discountAmount).toBe(25);
  });

  it('listing_ownership_scope own_brand only discounts owned lines', () => {
    const ownedLines: CartLineItem[] = [
      { productId: 'p1', quantity: 2, price: 100, listingOwnership: 'own_brand' },
      { productId: 'p2', quantity: 1, price: 50, listingOwnership: 'third_party' },
    ];
    const p = promo({
      id: 'own',
      discount_value: 10,
      listing_ownership_scope: 'own_brand',
    });
    const result = evaluatePromotionDiscount(p, ownedLines);
    expect(result?.discountAmount).toBe(20);
    expect(result?.affectedProductIds).toEqual(['p1']);
  });

  it('listing_ownership_scope third_party excludes own_brand lines', () => {
    const mixed: CartLineItem[] = [
      { productId: 'p1', quantity: 2, price: 100, listingOwnership: 'own_brand' },
      { productId: 'p2', quantity: 1, price: 50, listingOwnership: 'third_party' },
    ];
    const p = promo({
      id: 'tp',
      discount_value: 10,
      listing_ownership_scope: 'third_party',
    });
    expect(evaluatePromotionDiscount(p, mixed)?.discountAmount).toBe(5);
  });

  it('listing_ownership_scope all keeps prior behavior', () => {
    const mixed: CartLineItem[] = [
      { productId: 'p1', quantity: 1, price: 100, listingOwnership: 'own_brand' },
      { productId: 'p2', quantity: 1, price: 100, listingOwnership: 'third_party' },
    ];
    const p = promo({ id: 'all', discount_value: 10, listing_ownership_scope: 'all' });
    expect(evaluatePromotionDiscount(p, mixed)?.discountAmount).toBe(20);
  });
});
