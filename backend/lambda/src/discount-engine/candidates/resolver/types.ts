import type { DiscountContext } from '../../models/discount-context';
import type { DiscountEngineResult } from '../../models/discount-result';
import type { DiscountCandidate } from '../types';
import type { CandidateLoadContext, CandidateProvider } from '../providers/types';

/**
 * Aggregates raw rows from providers and normalizes to candidates.
 * Orchestration implementation deferred to Phase 4.
 */
export interface CandidateRepository {
  loadCandidates(
    context: DiscountContext | CandidateLoadContext,
    providers?: CandidateProvider[]
  ): Promise<DiscountCandidate[]>;
}

/** Phase 4 unified resolver output (interface only). */
export interface ResolverResult extends DiscountEngineResult {
  candidates: DiscountCandidate[];
  resolverVersion?: string;
}

/**
 * Phase 4 entry point — NOT implemented in Phase 3.5.
 * Resolves eligible + calculated discounts from DiscountContext.
 */
export interface UnifiedDiscountResolver {
  resolve(context: DiscountContext): Promise<ResolverResult>;
}

export type { CandidateNormalizer } from '../candidate-normalizer';
export type { CandidateProvider, CandidateLoadContext } from '../providers/types';
