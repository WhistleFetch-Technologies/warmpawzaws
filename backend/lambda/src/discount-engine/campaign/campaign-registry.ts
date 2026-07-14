import { CAMPAIGN_TYPE_REGISTRY } from './campaign-configuration';
import { listCampaignTemplates } from './campaign-template';
import type { CommercialCampaignRecord } from './types';

export interface CampaignRegistrySnapshot {
  campaignTypes: typeof CAMPAIGN_TYPE_REGISTRY;
  templates: ReturnType<typeof listCampaignTemplates>;
  activeCampaignCount: number;
}

/**
 * In-memory registry index — DB is source of truth for instances.
 */
export class CampaignRegistry {
  private campaigns = new Map<string, CommercialCampaignRecord>();

  register(campaign: CommercialCampaignRecord): void {
    this.campaigns.set(campaign.id, campaign);
  }

  get(id: string): CommercialCampaignRecord | undefined {
    return this.campaigns.get(id);
  }

  list(): CommercialCampaignRecord[] {
    return Array.from(this.campaigns.values());
  }

  remove(id: string): boolean {
    return this.campaigns.delete(id);
  }

  snapshot(): CampaignRegistrySnapshot {
    return {
      campaignTypes: CAMPAIGN_TYPE_REGISTRY,
      templates: listCampaignTemplates(),
      activeCampaignCount: this.list().filter((c) => c.status === 'running' || c.status === 'scheduled').length,
    };
  }
}

export const globalCampaignRegistry = new CampaignRegistry();
