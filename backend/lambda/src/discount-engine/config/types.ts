import type { DiscountDomain } from '../enums/discount-domain';
import type { DiscountSource } from '../enums/discount-source';

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
      DiscountDomain,
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
  left: { source: DiscountSource | string };
  right: { source: DiscountSource | string };
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
  domains?: Partial<Record<DiscountDomain, Partial<StackPolicyConfiguration['global']>>>;
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
  domains?: Partial<Record<DiscountDomain, Partial<LimitConfiguration['global']>>>;
  campaigns?: Record<string, Partial<LimitConfiguration['global']>>;
}
