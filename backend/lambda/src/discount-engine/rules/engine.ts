import { RULE_GROUP_ORDER } from './groups';
import type { DiscountCandidate } from '../candidates/types';
import {
  candidateToRuleContext,
  type CandidateRuleRuntimeContext,
} from '../candidates/bridges/candidate-to-rule-context';
import { getRuleRegistry } from './registry';
import type {
  DiscountRule,
  EligibilityResult,
  RuleContext,
  RuleEngine,
  RuleEngineOptions,
  RuleEvaluation,
} from './types';

function sortByGroup(rules: DiscountRule[]): DiscountRule[] {
  const order = RULE_GROUP_ORDER as readonly string[];
  return [...rules].sort(
    (a, b) => order.indexOf(a.group) - order.indexOf(b.group)
  );
}

export class DefaultRuleEngine implements RuleEngine {
  constructor(private readonly resolveRules = getRuleRegistry) {}

  evaluate(context: RuleContext, options: RuleEngineOptions = {}): EligibilityResult {
    const started = Date.now();
    const failFast = options.failFast === true;
    const candidates = options.rules ?? this.resolveRules().getAll();
    const applicable = sortByGroup(candidates.filter((rule) => rule.applies(context)));

    const ruleResults: RuleEvaluation[] = [];
    const passedRules: string[] = [];
    const failedRules: string[] = [];
    let eligible = true;

    for (const rule of applicable) {
      const result = rule.evaluate(context);
      ruleResults.push({ ruleName: result.ruleName, group: rule.group, result });
      if (result.passed) {
        if (!passedRules.includes(result.ruleName)) {
          passedRules.push(result.ruleName);
        }
      } else {
        if (!failedRules.includes(result.ruleName)) {
          failedRules.push(result.ruleName);
        }
        eligible = false;
        if (failFast) break;
      }
    }

    return {
      eligible,
      ruleResults,
      passedRules,
      failedRules,
      executionTimeMs: Date.now() - started,
      metadata: {
        domain: context.domain,
        promotionId: context.promotionId,
        failFast,
        evaluatedRuleCount: ruleResults.length,
      },
    };
  }
}

export function evaluateCandidateEligibility(
  candidate: DiscountCandidate,
  runtime: CandidateRuleRuntimeContext,
  options?: RuleEngineOptions
): EligibilityResult {
  const context = candidateToRuleContext(candidate, runtime);
  return evaluateRules(context, options);
}

let defaultEngine: DefaultRuleEngine | null = null;

export function getRuleEngine(): DefaultRuleEngine {
  if (!defaultEngine) {
    defaultEngine = new DefaultRuleEngine();
  }
  return defaultEngine;
}

export function evaluateRules(
  context: RuleContext,
  options?: RuleEngineOptions & { rules?: DiscountRule[] }
): EligibilityResult {
  return getRuleEngine().evaluate(context, options);
}
