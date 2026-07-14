import { createHash } from 'crypto';
import { getCampaignMode } from './campaign-mode';
import type {
  CampaignAttributionMetadata,
  CampaignAudit,
  CampaignAudience,
  CampaignFundingPolicy,
  CommercialCampaignRecord,
} from './types';

export function buildPolicyFingerprint(input: {
  campaignType: string;
  funding: CampaignFundingPolicy;
  audience: CampaignAudience;
  version: number;
}): string {
  const payload = JSON.stringify({
    campaignType: input.campaignType,
    funding: input.funding,
    audience: input.audience,
    version: input.version,
  });
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

export function buildCampaignAttribution(campaign: CommercialCampaignRecord): CampaignAttributionMetadata {
  const budgetCap = campaign.budgetCap ?? null;
  const budgetSpent = Number(campaign.budgetSpent ?? 0);
  const budgetRemaining =
    budgetCap != null && Number.isFinite(budgetCap)
      ? Math.max(0, Number(budgetCap) - budgetSpent)
      : null;
  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    campaignVersion: campaign.version,
    campaignTemplate: campaign.templateId,
    campaignType: campaign.campaignType,
    fundingPolicy: campaign.funding,
    discountDomain: campaign.discountDomain,
    surface: campaign.surface,
    budgetCap,
    budgetSpent,
    budgetRemaining,
  };
}

export function buildCampaignAudit(input: {
  campaign: CommercialCampaignRecord;
  promotionIds: string[];
  couponIds: string[];
  analyticsPreview?: Record<string, unknown> | null;
  settlementAttribution?: Record<string, unknown> | null;
  startedAt: number;
}): CampaignAudit {
  const { campaign, promotionIds, couponIds, analyticsPreview, settlementAttribution, startedAt } = input;
  const fingerprint =
    campaign.policyFingerprint ??
    buildPolicyFingerprint({
      campaignType: campaign.campaignType,
      funding: campaign.funding,
      audience: campaign.audience,
      version: campaign.version,
    });

  return {
    campaignId: campaign.id,
    campaignVersion: campaign.version,
    mode: getCampaignMode(),
    policyFingerprint: fingerprint,
    campaignVersionLabel: `v${campaign.version}`,
    promotions: promotionIds,
    coupons: couponIds,
    funding: campaign.funding,
    audience: campaign.audience,
    notifications: {
      mode: campaign.notificationMode,
      notificationCampaignId: campaign.notificationCampaignId,
    },
    analytics: analyticsPreview ?? undefined,
    settlement: settlementAttribution ?? undefined,
    timestamp: new Date().toISOString(),
    executionTimeMs: Date.now() - startedAt,
  };
}

/** Embeds campaign attribution into promotion/coupon metadata — no pricing fields. */
export function enrichPromotionMetadataWithCampaign(
  baseMetadata: Record<string, unknown> | undefined,
  campaign: CommercialCampaignRecord
): Record<string, unknown> {
  const attribution = buildCampaignAttribution(campaign);
  return {
    ...(baseMetadata ?? {}),
    campaign: attribution,
    commercialCampaignId: campaign.id,
  };
}
