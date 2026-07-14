import { evaluateRules } from './engine';
import type { EligibilityResult, RuleContext, RuleEvaluation } from './types';

export interface RuleComparison {
  promotionId: string;
  domain: string;
  legacyEligible: boolean;
  ruleEngineEligible: boolean;
  matched: boolean;
  legacyReason?: string;
  failedRules: string[];
  ruleResults: EligibilityResult['ruleResults'];
  executionTimeMs: number;
}

export function compareEligibilityShadow(
  context: RuleContext,
  legacyEligible: boolean,
  legacyReason?: string
): RuleComparison {
  const ruleResult = evaluateRules(context);
  const matched = legacyEligible === ruleResult.eligible;

  const comparison: RuleComparison = {
    promotionId: context.promotionId ?? 'unknown',
    domain: context.domain,
    legacyEligible,
    ruleEngineEligible: ruleResult.eligible,
    matched,
    legacyReason,
    failedRules: ruleResult.failedRules,
    ruleResults: ruleResult.ruleResults,
    executionTimeMs: ruleResult.executionTimeMs,
  };

  if (!matched) {
    const firstFailed = ruleResult.ruleResults.find((r: RuleEvaluation) => !r.result.passed);
    console.warn('[rule-engine] shadow eligibility mismatch — using legacy result', {
      promotionId: comparison.promotionId,
      domain: comparison.domain,
      legacyEligible,
      ruleEngineEligible: ruleResult.eligible,
      legacyReason,
      ruleEngineReason: firstFailed?.result.reason,
      failedRules: ruleResult.failedRules,
      ruleDetails: ruleResult.ruleResults
        .filter((r: RuleEvaluation) => !r.result.passed)
        .map((r: RuleEvaluation) => ({
          ruleName: r.ruleName,
          reason: r.result.reason,
          metadata: r.result.metadata,
        })),
    });
  }

  return comparison;
}

export function runEligibilityShadow(
  context: RuleContext,
  legacyEligible: boolean,
  legacyReason?: string
): boolean {
  compareEligibilityShadow(context, legacyEligible, legacyReason);
  return legacyEligible;
}
