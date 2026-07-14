import type {
  CampaignAudience,
  CampaignFundingPolicy,
  CampaignRecurringRule,
  CampaignScheduleType,
} from './types';

export interface CampaignTemplateDefinition {
  id: string;
  name: string;
  campaignType: string;
  defaultFunding: CampaignFundingPolicy;
  defaultScheduleType: CampaignScheduleType;
  recurringRule?: CampaignRecurringRule;
  promotionDefaults?: Record<string, unknown>;
  audience?: CampaignAudience;
}
