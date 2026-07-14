/** Shared commercial campaign contracts — mirrors backend discount-engine/campaign/types.ts */

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
export type CampaignHealthStatus = 'healthy' | 'warning' | 'critical';
export type CampaignSurface = 'marketing' | 'ecommerce';
export type ParticipantRelation = 'owned' | 'participating';

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

export interface CampaignHealthReport {
  status: CampaignHealthStatus;
  reasons: string[];
  checks?: Record<string, CampaignHealthStatus>;
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
  discountDomain?: 'SERVICE' | 'ECOMMERCE';
  surface?: CampaignSurface;
  budgetCap?: number | null;
  budgetSpent?: number;
  goal?: string | null;
  objective?: string | null;
  metadata: Record<string, unknown>;
  policyFingerprint?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present on participant-scoped responses */
  participantRelation?: ParticipantRelation;
  ownershipLabel?: 'Owned by You' | 'Participating';
  health?: CampaignHealthReport;
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
  discountDomain?: 'SERVICE' | 'ECOMMERCE';
  surface?: CampaignSurface;
  budgetCap?: number | null;
  goal?: string | null;
  objective?: string | null;
  metadata?: Record<string, unknown>;
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

export interface CampaignPublishValidation {
  valid: boolean;
  errors: Array<{ code: string; severity: string; message: string }>;
  warnings: Array<{ code: string; severity: string; message: string }>;
}

export interface CampaignApiClient {
  fetchMode: () => Promise<CampaignModeResponse>;
  fetchRegistry?: (surface?: CampaignSurface) => Promise<CampaignRegistryResponse>;
  listCampaigns: (filters?: {
    status?: string;
    discountDomain?: 'SERVICE' | 'ECOMMERCE';
    surface?: CampaignSurface;
  }) => Promise<CommercialCampaignRecord[]>;
  getCampaign: (id: string) => Promise<CommercialCampaignRecord | null>;
  fetchAnalytics?: (id: string) => Promise<unknown>;
  fetchSettlement?: (id: string) => Promise<unknown>;
  fetchHealth?: (id: string) => Promise<CampaignHealthReport | null>;
  validatePublish?: (id: string) => Promise<CampaignPublishValidation | null>;
  transitionLifecycle?: (id: string, status: CampaignLifecycleStatus) => Promise<CommercialCampaignRecord>;
  duplicateCampaign?: (
    id: string,
    opts?: { includeSchedule?: boolean }
  ) => Promise<CommercialCampaignRecord>;
  createCampaign?: (input: CreateCampaignInput) => Promise<CommercialCampaignRecord>;
  createFromTemplate?: (
    templateId: string,
    overrides?: Partial<CreateCampaignInput>
  ) => Promise<CommercialCampaignRecord>;
  orchestrate?: (id: string, body?: Record<string, unknown>) => Promise<unknown>;
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

export const CAMPAIGN_HEALTH_COLORS: Record<CampaignHealthStatus, string> = {
  healthy: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-50 text-amber-900 border-amber-200',
  critical: 'bg-red-50 text-red-800 border-red-200',
};

export const CAMPAIGN_TIMELINE_STEPS: CampaignLifecycleStatus[] = [
  'draft',
  'approved',
  'scheduled',
  'running',
  'paused',
  'completed',
  'archived',
];

export function discountDomainForSurface(surface: CampaignSurface): 'SERVICE' | 'ECOMMERCE' {
  return surface === 'ecommerce' ? 'ECOMMERCE' : 'SERVICE';
}

export function formatCampaignInr(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

export function resolveHealth(campaign: CommercialCampaignRecord): CampaignHealthReport {
  if (campaign.health) return campaign.health;
  const meta = campaign.metadata?.campaignHealth as CampaignHealthReport | undefined;
  if (meta?.status) return meta;
  return { status: 'healthy', reasons: [] };
}
