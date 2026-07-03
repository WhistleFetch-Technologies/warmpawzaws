/**
 * Discount engine policy configuration contracts — mirrors
 * backend/lambda/src/discount-engine/config/types.ts (UI layer only).
 */

export type DiscountDomainKey =
  | 'SERVICE'
  | 'ECOMMERCE'
  | 'SUBSCRIPTION'
  | 'MEMBERSHIP'
  | 'PHARMACY'
  | 'TELECONSULT';

export type PriorityStrategyKey =
  | 'MAX_CUSTOMER_SAVINGS'
  | 'VENDOR_SPOTLIGHT_FIRST'
  | 'FIXED_PRIORITY_WEIGHT'
  | 'LOWEST_PLATFORM_COST'
  | 'ADMIN_MANUAL_ORDER';

export type TieBreakerKey =
  | 'EXCLUSIVE'
  | 'SPOTLIGHT'
  | 'PRIORITY_WEIGHT'
  | 'VALID_FROM'
  | 'ID';

export type EvaluationPhase = 'AUTO_PROMOTIONS' | 'COUPONS';

export interface PriorityPhaseConfig {
  maxSelected?: number;
}

export interface PriorityConfiguration {
  version: string;
  global: {
    strategy: PriorityStrategyKey;
    tieBreakers: TieBreakerKey[];
    phases: Partial<Record<EvaluationPhase, PriorityPhaseConfig>>;
    manualOrder?: string[];
  };
  domains?: Partial<
    Record<
      DiscountDomainKey,
      Partial<{
        strategy: PriorityStrategyKey;
        tieBreakers: TieBreakerKey[];
        phases: Partial<Record<EvaluationPhase, PriorityPhaseConfig>>;
        manualOrder: string[];
      }>
    >
  >;
}

export interface StackRuleConfig {
  id: string;
  left: { source: string };
  right: { source: string };
  allowed: boolean;
  applicationMode?: 'SEQUENTIAL' | 'PARALLEL';
  order?: string[];
  reasonCode?: string;
}

export interface StackPolicyConfiguration {
  version: string;
  global: {
    allowCouponWithPromotion: boolean;
    allowMultipleCoupons: boolean;
    allowMultipleVendorPromotions: boolean;
    allowPlatformWithVendor: boolean;
    applicationModeDefault: 'SEQUENTIAL' | 'PARALLEL';
    exclusiveSkipsCouponPhase: boolean;
    exclusiveTerminatesAll: boolean;
    stackOrder: string[];
    stackRules: StackRuleConfig[];
  };
  domains?: Partial<Record<DiscountDomainKey, Partial<StackPolicyConfiguration['global']>>>;
}

export interface FundingStackVeto {
  id: string;
  description?: string;
}

export interface FundingConfiguration {
  version: string;
  sharedDefaultSplit: { platformPercent: number; vendorPercent: number };
  stackVetoes: FundingStackVeto[];
  settlementHints: { roundTo: number; currency: string };
  blockVendorFundedWithPlatformCoupon?: boolean;
  blockSharedWithPlatformCoupon?: boolean;
}

export type CapOverflowStrategy = 'REJECT_LAST' | 'TRIM_TO_CAP' | 'REJECT_LOWEST_SAVINGS';

export interface LimitConfiguration {
  version: string;
  global: {
    maxAutoPromotions: number;
    maxVendorPromotions: number;
    maxPlatformPromotions: number;
    maxCoupons: number;
    maxTotalDiscounts: number;
    maxTotalDiscountPercent: number;
    minPayableAmount: number;
    capOverflowStrategy: CapOverflowStrategy;
  };
  domains?: Partial<Record<DiscountDomainKey, Partial<LimitConfiguration['global']>>>;
  campaigns?: Record<string, Partial<LimitConfiguration['global']>>;
}

export interface DiscountPolicyBundle {
  priority: PriorityConfiguration;
  stack: StackPolicyConfiguration;
  funding: FundingConfiguration;
  limits: LimitConfiguration;
}

export type PolicyScope = 'global' | DiscountDomainKey;

export interface ValidationFinding {
  severity: 'error' | 'warning' | 'suggestion';
  ruleId: string;
  message: string;
  path?: string;
  suggestion?: string;
}

export interface ValidationResult {
  findings: ValidationFinding[];
  errors: ValidationFinding[];
  warnings: ValidationFinding[];
  suggestions: ValidationFinding[];
  isPublishable: boolean;
  validatedFingerprint?: string;
}

export interface PolicyHistoryEntry {
  id: string;
  version: string;
  policyFingerprint: string;
  publishedBy?: string;
  publishedAt: string;
  summary?: string;
  rollbackAvailable: boolean;
}

export interface RuntimePolicyDiagnostics {
  priorityVersion: string;
  stackVersion: string;
  fundingVersion: string;
  limitsVersion: string;
  policyFingerprint: string | null;
  publishId: string | null;
  publishedBy: string | null;
  publishedAt: string | null;
  status: 'draft' | 'published' | 'unknown';
  featureFlags: Record<string, string>;
}

export interface PolicyApiCapabilities {
  runtimeRead: boolean;
  draftRead: boolean;
  draftWrite: boolean;
  validate: boolean;
  publish: boolean;
  rollback: boolean;
  history: boolean;
  simulate: boolean;
  audit: boolean;
}
