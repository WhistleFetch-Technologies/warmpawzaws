import { istLocalToEpochMs } from './datetime';

export const PROMO_ENGINE_STATUSES = [
  'DRAFT',
  'SCHEDULED',
  'ACTIVE',
  'PAUSED',
  'EXPIRED',
  'ARCHIVED',
] as const;

export type PromoEngineStatus = (typeof PROMO_ENGINE_STATUSES)[number];

export const STACKING_POLICIES = [
  'NONE',
  'ORDER_LEVEL',
  'SERVICE_LEVEL',
  'CATEGORY_LEVEL',
  'DISCOUNT_WITH_CASHBACK',
  'FULL_STACKING',
] as const;

export type StackingPolicy = (typeof STACKING_POLICIES)[number];

export const FUNDING_TYPES = ['WARMPAWZ', 'VENDOR', 'SHARED'] as const;
export type PromoFundingType = (typeof FUNDING_TYPES)[number];

/** Catalogue category slug from Admin → Catalogue → Categories. */
export type ServiceCategory = string;

export const RULE_TYPES = ['GENERIC', 'CUSTOMER_JOURNEY'] as const;
export type PromoRuleType = (typeof RULE_TYPES)[number];

export interface PromoFundingSplit {
  warmpawzPercent: number;
  vendorPercent: number;
}

export interface PromoEngineCondition {
  field: string;
  operator: string;
  value: unknown;
}

export interface PromoEngineConditionGroup {
  operator: 'AND' | 'OR';
  conditions: Array<PromoEngineCondition | PromoEngineConditionGroup>;
}

export interface PromoEngineBenefit {
  type: 'DISCOUNT' | 'CASHBACK';
  mode?: 'PERCENT' | 'FIXED';
  value?: number;
  maxAmount?: number;
  expiryDays?: number;
  redeemScope?: ServiceCategory[];
}

export interface PromoEngineBasics {
  name: string;
  code: string;
  priority: number;
  startAt: string;
  endAt: string;
  stackingPolicy: StackingPolicy;
  fundingType: PromoFundingType;
  fundingSplit: PromoFundingSplit;
  commercialCampaignId: string;
  serviceCategories: ServiceCategory[];
}

export interface PromoEngineDraft {
  id: string;
  status: PromoEngineStatus;
  basics: PromoEngineBasics;
  conditionJson: PromoEngineConditionGroup;
  benefitJson: PromoEngineBenefit[];
  ruleType: PromoRuleType;
  limits?: {
    perUser?: number | null;
    perTransaction?: number | null;
    dailyLimit?: number | null;
    campaignLimit?: number | null;
    budgetLimit?: number | null;
  };
  vcf?: PromoVcfDraft;
  /** Customer-facing message overrides; blank keys fall back to app defaults. */
  customerCopy?: PromoCustomerCopy;
  createdAt: string;
  updatedAt: string;
}

export const PROMO_CUSTOMER_COPY_FIELDS = [
  {
    key: 'earnLine',
    label: 'Checkout — cashback line',
    placeholder: 'Earn ₹{amount} cashback after payment',
  },
  {
    key: 'discountLine',
    label: 'Checkout — discount line',
    placeholder: 'Instant discount of ₹{discount} applied',
  },
  {
    key: 'savingsLine',
    label: 'Pay Bill — savings highlight',
    placeholder: 'You save ₹{discount} with this offer!',
  },
  {
    key: 'redeemLine',
    label: 'Checkout — where / how long',
    placeholder: 'Use it {redeemLabel} · valid {expiryDays} days',
  },
  {
    key: 'termsLine',
    label: 'Checkout — small print',
    placeholder: 'Credited to your Warmpawz Wallet only after successful payment.',
  },
  {
    key: 'creditedTitle',
    label: 'Notification title (after credit)',
    placeholder: '₹{amount} cashback credited!',
  },
  {
    key: 'creditedBody',
    label: 'Notification body (after credit)',
    placeholder: 'Added to your Warmpawz Wallet. Use it before {expiryDate}.',
  },
] as const;

export type PromoCustomerCopyKey = (typeof PROMO_CUSTOMER_COPY_FIELDS)[number]['key'];
export type PromoCustomerCopy = Partial<Record<PromoCustomerCopyKey, string>>;

export const PROMO_CUSTOMER_COPY_PLACEHOLDERS = [
  'amount',
  'discount',
  'expiryDays',
  'expiryDate',
  'redeemLabel',
] as const;

export const PROMO_CUSTOMER_COPY_MAX_LENGTH = 200;

export type PromoLetter = 'V' | 'C' | 'F';
/** Visit-source channels. Ecommerce is opt-in (only counted when listed as a specific channel). */
export type PromoCountChannel = 'tele' | 'appointment' | 'paybill' | 'ecommerce';
export type PromoSpendChannel = PromoCountChannel;
export type PromoVisitLoop =
  | { kind: 'visit_number'; n: number }
  | { kind: 'every_nth'; n: number }
  | { kind: 'from_onward'; n: number }
  | { kind: 'between'; n: number; m: number }
  | { kind: 'every' };

/**
 * Audience scope (visit source / publish). Lists hold every selected vendor or category;
 * the singular id/name mirror the first entry for older readers.
 */
export interface PromoAudienceScope {
  letter: PromoLetter;
  vendorId?: string;
  vendorName?: string;
  vendorIds?: string[];
  vendorNames?: string[];
  categoryId?: string;
  categoryName?: string;
  categoryIds?: string[];
  categoryNames?: string[];
}

export interface PromoVcfDraft {
  visitSource: PromoAudienceScope & {
    width: 'general' | 'specific';
    channels?: PromoCountChannel[];
    /** Visits across all selected vendors/categories count together as one group. */
    countMode?: 'pooled';
  };
  visitLoop: PromoVisitLoop;
  benefitMode: 'discount' | 'cashback' | 'both';
  maxDiscount?: number;
  /** `channels` empty/absent = the offer applies on every payment channel. */
  publish: PromoAudienceScope & { channels?: PromoSpendChannel[] };
  redeem?: {
    letter: PromoLetter;
    vendorId?: string;
    vendorName?: string;
    /** Multi-vendor cashback redeem (letter V). */
    vendorIds?: string[];
    vendorNames?: string[];
    categoryId?: string;
    categoryName?: string;
    /** Multi-category cashback redeem (letter C). */
    categoryIds?: string[];
    categoryNames?: string[];
    ecommerceCategoryId?: string;
    channels: PromoSpendChannel[];
  };
  expiryDays?: number;
  rankingOverride?:
    | 'least_platform_loss'
    | 'max_customer_discount'
    | 'max_customer_cashback'
    | 'max_customer_total_value';
}

export function createEmptyVcf(): PromoVcfDraft {
  return {
    visitSource: { letter: 'F', width: 'general' },
    visitLoop: { kind: 'every' },
    benefitMode: 'discount',
    publish: { letter: 'F' },
    redeem: {
      letter: 'F',
      channels: ['tele', 'appointment', 'paybill', 'ecommerce'],
    },
    expiryDays: 30,
  };
}

export interface PromoEngineListItem {
  id: string;
  name: string;
  code: string;
  status: PromoEngineStatus;
  serviceCategories: ServiceCategory[];
  ruleType: PromoRuleType;
  fundingType: PromoFundingType;
  usageCount: number;
  startAt: string;
  endAt: string;
  updatedAt: string;
}

/** Status to show in admin: a live/scheduled/paused promo whose end date has passed reads as EXPIRED. */
export function effectivePromoStatus(
  item: Pick<PromoEngineListItem, 'status' | 'endAt'>,
  now: Date = new Date(),
): PromoEngineStatus {
  if (item.status !== 'ACTIVE' && item.status !== 'SCHEDULED' && item.status !== 'PAUSED') {
    return item.status;
  }
  const end = istLocalToEpochMs(item.endAt);
  return Number.isFinite(end) && end <= now.getTime() ? 'EXPIRED' : item.status;
}

export const DEFAULT_FUNDING_SPLIT: PromoFundingSplit = {
  warmpawzPercent: 70,
  vendorPercent: 30,
};

export function createEmptyBasics(): PromoEngineBasics {
  return {
    name: '',
    code: '',
    priority: 50,
    startAt: '',
    endAt: '',
    stackingPolicy: 'SERVICE_LEVEL',
    fundingType: 'WARMPAWZ',
    fundingSplit: { ...DEFAULT_FUNDING_SPLIT },
    commercialCampaignId: '',
    serviceCategories: [],
  };
}

export function createEmptyDraft(id: string, now = new Date().toISOString()): PromoEngineDraft {
  return {
    id,
    status: 'DRAFT',
    basics: createEmptyBasics(),
    conditionJson: { operator: 'AND', conditions: [] },
    benefitJson: [],
    ruleType: 'GENERIC',
    vcf: createEmptyVcf(),
    createdAt: now,
    updatedAt: now,
  };
}

export function toListItem(draft: PromoEngineDraft): PromoEngineListItem {
  return {
    id: draft.id,
    name: draft.basics.name || 'Untitled draft',
    code: draft.basics.code,
    status: draft.status,
    serviceCategories: draft.basics.serviceCategories,
    ruleType: draft.ruleType,
    fundingType: draft.basics.fundingType,
    usageCount: 0,
    startAt: draft.basics.startAt,
    endAt: draft.basics.endAt,
    updatedAt: draft.updatedAt,
  };
}
