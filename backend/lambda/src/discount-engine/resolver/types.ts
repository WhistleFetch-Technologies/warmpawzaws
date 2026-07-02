import type { BenefitResult } from '../benefits/types';
import type { DiscountContext } from '../models/discount-context';
import type { AppliedDiscount, DiscountBenefitLine, DiscountEngineResult } from '../models/discount-result';
import type { EligibilityResult } from '../rules/types';
import type { DiscountCandidate } from '../candidates/types';
import type { CandidateProvider } from '../candidates/providers/types';

export interface CandidateRuleOutcome {
  candidate: DiscountCandidate;
  eligibility: EligibilityResult;
}

export interface CandidateBenefitOutcome {
  candidate: DiscountCandidate;
  benefit: BenefitResult;
  discountAmount: number;
}

export interface UsagePreparedEntry {
  candidateId: string;
  source: string;
  owner: string;
  domain: string;
  discountAmount: number;
  prepared: boolean;
  metadata?: Record<string, unknown>;
}

export interface ResolverDiagnostics {
  pipelineTimeMs: number;
  candidateCount: number;
  eligibleCount: number;
  rejectedCount: number;
  providerBreakdown: Record<string, number>;
  usagePrepared: UsagePreparedEntry[];
}

/** Unified resolver output — Phase 5A adds priority shadow diagnostics in metadata. */
export interface ResolverResult extends DiscountEngineResult {
  eligibleCandidates: DiscountCandidate[];
  rejectedCandidates: DiscountCandidate[];
  /** Phase 4: all eligible candidates (no winner selection). */
  appliedCandidates: DiscountCandidate[];
  benefitResults: CandidateBenefitOutcome[];
  ruleResults: CandidateRuleOutcome[];
  executionTimeMs: number;
  resolverVersion: string;
}

export interface CandidateRepository {
  loadCandidates(
    context: DiscountContext,
    providers?: CandidateProvider[]
  ): Promise<{ candidates: DiscountCandidate[]; providerBreakdown: Record<string, number> }>;
}

export interface UnifiedDiscountResolver {
  resolve(context: DiscountContext): Promise<ResolverResult>;
}
