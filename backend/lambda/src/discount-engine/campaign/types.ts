import { DiscountFunding } from '../enums/discount-funding';
import type { CampaignMode } from './campaign-mode';

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

export type CampaignFundingType = DiscountFunding | 'CUSTOM';

export type CampaignDiscountDomain = 'SERVICE' | 'ECOMMERCE';

export type CampaignSurface = 'marketing' | 'ecommerce';

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
  /** First-class commercial domain — SERVICES vs Shop. */
  discountDomain: CampaignDiscountDomain;
  surface: CampaignSurface;
  budgetCap?: number | null;
  budgetSpent: number;
  goal?: string | null;
  objective?: string | null;
  metadata: Record<string, unknown>;
  policyFingerprint?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignPromotionLink {
  id: string;
  campaignId: string;
  promotionId?: string | null;
  couponId?: string | null;
  linkType: 'promotion' | 'coupon';
  isActive?: boolean;
}

export interface OrchestrateCampaignInput {
  promotions?: Array<Record<string, unknown>>;
  coupons?: Array<Record<string, unknown>>;
}

export interface AttachCampaignOffersInput {
  promotionIds?: string[];
  couponIds?: string[];
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
  discountDomain?: CampaignDiscountDomain;
  surface?: CampaignSurface;
  budgetCap?: number | null;
  goal?: string | null;
  objective?: string | null;
  metadata?: Record<string, unknown>;
  promotions?: Array<Record<string, unknown>>;
  coupons?: Array<Record<string, unknown>>;
}

export interface CampaignAttributionMetadata {
  campaignId: string;
  campaignName: string;
  campaignVersion: number;
  campaignTemplate?: string | null;
  campaignType: string;
  fundingPolicy: CampaignFundingPolicy;
  discountDomain?: CampaignDiscountDomain;
  surface?: CampaignSurface;
  budgetCap?: number | null;
  budgetSpent?: number;
  budgetRemaining?: number | null;
}

export interface CampaignAudit {
  campaignId: string;
  campaignVersion: number;
  mode: CampaignMode;
  policyFingerprint: string;
  campaignVersionLabel: string;
  promotions: string[];
  coupons: string[];
  funding: CampaignFundingPolicy;
  audience: CampaignAudience;
  notifications: {
    mode: CampaignNotificationMode;
    notificationCampaignId?: string | null;
  };
  analytics?: Record<string, unknown>;
  settlement?: Record<string, unknown>;
  timestamp: string;
  executionTimeMs: number;
}

export interface CampaignOrchestrationResult {
  campaign: CommercialCampaignRecord;
  links: CampaignPromotionLink[];
  audit: CampaignAudit;
  analyticsPreview?: Record<string, unknown> | null;
  settlementAttribution?: Record<string, unknown> | null;
}
