import { promotionMetricToCardItem } from '../mappers';
import type { PromotionMetricRow } from '../types';

const baseRow: PromotionMetricRow = {
  promotionId: 'promo-1',
  name: 'Shop 10%',
  promotionType: 'flash_sale',
  owner: 'platform',
  usageCount: 4,
  conversionRate: null,
  savingsGenerated: 80,
  revenueInfluenced: 800,
  fundingCost: 80,
  settlementCost: 0,
  averageDiscount: 20,
  activeUsers: 3,
  expiresAt: '2020-01-01T00:00:00.000Z',
  startDate: '2019-01-01T00:00:00.000Z',
  roi: null,
};

describe('promotionMetricToCardItem', () => {
  it('does not hardcode isActive true', () => {
    const item = promotionMetricToCardItem({ ...baseRow, isActive: false, published: true });
    expect(item.isActive).toBe(false);
    expect(item.endDate).toBe('2020-01-01T00:00:00.000Z');
    expect(item.startDate).toBe('2019-01-01T00:00:00.000Z');
  });

  it('maps live active flag', () => {
    const item = promotionMetricToCardItem({ ...baseRow, isActive: true, published: true });
    expect(item.isActive).toBe(true);
    expect(item.published).toBe(true);
  });
});
