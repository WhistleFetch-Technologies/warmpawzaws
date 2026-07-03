import {
  getCampaignMode,
  isCampaignAuthoritative,
  isCampaignEnabled,
  isCampaignShadowMode,
} from '../campaign-mode';

describe('campaign-mode', () => {
  const original = process.env.DISCOUNT_ENGINE_V2_CAMPAIGN_MODE;

  afterEach(() => {
    if (original === undefined) delete process.env.DISCOUNT_ENGINE_V2_CAMPAIGN_MODE;
    else process.env.DISCOUNT_ENGINE_V2_CAMPAIGN_MODE = original;
  });

  it('defaults to OFF', () => {
    delete process.env.DISCOUNT_ENGINE_V2_CAMPAIGN_MODE;
    expect(getCampaignMode()).toBe('OFF');
    expect(isCampaignEnabled()).toBe(false);
  });

  it('supports SHADOW and AUTHORITATIVE', () => {
    process.env.DISCOUNT_ENGINE_V2_CAMPAIGN_MODE = 'SHADOW';
    expect(getCampaignMode()).toBe('SHADOW');
    expect(isCampaignEnabled()).toBe(true);
    expect(isCampaignShadowMode()).toBe(true);
    expect(isCampaignAuthoritative()).toBe(false);

    process.env.DISCOUNT_ENGINE_V2_CAMPAIGN_MODE = 'AUTHORITATIVE';
    expect(isCampaignAuthoritative()).toBe(true);
  });
});
