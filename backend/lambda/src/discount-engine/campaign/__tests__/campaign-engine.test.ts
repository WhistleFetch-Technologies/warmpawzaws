import {
  CampaignEngine,
  resetCampaignEngine,
} from '../campaign-engine';
import { DiscountFunding } from '../../enums/discount-funding';
import { InMemoryCampaignRepository } from '../repositories/campaign-repository';
import { enrichPromotionMetadataWithCampaign } from '../campaign-audit';
import type { CommercialCampaignRecord } from '../types';

describe('CampaignEngine orchestration', () => {
  const originalMode = process.env.DISCOUNT_ENGINE_V2_CAMPAIGN_MODE;
  const originalAnalytics = process.env.DISCOUNT_ENGINE_V2_ANALYTICS_MODE;

  afterEach(() => {
    resetCampaignEngine();
    if (originalMode === undefined) delete process.env.DISCOUNT_ENGINE_V2_CAMPAIGN_MODE;
    else process.env.DISCOUNT_ENGINE_V2_CAMPAIGN_MODE = originalMode;
    if (originalAnalytics === undefined) delete process.env.DISCOUNT_ENGINE_V2_ANALYTICS_MODE;
    else process.env.DISCOUNT_ENGINE_V2_ANALYTICS_MODE = originalAnalytics;
  });

  function makeEngine() {
    const repo = new InMemoryCampaignRepository();
    return { engine: new CampaignEngine({ repository: repo, dryRun: true }), repo };
  }

  it('returns null when mode is OFF', async () => {
    process.env.DISCOUNT_ENGINE_V2_CAMPAIGN_MODE = 'OFF';
    const { engine } = makeEngine();
    const campaign = await engine.createCampaign({
      name: 'Test',
      campaignType: 'flash_sale',
    });
    const result = await engine.orchestrateCampaign(campaign.id, {
      promotions: [{ discount_value: 10 }],
    });
    expect(result).toBeNull();
  });

  it('SHADOW mode generates audit without changing pricing', async () => {
    process.env.DISCOUNT_ENGINE_V2_CAMPAIGN_MODE = 'SHADOW';
    process.env.DISCOUNT_ENGINE_V2_ANALYTICS_MODE = 'OFF';
    const { engine, repo } = makeEngine();

    const campaign = await engine.createCampaign({
      name: 'Platform Flash',
      campaignType: 'flash_sale',
      funding: { type: DiscountFunding.PLATFORM },
    });

    const result = await engine.orchestrateCampaign(campaign.id, {
      promotions: [{ name: '10% Off', discount_value: 10, discount_type: 'percentage' }],
      coupons: [{ code: 'FLASH10', value: 10 }],
    });

    expect(result).not.toBeNull();
    expect(result!.audit.mode).toBe('SHADOW');
    expect(result!.audit.promotions.length).toBe(1);
    expect(result!.audit.coupons.length).toBe(1);
    expect(result!.audit.settlement).toBeDefined();
    expect(result!.audit).not.toHaveProperty('discountAmount');

    const audits = (repo as InMemoryCampaignRepository).getAudits();
    expect(audits).toHaveLength(1);
  });

  it('supports vendor shared funding campaign scenario', async () => {
    process.env.DISCOUNT_ENGINE_V2_CAMPAIGN_MODE = 'SHADOW';
    const { engine } = makeEngine();

    const campaign = await engine.createFromTemplate('shared', {
      name: 'Vendor Shared Launch',
      vendorId: 'vendor-123',
      funding: { type: DiscountFunding.SHARED, split: { platformPercent: 20, vendorPercent: 80 } },
    });

    expect(campaign.funding.split).toEqual({ platformPercent: 20, vendorPercent: 80 });
    expect(campaign.vendorId).toBe('vendor-123');

    const settlement = await engine.getSettlementAttribution(campaign.id);
    expect(settlement!.fundingPayload.fundingType).toBe(DiscountFunding.SHARED);
  });

  it('lifecycle transitions are enforced', async () => {
    process.env.DISCOUNT_ENGINE_V2_CAMPAIGN_MODE = 'AUTHORITATIVE';
    const { engine } = makeEngine();
    const campaign = await engine.createCampaign({
      name: 'Scheduled Seasonal',
      campaignType: 'seasonal',
      scheduleType: 'scheduled',
      startAt: '2026-12-01T00:00:00Z',
      endAt: '2026-12-31T23:59:59Z',
    });

    await engine.transitionLifecycle(campaign.id, 'review');
    const approved = await engine.transitionLifecycle(campaign.id, 'approved');
    expect(approved?.status).toBe('approved');

    await expect(engine.transitionLifecycle(campaign.id, 'archived')).rejects.toThrow();
  });

  it('enriches promotion metadata with campaign attribution only', () => {
    const campaign: CommercialCampaignRecord = {
      id: 'c1',
      name: 'Fest',
      campaignType: 'festival',
      templateId: 'christmas',
      status: 'draft',
      funding: { type: DiscountFunding.PLATFORM },
      scheduleType: 'scheduled',
      audience: { kind: 'all_customers' },
      notificationMode: 'skip',
      version: 1,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const meta = enrichPromotionMetadataWithCampaign({}, campaign);
    expect(meta.commercialCampaignId).toBe('c1');
    expect((meta.campaign as { campaignId: string }).campaignId).toBe('c1');
    expect(meta).not.toHaveProperty('discountAmount');
    expect(meta).not.toHaveProperty('finalAmount');
  });
});
