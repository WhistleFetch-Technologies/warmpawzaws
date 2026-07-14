import { DiscountFunding } from '../../enums/discount-funding';
import { normalizeCampaignFunding, toSettlementFundingPayload } from '../campaign-funding';

describe('campaign-funding', () => {
  it('accepts platform and vendor funding', () => {
    expect(normalizeCampaignFunding({ type: DiscountFunding.PLATFORM }).valid).toBe(true);
    expect(normalizeCampaignFunding({ type: DiscountFunding.VENDOR }).valid).toBe(true);
  });

  it('validates shared split sums to 100', () => {
    const ok = normalizeCampaignFunding({
      type: DiscountFunding.SHARED,
      split: { platformPercent: 70, vendorPercent: 30 },
    });
    expect(ok.valid).toBe(true);
    expect(ok.normalized.split).toEqual({ platformPercent: 70, vendorPercent: 30 });

    const bad = normalizeCampaignFunding({
      type: DiscountFunding.SHARED,
      split: { platformPercent: 60, vendorPercent: 30 },
    });
    expect(bad.valid).toBe(false);
  });

  it('builds settlement payload without payout math', () => {
    const payload = toSettlementFundingPayload('camp-1', {
      type: DiscountFunding.SHARED,
      split: { platformPercent: 50, vendorPercent: 50 },
    });
    expect(payload.campaignId).toBe('camp-1');
    expect(payload.fundingType).toBe(DiscountFunding.SHARED);
    expect(payload).not.toHaveProperty('payoutAmount');
  });
});
