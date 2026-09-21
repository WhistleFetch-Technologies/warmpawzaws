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
  createdAt: string;
  updatedAt: string;
}

export type PromoLetter = 'V' | 'C' | 'F';
export type PromoCountChannel = 'tele' | 'appointment' | 'paybill';
export type PromoSpendChannel = PromoCountChannel | 'ecommerce';
export type PromoVisitLoop =
  | { kind: 'visit_number'; n: number }
  | { kind: 'every_nth'; n: number }
  | { kind: 'from_onward'; n: number }
  | { kind: 'between'; n: number; m: number }
  | { kind: 'every' };

export interface PromoVcfDraft {
  visitSource: {
    letter: PromoLetter;
    vendorId?: string;
    vendorName?: string;
    categoryId?: string;
    categoryName?: string;
    width: 'general' | 'specific';
    channels?: PromoCountChannel[];
  };
  visitLoop: PromoVisitLoop;
  benefitMode: 'discount' | 'cashback' | 'both';
  maxDiscount?: number;
  publish: {
    letter: PromoLetter;
    vendorId?: string;
    vendorName?: string;
    categoryId?: string;
    categoryName?: string;
  };
  redeem?: {
    letter: PromoLetter;
    vendorId?: string;
    vendorName?: string;
    categoryId?: string;
    categoryName?: string;
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
