import { query } from '../../database/rds-connection';
import { resolveCommercialCampaignDiscount } from '../resolve-commercial-campaign';
import type { CartLineItem } from '../vendor-promotion-engine';

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(),
  insert: jest.fn(),
}));

const mockQuery = query as jest.MockedFunction<typeof query>;

const cartLines: CartLineItem[] = [
  { productId: 'p1', quantity: 1, price: 1000, categoryId: 'toys' },
];

function canonicalCampaignRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'campaign-1',
    name: 'WarmPawz Sale',
    promotion_type: 'flash_sale',
    discount_type: 'percentage',
    discount_value: 10,
    start_date: '2020-01-01T00:00:00.000Z',
    end_date: '2099-12-31T23:59:59.999Z',
    is_active: true,
    published: true,
    applicable_products: null,
    applicable_categories: null,
    ...overrides,
  };
}

function legacyPromotionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'legacy-1',
    name: 'Legacy Platform Promo',
    discount_type: 'percentage',
    discount_value: 5,
    start_date: '2020-01-01',
    end_date: '2099-12-31',
    is_active: true,
    published: true,
    ...overrides,
  };
}

describe('resolveCommercialCampaignDiscount', () => {
  beforeEach(() => jest.clearAllMocks());

  it('auto-applies the single best eligible campaign when neither code nor id is given', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('ecommerce_admin_promotions')) {
        return { rows: [canonicalCampaignRow({ id: 'campaign-1', discount_value: 10 })] } as any;
      }
      if (String(sql).includes('FROM promotions')) {
        return { rows: [legacyPromotionRow({ id: 'legacy-1', discount_value: 25 })] } as any;
      }
      return { rows: [] } as any;
    });

    const result = await resolveCommercialCampaignDiscount({ cartLines });

    // Only ONE promotion wins even though two admin-side sources were eligible.
    expect(result.promotionId).toBe('legacy-1');
    expect(result.discountAmount).toBe(250);
    expect(result.isLegacy).toBe(true);
  });

  it('validates a specific campaign id (customer-selected) rather than auto-picking', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('ecommerce_admin_promotions')) {
        return {
          rows: [
            canonicalCampaignRow({ id: 'campaign-low', discount_value: 5 }),
            canonicalCampaignRow({ id: 'campaign-high', discount_value: 50 }),
          ],
        } as any;
      }
      return { rows: [] } as any;
    });

    const result = await resolveCommercialCampaignDiscount({
      cartLines,
      promoId: 'campaign-low',
    });

    expect(result.promotionId).toBe('campaign-low');
    expect(result.discountAmount).toBe(50);
    expect(result.isLegacy).toBe(false);
  });

  it('returns no discount when the requested promoId does not exist among active campaigns', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('ecommerce_admin_promotions')) {
        return { rows: [canonicalCampaignRow({ id: 'campaign-1' })] } as any;
      }
      return { rows: [] } as any;
    });

    const result = await resolveCommercialCampaignDiscount({
      cartLines,
      promoId: 'does-not-exist',
    });

    expect(result.promotionId).toBeNull();
    expect(result.discountAmount).toBe(0);
  });

  it('validates a manual coupon code against active campaigns only', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('ecommerce_admin_promotions')) {
        return {
          rows: [canonicalCampaignRow({ id: 'campaign-1', code: 'SAVE10', discount_value: 10 })],
        } as any;
      }
      return { rows: [] } as any;
    });

    const result = await resolveCommercialCampaignDiscount({
      cartLines,
      couponCode: 'SAVE10',
    });

    expect(result.promotionId).toBe('campaign-1');
    expect(result.discountAmount).toBe(100);
  });

  it('returns zero discount when no campaigns are active', async () => {
    mockQuery.mockImplementation(async () => ({ rows: [] }) as any);

    const result = await resolveCommercialCampaignDiscount({ cartLines });

    expect(result.discountAmount).toBe(0);
    expect(result.promotionId).toBeNull();
    expect(result.evaluation).toBeNull();
  });

  it('returns zero discount when the cart is empty, without querying further', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('ecommerce_admin_promotions')) {
        return { rows: [canonicalCampaignRow()] } as any;
      }
      return { rows: [] } as any;
    });

    const result = await resolveCommercialCampaignDiscount({ cartLines: [] });

    expect(result.discountAmount).toBe(0);
    expect(result.promotionId).toBeNull();
  });
});
