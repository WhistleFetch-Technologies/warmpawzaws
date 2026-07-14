import { query } from '../../../database/rds-connection';
import {
  enrichPromotionAnalyticsLifecycle,
  loadPromotionLifecycleByIds,
} from '../enrich-promotion-lifecycle';
import type { PromotionAnalyticsSummary } from '../types';

jest.mock('../../../database/rds-connection', () => ({
  query: jest.fn(),
}));

const mockQuery = query as jest.MockedFunction<typeof query>;

describe('enrich-promotion-lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marks expired ecommerce admin promo inactive', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'p1',
            is_active: true,
            published: true,
            start_date: '2020-01-01T00:00:00.000Z',
            end_date: '2020-06-01T00:00:00.000Z',
          },
        ],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const map = await loadPromotionLifecycleByIds(['p1']);
    expect(map.get('p1')?.isActive).toBe(false);
    expect(map.get('p1')?.endDate).toContain('2020-06-01');
  });

  it('enriches topPromotions isActive from live rows', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'live-1',
            is_active: true,
            published: true,
            start_date: '2020-01-01T00:00:00.000Z',
            end_date: '2099-01-01T00:00:00.000Z',
          },
        ],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const summary: PromotionAnalyticsSummary = {
      rows: [
        {
          promotionId: 'live-1',
          name: 'Live',
          promotionType: 'flash_sale',
          owner: 'platform',
          usageCount: 1,
          conversionRate: null,
          savingsGenerated: 10,
          revenueInfluenced: 100,
          fundingCost: 10,
          settlementCost: 0,
          averageDiscount: 10,
          activeUsers: 1,
          expiresAt: null,
          roi: null,
        },
      ],
      topPromotions: [
        {
          promotionId: 'live-1',
          name: 'Live',
          promotionType: 'flash_sale',
          owner: 'platform',
          usageCount: 1,
          conversionRate: null,
          savingsGenerated: 10,
          revenueInfluenced: 100,
          fundingCost: 10,
          settlementCost: 0,
          averageDiscount: 10,
          activeUsers: 1,
          expiresAt: null,
          roi: null,
        },
      ],
      totals: {
        usageCount: 1,
        savingsGenerated: 10,
        averageDiscount: 10,
      },
    };

    const enriched = await enrichPromotionAnalyticsLifecycle(summary);
    expect(enriched.topPromotions[0].isActive).toBe(true);
    expect(enriched.topPromotions[0].expiresAt).toContain('2099');
  });
});
