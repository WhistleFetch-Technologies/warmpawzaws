import { query } from '../../database/rds-connection';
import {
  fillProductCategoryIfMissing,
  resolveOrderPromoLineCategory,
} from '../fill-product-category-if-missing';
import {
  calculateBestCartPromotion,
  discountsWithinTolerance,
  evaluatePromotionDiscount,
  normalizePromotionRow,
  type CartLineItem,
  type PromotionRow,
} from '../vendor-promotion-engine';

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(),
  insert: jest.fn(),
}));

const mockQuery = query as jest.MockedFunction<typeof query>;

const FURNITURE_CATEGORY = '11111111-1111-4111-8111-111111111111';
const FURNITURE_MRP = 18999;
const FURNITURE_PCT = 15;
const FURNITURE_DISCOUNT = 2849.85;

function promo(overrides: Partial<PromotionRow> & Pick<PromotionRow, 'id'>): PromotionRow {
  return normalizePromotionRow({
    name: 'Introductory Offer for Furnitures',
    promotion_type: 'flash_sale',
    discount_type: 'percentage',
    discount_value: 10,
    start_date: '2020-01-01T00:00:00.000Z',
    end_date: '2099-12-31T23:59:59.999Z',
    is_active: true,
    ...overrides,
  } as Record<string, unknown>);
}

function ecommerceWantsPromotion(params: {
  couponCode?: string | null;
  promoId?: string | null;
  bodyDiscount: number;
}): boolean {
  return Boolean(params.couponCode || params.promoId || Number(params.bodyDiscount) > 0);
}

function persistOrderDiscount(bodyDiscount: number, serverPromoDiscount: number): number {
  return serverPromoDiscount > 0
    ? serverPromoDiscount
    : Number.isFinite(bodyDiscount) && bodyDiscount >= 0
      ? bodyDiscount
      : 0;
}

describe('resolveOrderPromoLineCategory (Step A fill-if-missing)', () => {
  it('fills furniture UUID when the body omitted category', () => {
    expect(resolveOrderPromoLineCategory(undefined, FURNITURE_CATEGORY)).toBe(
      FURNITURE_CATEGORY
    );
    expect(resolveOrderPromoLineCategory('', FURNITURE_CATEGORY)).toBe(FURNITURE_CATEGORY);
  });

  it('keeps client category X when DB has Y', () => {
    expect(resolveOrderPromoLineCategory('X', 'Y')).toBe('X');
  });
});

describe('category campaign vs order discount (Step A tests 1–5)', () => {
  const furniturePromo = promo({
    id: 'furn-1',
    promotion_type: 'category_discount',
    applicable_categories: [FURNITURE_CATEGORY],
    discount_value: FURNITURE_PCT,
  });

  it('1: DB-only category applies 15% of 18999 = 2849.85 within tolerance', () => {
    const categoryId = resolveOrderPromoLineCategory(undefined, FURNITURE_CATEGORY);
    const lines: CartLineItem[] = [
      { productId: 'bed-1', quantity: 1, price: FURNITURE_MRP, categoryId },
    ];
    const result = evaluatePromotionDiscount(furniturePromo, lines);
    expect(result?.discountAmount).toBe(FURNITURE_DISCOUNT);
    const bodyDiscount = FURNITURE_DISCOUNT;
    expect(discountsWithinTolerance(result?.discountAmount ?? 0, bodyDiscount)).toBe(true);
  });

  it('2: client category X is not overwritten so a Y-targeted campaign does not match', () => {
    const categoryId = resolveOrderPromoLineCategory('X', FURNITURE_CATEGORY);
    expect(categoryId).toBe('X');
    const lines: CartLineItem[] = [
      { productId: 'bed-1', quantity: 1, price: FURNITURE_MRP, categoryId },
    ];
    expect(evaluatePromotionDiscount(furniturePromo, lines)).toBeNull();
  });

  it('3: unscoped campaign still discounts without category', () => {
    const unscoped = promo({ id: 'all-1', discount_value: 10 });
    const lines: CartLineItem[] = [{ productId: 'p1', quantity: 1, price: 1000 }];
    expect(evaluatePromotionDiscount(unscoped, lines)?.discountAmount).toBe(100);
  });

  it('4: product-id promo still matches without category', () => {
    const productPromo = promo({
      id: 'prod-1',
      applicable_products: ['bed-1'],
      discount_value: 10,
    });
    const lines: CartLineItem[] = [{ productId: 'bed-1', quantity: 1, price: 1000 }];
    expect(evaluatePromotionDiscount(productPromo, lines)?.discountAmount).toBe(100);
  });

  it('5: bodyDiscount 0 does not invent a discount even after category fill', () => {
    const categoryId = resolveOrderPromoLineCategory(undefined, FURNITURE_CATEGORY);
    expect(categoryId).toBe(FURNITURE_CATEGORY);
    const wants = ecommerceWantsPromotion({ bodyDiscount: 0 });
    expect(wants).toBe(false);
    const serverPromoDiscount = 0;
    expect(persistOrderDiscount(0, serverPromoDiscount)).toBe(0);
  });
});

describe('fillProductCategoryIfMissing (Step B)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not replace a client category', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: 'p1', category_id: 'FROM-DB' }],
    } as never);
    const out = await fillProductCategoryIfMissing([
      { productId: 'p1', categoryId: 'CLIENT', price: 1, quantity: 1 } as CartLineItem,
    ]);
    expect(out[0].categoryId).toBe('CLIENT');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('fills from DB when both category fields are empty', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: 'p1', category_id: FURNITURE_CATEGORY }],
    } as never);
    const out = await fillProductCategoryIfMissing<CartLineItem>([
      { productId: 'p1', quantity: 1, price: FURNITURE_MRP },
    ]);
    expect(out[0].categoryId).toBe(FURNITURE_CATEGORY);
    expect(out[0].category).toBe(FURNITURE_CATEGORY);
  });
});

describe('calculateBestCartPromotion unscoped still wins without category', () => {
  it('picks the unscoped percentage promo', () => {
    const unscoped = promo({ id: 'u1', discount_value: 5 });
    const result = calculateBestCartPromotion([unscoped], [
      { productId: 'p1', quantity: 1, price: 200 },
    ]);
    expect(result.bestPromotion?.discountAmount).toBe(10);
  });
});
