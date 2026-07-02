import type { DiscountContext } from '../models/discount-context';
import type { RuntimePolicy } from '../policy/runtime-policy';
import type { EligibleBenefit } from '../priority/priority-types';
import type { CandidateBenefitOutcome } from '../resolver/types';
import type { StackMode } from './stack-mode';

export type StackRejectionReason =
  | 'EXCLUSIVE'
  | 'CONFLICT'
  | 'RULE'
  | 'FUNDING'
  | 'LIMIT'
  | 'PRIORITY'
  | 'DUPLICATE'
  | 'STACK_DISABLED'
  | 'MIN_PAYABLE'
  | 'CAP_OVERFLOW';

export interface StackRejectedCandidate {
  candidateId: string;
  source: string;
  name: string;
  reason: StackRejectionReason;
  reasonCode?: string;
  ruleId?: string;
  conflictWith?: string;
  detail: string;
  funding?: string;
  phase: 'AUTO_PROMOTIONS' | 'COUPONS';
}

export interface StackAppliedStep {
  candidateId: string;
  source: string;
  name: string;
  phase: 'AUTO_PROMOTIONS' | 'COUPONS';
  discountAmount: number;
  runningAmountBefore: number;
  runningAmountAfter: number;
  applicationMode: 'SEQUENTIAL' | 'PARALLEL';
  funding?: string;
  order: number;
}

export interface StackConflictRecord {
  leftId: string;
  rightId: string;
  ruleId?: string;
  reasonCode: string;
  resolution: 'REJECTED_LOWER' | 'REJECTED_BOTH';
}

export interface StackAudit {
  mode: StackMode;
  policyFingerprint: string;
  stackVersion: string;
  originalAmount: number;
  finalAmount: number;
  totalSavings: number;
  appliedSteps: StackAppliedStep[];
  rejected: StackRejectedCandidate[];
  conflicts: StackConflictRecord[];
  executionTimeMs: number;
}

export interface StackDecision {
  applied: EligibleBenefit[];
  rejected: StackRejectedCandidate[];
  audit: StackAudit;
  runningAmount: number;
  totalSavings: number;
}

export interface StackEngineInput {
  context: DiscountContext;
  /** Priority-selected candidates (auto + coupon phases merged). */
  selectedCandidates: EligibleBenefit[];
  benefitResults: CandidateBenefitOutcome[];
  runtimePolicy: RuntimePolicy;
  policyFingerprint: string;
}

export interface ResolvedStackPolicy {
  version: string;
  allowCouponWithPromotion: boolean;
  allowMultipleCoupons: boolean;
  allowMultipleVendorPromotions: boolean;
  allowPlatformWithVendor: boolean;
  applicationModeDefault: 'SEQUENTIAL' | 'PARALLEL';
  exclusiveSkipsCouponPhase: boolean;
  exclusiveTerminatesAll: boolean;
  stackOrder: string[];
  stackRules: import('../config/types').StackRuleConfig[];
}
