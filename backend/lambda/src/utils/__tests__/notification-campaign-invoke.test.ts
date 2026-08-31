import {
  MAX_CAMPAIGN_CHAIN_HOPS,
  isCampaignChainHopAllowed,
  isCampaignDeliveryJobEvent,
  normalizeCampaignHop,
} from '../notification-campaign-invoke';

describe('campaign delivery hop cap', () => {
  it('allows hops 1 through the hard cap', () => {
    expect(isCampaignChainHopAllowed(1)).toBe(true);
    expect(isCampaignChainHopAllowed(MAX_CAMPAIGN_CHAIN_HOPS)).toBe(true);
  });

  it('rejects hop 0, negative, and anything past the cap', () => {
    expect(isCampaignChainHopAllowed(0)).toBe(false);
    expect(isCampaignChainHopAllowed(-1)).toBe(false);
    expect(isCampaignChainHopAllowed(MAX_CAMPAIGN_CHAIN_HOPS + 1)).toBe(false);
  });

  it('normalizes missing or invalid hop to 1', () => {
    expect(normalizeCampaignHop(undefined)).toBe(1);
    expect(normalizeCampaignHop('')).toBe(1);
    expect(normalizeCampaignHop(NaN)).toBe(1);
    expect(normalizeCampaignHop(3.9)).toBe(3);
  });

  it('accepts job events with or without hop', () => {
    expect(
      isCampaignDeliveryJobEvent({ job: 'notification-campaign-delivery', campaignId: 'c1' })
    ).toBe(true);
    expect(
      isCampaignDeliveryJobEvent({
        job: 'notification-campaign-delivery',
        campaignId: 'c1',
        hop: 2,
      })
    ).toBe(true);
    expect(isCampaignDeliveryJobEvent({ job: 'other', campaignId: 'c1' })).toBe(false);
  });

  it('keeps the cap finite so a chain cannot explode', () => {
    expect(MAX_CAMPAIGN_CHAIN_HOPS).toBe(135);
    expect(Number.isFinite(MAX_CAMPAIGN_CHAIN_HOPS)).toBe(true);
  });
});
