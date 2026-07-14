import { deriveLifecycleFromSchedule, isCampaignActiveStatus } from './campaign-lifecycle';
import type { CampaignAttributionMetadata, CommercialCampaignRecord } from './types';

export interface ResolvedCampaignContext {
  campaign: CommercialCampaignRecord | null;
  active: boolean;
  attribution: CampaignAttributionMetadata | null;
  effectiveStatus: string;
}

/**
 * Resolves campaign context for enrichment — never modifies pricing.
 */
export class CampaignResolver {
  resolve(campaign: CommercialCampaignRecord | null, now?: Date): ResolvedCampaignContext {
    if (!campaign) {
      return { campaign: null, active: false, attribution: null, effectiveStatus: 'none' };
    }

    const effectiveStatus = deriveLifecycleFromSchedule({
      status: campaign.status,
      startAt: campaign.startAt,
      endAt: campaign.endAt,
      now,
    });

    const active = isCampaignActiveStatus(effectiveStatus as CommercialCampaignRecord['status']);

    const attribution: CampaignAttributionMetadata = {
      campaignId: campaign.id,
      campaignName: campaign.name,
      campaignVersion: campaign.version,
      campaignTemplate: campaign.templateId,
      campaignType: campaign.campaignType,
      fundingPolicy: campaign.funding,
    };

    return {
      campaign: { ...campaign, status: effectiveStatus as CommercialCampaignRecord['status'] },
      active,
      attribution,
      effectiveStatus,
    };
  }

  resolveById(
    fetchCampaign: (id: string) => Promise<CommercialCampaignRecord | null>,
    campaignId: string
  ): Promise<ResolvedCampaignContext> {
    return fetchCampaign(campaignId).then((c) => this.resolve(c));
  }
}

export const campaignResolver = new CampaignResolver();
