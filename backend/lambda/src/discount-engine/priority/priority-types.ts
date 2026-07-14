import type { DiscountCandidate } from '../candidates/types';
import type { PriorityConfiguration, EvaluationPhase } from '../config/types';
import type { DiscountContext } from '../models/discount-context';
import type { RuntimePolicy } from '../policy/runtime-policy';
import type { PriorityAudit } from './priority-audit';
import type { PriorityStrategyKey, TieBreakerKey } from '../config/types';

export interface EligibleBenefit {
  candidate: DiscountCandidate;
  discountAmount: number;
  benefitType?: string;
}

export interface PriorityEngineInput {
  eligibleBenefits: EligibleBenefit[];
  context: DiscountContext;
  priorityConfiguration: PriorityConfiguration;
  limitConfiguration: RuntimePolicy['limits'];
  runtimePolicy: RuntimePolicy;
  policyFingerprint: string;
  phase: EvaluationPhase;
  runningAmount?: number;
}

export interface RejectedByLimitEntry {
  candidateId: string;
  reasonCode: 'PROMOTION_LIMIT' | 'COUPON_LIMIT' | 'CANDIDATE_LIMIT';
  reasonDetail: string;
  rank: number;
}

export interface ExclusiveCandidateFlag {
  candidateId: string;
  rank: number;
}

export interface PriorityResult {
  phase: EvaluationPhase;
  policyFingerprint: string;
  strategy: PriorityStrategyKey;
  tieBreakers: TieBreakerKey[];
  orderedCandidateList: EligibleBenefit[];
  selectedCandidates: EligibleBenefit[];
  rejectedByLimit: RejectedByLimitEntry[];
  exclusiveCandidates: ExclusiveCandidateFlag[];
  priorityAudit: PriorityAudit;
  executionTimeMs: number;
}

export interface PriorityStrategyContext {
  context: DiscountContext;
  phase: EvaluationPhase;
  runningAmount?: number;
  manualOrder?: string[];
}

export interface PriorityStrategy {
  readonly key: PriorityStrategyKey;
  score(benefit: EligibleBenefit, ctx: PriorityStrategyContext): number;
}

export interface ScoredBenefit {
  benefit: EligibleBenefit;
  score: number;
}
