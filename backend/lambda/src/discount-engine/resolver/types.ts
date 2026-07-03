import type { BenefitResult } from '../benefits/types';
import type { DiscountContext } from '../models/discount-context';
import type { AppliedDiscount, DiscountBenefitLine, DiscountEngineResult } from '../models/discount-result';
import type { EligibilityResult } from '../rules/types';
import type { DiscountCandidate } from '../candidates/types';
import type { CandidateProvider } from '../candidates/providers/types';
import type { PriorityMode } from '../policy/priority-mode';
import type { ValidationResult } from '../policy/validation-result';
import type { PriorityResult } from '../priority/priority-types';
import type { StackAudit, StackMode } from '../stack/types';
import type { SettlementAudit, SettlementMode } from '../settlement/types';

export interface SettlementDiagnostics {
  settlementMode: SettlementMode;
  settlementVersion: string;
  policyFingerprint?: string;
  authoritative: boolean;
  executionTimeMs: number;
  customerPayable: number;
  vendorReceivable: number;
  platformCost: number;
  vendorCost: number;
  netSettlement: number;
  audit?: SettlementAudit;
}

export interface StackDiagnostics {
  stackMode: StackMode;
  stackVersion: string;
  policyFingerprint?: string;
  authoritative: boolean;
  appliedCount: number;
  rejectedCount: number;
  executionTimeMs: number;
  totalSavings: number;
  finalAmount: number;
  audit?: StackAudit;
}

export interface PriorityDiagnostics {
  priorityMode: PriorityMode;
  priorityVersion: string;
  policyFingerprint?: string;
  strategy?: string;
  selectedCount: number;
  rejectedCount: number;
  executionTimeMs: number;
  validationWarnings: number;
  validationErrors: number;
  authoritative: boolean;
  fallbackReason?: string;
  autoPhase?: PriorityResult;
  couponPhase?: PriorityResult;
  validation?: ValidationResult;
}

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

/** Unified resolver output — Phase 5B adds priority diagnostics in metadata. */
export interface ResolverResult extends DiscountEngineResult {
  eligibleCandidates: DiscountCandidate[];
  rejectedCandidates: DiscountCandidate[];
  /** Priority-selected candidates after stack (authoritative mode). */
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
