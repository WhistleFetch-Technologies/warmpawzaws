/** Commercial campaign API contracts — mirrors backend discount-engine/campaign/types.ts */

export type CampaignLifecycleStatus =
  | 'draft'
  | 'review'
  | 'approved'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'archived';

export type CampaignScheduleType = 'immediate' | 'scheduled' | 'recurring';
export type CampaignNotificationMode = 'skip' | 'create' | 'link';
export type CampaignFundingType = 'PLATFORM' | 'VENDOR' | 'SHARED' | 'CUSTOM';

export interface CampaignFundingSplit {
  platformPercent: number;
  vendorPercent: number;
}

export interface CampaignFundingPolicy {
  type: CampaignFundingType;
  split?: CampaignFundingSplit;
}

export interface CampaignAudience {
  kind:
    | 'all_customers'
    | 'first_order'
    | 'returning'
    | 'vip'
    | 'segment'
    | 'regions'
    | 'cities'
    | 'vendor_customers'
    | 'product_customers'
    | 'custom';
  segmentIds?: string[];
  regionIds?: string[];
  cityIds?: string[];
  vendorId?: string;
  metadata?: Record<string, unknown>;
}

export interface CampaignRecurringRule {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval?: number;
  daysOfWeek?: number[];
  endAfterOccurrences?: number;
}

export interface CommercialCampaignRecord {
  id: string;
  name: string;
  slug?: string | null;
  campaignType: string;
  templateId?: string | null;
  status: CampaignLifecycleStatus;
  funding: CampaignFundingPolicy;
  scheduleType: CampaignScheduleType;
  startAt?: string | null;
  endAt?: string | null;
  recurringRule?: CampaignRecurringRule | null;
  audience: CampaignAudience;
  notificationMode: CampaignNotificationMode;
  notificationCampaignId?: string | null;
  vendorId?: string | null;
  version: number;
  metadata: Record<string, unknown>;
  policyFingerprint?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampaignInput {
  name: string;
  campaignType: string;
  templateId?: string;
  funding?: CampaignFundingPolicy;
  scheduleType?: CampaignScheduleType;
  startAt?: string;
  endAt?: string;
  recurringRule?: CampaignRecurringRule;
  audience?: CampaignAudience;
  notificationMode?: CampaignNotificationMode;
  notificationCampaignId?: string;
  vendorId?: string;
  metadata?: Record<string, unknown>;
}

export interface OrchestrateCampaignInput {
  promotions?: Array<Record<string, unknown>>;
  coupons?: Array<Record<string, unknown>>;
}

export interface CampaignTemplateDefinition {
  id: string;
  name: string;
  campaignType: string;
  defaultFunding: CampaignFundingPolicy;
  defaultScheduleType: CampaignScheduleType;
}

export interface CampaignRegistryResponse {
  campaignTypes: Record<string, { label: string; defaultPromotionType: string; defaultTemplateId?: string }>;
  templates: CampaignTemplateDefinition[];
}

export interface CampaignModeResponse {
  mode: string;
  enabled: boolean;
  authoritative: boolean;
}

export interface CampaignOrchestrationResult {
  campaign: CommercialCampaignRecord;
  links: Array<{ id: string; promotionId?: string | null; couponId?: string | null; linkType: string }>;
  audit: Record<string, unknown>;
  analyticsPreview?: Record<string, unknown> | null;
  settlementAttribution?: Record<string, unknown> | null;
}

export const CAMPAIGN_LIFECYCLE_LABELS: Record<CampaignLifecycleStatus, string> = {
  draft: 'Draft',
  review: 'Review',
  approved: 'Approved',
  scheduled: 'Scheduled',
  running: 'Running',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired',
  archived: 'Archived',
};

export const CAMPAIGN_STATUS_COLORS: Record<CampaignLifecycleStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  review: 'bg-blue-50 text-blue-700 border-blue-200',
  approved: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  scheduled: 'bg-violet-50 text-violet-700 border-violet-200',
  running: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  paused: 'bg-amber-50 text-amber-800 border-amber-200',
  completed: 'bg-green-50 text-green-800 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  expired: 'bg-gray-100 text-gray-600 border-gray-200',
  archived: 'bg-gray-50 text-gray-500 border-gray-200',
};

export const AUDIENCE_OPTIONS: { value: CampaignAudience['kind']; label: string }[] = [
  { value: 'all_customers', label: 'All customers' },
  { value: 'first_order', label: 'First order' },
  { value: 'returning', label: 'Returning customers' },
  { value: 'vip', label: 'VIP' },
  { value: 'segment', label: 'Segments' },
  { value: 'regions', label: 'Regions' },
  { value: 'cities', label: 'Cities' },
  { value: 'vendor_customers', label: 'Vendor customers' },
  { value: 'product_customers', label: 'Product customers' },
  { value: 'custom', label: 'Custom' },
];
