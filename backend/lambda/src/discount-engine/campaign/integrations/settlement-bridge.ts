import { toSettlementFundingPayload } from '../campaign-funding';
import { buildCampaignAttribution } from '../campaign-audit';
import type { CommercialCampaignRecord } from '../types';

export interface SettlementAttributionPayload {
  campaignId: string;
  attribution: ReturnType<typeof buildCampaignAttribution>;
  fundingPayload: Record<string, unknown>;
  note: string;
}

/**
 * Supplies settlement attribution metadata for Phase 7 Settlement Engine.
 * Never calculates payouts or discount amounts — Settlement Engine consumes this payload.
 */
export function buildSettlementAttribution(
  campaign: CommercialCampaignRecord
): SettlementAttributionPayload {
  const budgetCap = campaign.budgetCap ?? null;
  const budgetSpent = Number(campaign.budgetSpent ?? 0);
  const budgetRemaining =
    budgetCap != null && Number.isFinite(budgetCap)
      ? Math.max(0, Number(budgetCap) - budgetSpent)
      : null;

  const fundingPayload = {
    ...toSettlementFundingPayload(campaign.id, campaign.funding),
    discountDomain: campaign.discountDomain,
    surface: campaign.surface,
    budgetCap,
    budgetSpent,
    budgetRemaining,
    goal: campaign.goal ?? null,
    policyFingerprint: campaign.policyFingerprint ?? null,
  };

  return {
    campaignId: campaign.id,
    attribution: buildCampaignAttribution(campaign),
    fundingPayload,
    note: 'Pass to Settlement Engine — campaign engine does not compute settlement',
  };
}
