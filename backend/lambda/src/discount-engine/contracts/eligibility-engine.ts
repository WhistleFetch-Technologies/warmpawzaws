import type { DiscountContext } from '../models/discount-context';
import type { DiscountRuleEvaluation } from './discount-rule';

/**
 * Evaluates whether discounts are eligible for a given context.
 * Phase 2+ will unify rule evaluation behind this contract.
 */
export interface EligibilityEngine {
  evaluate(
    context: DiscountContext,
    candidateDiscountIds?: string[]
  ): Promise<DiscountRuleEvaluation[]> | DiscountRuleEvaluation[];
}
