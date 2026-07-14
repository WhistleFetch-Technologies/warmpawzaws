import {
  aggregatePromotionMetrics,
  aggregateCouponMetrics,
  aggregateSavings,
} from '../analytics-aggregator';
import { buildSettlementAnalytics } from '../settlement-analytics';
import { AnalyticsEngine, resetAnalyticsEngineForTests } from '../analytics-engine';
import { setUsageReadRepositoryForTests } from '../repositories/usage-read-repository';
import type { AnalyticsDataSnapshot } from '../types';
import type { SettlementPreview } from '../../settlement/types';
import { DiscountFunding } from '../../enums/discount-funding';

jest.mock('../enrich-promotion-lifecycle', () => ({
  enrichPromotionAnalyticsLifecycle: async <T>(summary: T) => summary,
}));

describe('analytics-aggregator', () => {
  it('aggregates promotion usage without recalculating discounts', () => {
    const rows = aggregatePromotionMetrics([
      {
        id: '1',
        promotionId: 'p1',
        promotionType: 'platform',
        bookingId: 'b1',
        orderId: null,
        customerId: 'c1',
        discountAmount: 100,
        originalAmount: 500,
        finalAmount: 400,
        createdAt: '2026-06-01T00:00:00Z',
        promotionName: 'Summer',
      },
      {
        id: '2',
        promotionId: 'p1',
        promotionType: 'platform',
        bookingId: 'b2',
        orderId: null,
        customerId: 'c2',
        discountAmount: 50,
        originalAmount: 300,
        finalAmount: 250,
        createdAt: '2026-06-02T00:00:00Z',
        promotionName: 'Summer',
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].usageCount).toBe(2);
    expect(rows[0].savingsGenerated).toBe(150);
    expect(rows[0].averageDiscount).toBe(75);
    expect(rows[0].activeUsers).toBe(2);
  });

  it('aggregates coupon metrics with remaining uses', () => {
    const rows = aggregateCouponMetrics([
      {
        id: 'u1',
        couponId: 'cp1',
        code: 'SAVE10',
        customerId: 'c1',
        bookingId: null,
        orderId: 'o1',
        usedAt: '2026-06-01T00:00:00Z',
        maxUses: 5,
        isActive: true,
        endDate: '2026-12-31',
        discountAmount: 10,
      },
    ]);

    expect(rows[0].uses).toBe(1);
    expect(rows[0].remaining).toBe(4);
    expect(rows[0].code).toBe('SAVE10');
  });

  it('combines promotion and coupon savings', () => {
    const savings = aggregateSavings(
      [
        {
          id: '1',
          promotionId: 'p1',
          promotionType: 'vendor',
          bookingId: 'b1',
          orderId: null,
          customerId: 'c1',
          discountAmount: 80,
          originalAmount: 400,
          finalAmount: 320,
          createdAt: '2026-06-01T00:00:00Z',
        },
      ],
      [
        {
          id: 'u1',
          couponId: 'cp1',
          code: 'X',
          customerId: 'c1',
          bookingId: null,
          orderId: 'o1',
          usedAt: '2026-06-01T00:00:00Z',
          maxUses: null,
          isActive: true,
          endDate: null,
          discountAmount: 20,
        },
      ]
    );

    expect(savings.totalSaved).toBe(100);
    expect(savings.promotionSavings).toBe(80);
    expect(savings.couponSavings).toBe(20);
  });
});

describe('settlement-analytics', () => {
  it('aggregates settlement previews without recalculating', () => {
    const preview: SettlementPreview = {
      mode: 'SHADOW',
      settlementVersion: '1.0.0',
      policyFingerprint: 'abc',
      originalAmount: 1000,
      customerPaid: 900,
      customerPayable: 900,
      totalDiscount: 100,
      vendorDiscountShare: 40,
      platformDiscountShare: 60,
      vendorCost: 40,
      sharedDiscountShare: { platform: 30, vendor: 10, total: 40 },
      vendorReceivable: 960,
      platformCost: 60,
      platformReceivable: 50,
      netSettlement: 900,
      appliedFunding: [
        {
          discountId: 'd1',
          name: 'Promo',
          funding: DiscountFunding.PLATFORM,
          discountAmount: 60,
          platformShare: 60,
          vendorShare: 0,
          order: 1,
        },
      ],
      fees: {
        platformFees: 10,
        convenienceFees: 0,
        deliveryFees: 0,
        packagingFees: 0,
        taxes: 0,
      },
      executionTimeMs: 1,
      timestamp: '2026-06-15T00:00:00Z',
    };

    const summary = buildSettlementAnalytics({ previews: [preview] });
    expect(summary.platformContribution).toBe(60);
    expect(summary.vendorContribution).toBe(40);
    expect(summary.previewCount).toBe(1);
    expect(summary.fundingBreakdown).toHaveLength(1);
  });
});

describe('AnalyticsEngine', () => {
  const originalMode = process.env.DISCOUNT_ENGINE_V2_ANALYTICS_MODE;

  beforeEach(() => {
    resetAnalyticsEngineForTests();
    process.env.DISCOUNT_ENGINE_V2_ANALYTICS_MODE = 'AUTHORITATIVE';
  });

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.DISCOUNT_ENGINE_V2_ANALYTICS_MODE;
    } else {
      process.env.DISCOUNT_ENGINE_V2_ANALYTICS_MODE = originalMode;
    }
    setUsageReadRepositoryForTests(null);
  });

  it('returns null when mode is OFF', async () => {
    process.env.DISCOUNT_ENGINE_V2_ANALYTICS_MODE = 'OFF';
    setUsageReadRepositoryForTests({
      loadSnapshot: async () => ({
        promotionUsages: [],
        couponUsages: [],
        activePromotionCount: 0,
      }),
    });
    const report = await new AnalyticsEngine().generateReport();
    expect(report).toBeNull();
  });

  it('generates report from repository snapshot', async () => {
    const snapshot: AnalyticsDataSnapshot = {
      activePromotionCount: 2,
      promotionUsages: [
        {
          id: '1',
          promotionId: 'p1',
          promotionType: 'service',
          bookingId: 'b1',
          orderId: null,
          customerId: 'c1',
          discountAmount: 50,
          originalAmount: 200,
          finalAmount: 150,
          createdAt: '2026-06-01T00:00:00Z',
          vendorId: 'v1',
        },
      ],
      couponUsages: [],
    };

    setUsageReadRepositoryForTests({
      loadSnapshot: async () => snapshot,
    });

    const report = await new AnalyticsEngine().generateReport({ domain: 'SERVICE' });
    expect(report).not.toBeNull();
    expect(report!.promotions.totals.usageCount).toBe(1);
    expect(report!.audit.mode).toBe('AUTHORITATIVE');
    expect(report!.vendors.rows[0]?.vendorId).toBe('v1');
  });

  it('logs in SHADOW mode without blocking generation', async () => {
    process.env.DISCOUNT_ENGINE_V2_ANALYTICS_MODE = 'SHADOW';
    const logSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    setUsageReadRepositoryForTests({
      loadSnapshot: async () => ({
        promotionUsages: [],
        couponUsages: [],
        activePromotionCount: 0,
      }),
    });

    const report = await new AnalyticsEngine().generateReport();
    expect(report).not.toBeNull();
    expect(logSpy).toHaveBeenCalledWith('[discount-analytics:shadow]', expect.any(Object));
    logSpy.mockRestore();
  });
});
