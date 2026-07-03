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
 * Never calculates payouts or discount amounts.
 */
export function buildSettlementAttribution(
  campaign: CommercialCampaignRecord
): SettlementAttributionPayload {
  return {
    campaignId: campaign.id,
    attribution: buildCampaignAttribution(campaign),
    fundingPayload: toSettlementFundingPayload(campaign.id, campaign.funding),
    note: 'Pass to Settlement Engine — campaign engine does not compute settlement',
  };
}
