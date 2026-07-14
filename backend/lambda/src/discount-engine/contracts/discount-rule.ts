import type { DiscountContext } from '../models/discount-context';

export interface DiscountRuleEvaluation {
  passed: boolean;
  ruleId: string;
  ruleType: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Contract for a single eligibility / constraint rule.
 * Phase 2 will provide concrete evaluators.
 */
export interface DiscountRule {
  readonly ruleId: string;
  readonly ruleType: string;
  evaluate(context: DiscountContext): DiscountRuleEvaluation | Promise<DiscountRuleEvaluation>;
}
