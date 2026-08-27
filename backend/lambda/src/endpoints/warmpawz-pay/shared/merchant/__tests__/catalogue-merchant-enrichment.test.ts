import { PRICING_DISCOUNT_TYPE, PRICING_STATUS } from '../../../constants/merchant-pricing';
import { buildCataloguePricingSummary } from '../catalogue-merchant-enrichment';

describe('buildCataloguePricingSummary', () => {
  it('exposes inherited tier fields and platform margin', () => {
    const summary = buildCataloguePricingSummary({
      pricingId: 'pricing-1',
      tierId: '22222222-2222-4222-8222-222222222222',
      tierName: 'Both',
      commissionRate: 20,
      discountType: PRICING_DISCOUNT_TYPE.PERCENTAGE,
      discountValue: 15,
      platformWithholdPercent: 0,
      status: PRICING_STATUS.ACTIVE,
      effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
      effectiveUntil: null,
    });

    expect(summary.configured).toBe(true);
    expect(summary.tierId).toBe('22222222-2222-4222-8222-222222222222');
    expect(summary.tierName).toBe('Both');
    expect(summary.commissionRate).toBe(20);
    expect(summary.platformMargin).toBe(5);
  });
});
