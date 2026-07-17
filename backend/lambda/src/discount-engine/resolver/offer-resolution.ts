/**
 * Offer Resolution — policy-driven winner selection from discovered candidates.
 */
import { DiscountTrigger } from '../enums/discount-trigger';
import { getStrategyRegistry } from '../priority/strategy-registry';
import type { EligibleBenefit, PriorityResult } from '../priority/priority-types';
import { sortScoredBenefits } from '../priority/priority-utils';
import { ensureBusinessRules } from '../config/business-rules-mapper';
import {
  normalizeApplicationStrategy,
  type DiscountApplicationStrategy,
} from '../config/business-rules-types';
import type { RuntimePolicyFingerprint } from '../policy/runtime-policy-fingerprint';
import type { DiscountContext } from '../models/discount-context';
import { benefitOutcomesToEligible } from './priority-pipeline';
import type { CandidateBenefitOutcome } from './types';
import { getPriorityEngine } from '../priority/priority-engine';

export interface OfferResolutionResult {
  applicationStrategy: DiscountApplicationStrategy;
  unifiedPhase?: PriorityResult;
  autoPhase?: PriorityResult;
  couponPhase?: PriorityResult;
  mergedSelected: EligibleBenefit[];
  resolutionReason: string;
  rejectedOffers: Array<{ candidateId: string; reason: string }>;
}

function prioritizeUnifiedPool(
  eligibleBenefits: EligibleBenefit[],
  context: DiscountContext,
  runtimePolicy: RuntimePolicyFingerprint,
  maxSelected: number
): PriorityResult {
  const started = performance.now();
  const strategyKey = runtimePolicy.priority.global.strategy;
  const tieBreakers = runtimePolicy.priority.global.tieBreakers;
  const strategy = getStrategyRegistry().get(strategyKey);
  const strategyCtx = {
    context,
    phase: 'AUTO_PROMOTIONS' as const,
    manualOrder: runtimePolicy.priority.global.manualOrder,
  };

  const scored = eligibleBenefits.map((benefit) => ({
    benefit,
    score: strategy.score(benefit, strategyCtx),
  }));
  const orderedScored = sortScoredBenefits(scored, tieBreakers);
  const orderedCandidateList = orderedScored.map((s) => s.benefit);
  const selectedCandidates = maxSelected <= 0 ? [] : orderedCandidateList.slice(0, maxSelected);
  const rejectedByLimit = orderedCandidateList.slice(maxSelected).map((benefit, offset) => ({
    candidateId: benefit.candidate.id,
    reasonCode: 'PROMOTION_LIMIT' as const,
    reasonDetail: `BEST_OFFER_ONLY: not highest-ranked (${maxSelected} max)`,
    rank: maxSelected + offset + 1,
  }));

  return {
    phase: 'AUTO_PROMOTIONS',
    policyFingerprint: runtimePolicy.policyFingerprint,
    strategy: strategyKey,
    tieBreakers,
    orderedCandidateList,
    selectedCandidates,
    rejectedByLimit,
    exclusiveCandidates: [],
    priorityAudit: {
      phase: 'AUTO_PROMOTIONS',
      strategy: strategyKey,
      policyFingerprint: runtimePolicy.policyFingerprint,
      decisions: [],
      executionTimeMs: performance.now() - started,
    },
    executionTimeMs: performance.now() - started,
  };
}

function runAutoPhase(
  eligibleBenefits: EligibleBenefit[],
  context: DiscountContext,
  runtimePolicy: RuntimePolicyFingerprint
): PriorityResult {
  const engine = getPriorityEngine();
  return engine.prioritize({
    eligibleBenefits,
    context,
    priorityConfiguration: runtimePolicy.priority,
    limitConfiguration: runtimePolicy.limits,
    runtimePolicy,
    policyFingerprint: runtimePolicy.policyFingerprint,
    phase: 'AUTO_PROMOTIONS',
  });
}

function runCouponPhase(
  eligibleBenefits: EligibleBenefit[],
  context: DiscountContext,
  runtimePolicy: RuntimePolicyFingerprint,
  runningAmount: number
): PriorityResult {
  const engine = getPriorityEngine();
  return engine.prioritize({
    eligibleBenefits,
    context,
    priorityConfiguration: runtimePolicy.priority,
    limitConfiguration: runtimePolicy.limits,
    runtimePolicy,
    policyFingerprint: runtimePolicy.policyFingerprint,
    phase: 'COUPONS',
    runningAmount,
  });
}

export function resolveOffers(
  context: DiscountContext,
  benefitResults: CandidateBenefitOutcome[],
  runtimePolicy: RuntimePolicyFingerprint
): OfferResolutionResult {
  const rules = ensureBusinessRules({
    priority: runtimePolicy.priority,
    stack: runtimePolicy.stack,
    funding: runtimePolicy.funding,
    limits: runtimePolicy.limits,
    businessRules: runtimePolicy.businessRules,
  });

  const strategy = normalizeApplicationStrategy(rules.applicationStrategy);
  const eligibleBenefits = benefitOutcomesToEligible(benefitResults);
  const rejectedOffers: Array<{ candidateId: string; reason: string }> = [];

  if (strategy === 'BEST_OFFER_ONLY') {
    const unifiedPhase = prioritizeUnifiedPool(eligibleBenefits, context, runtimePolicy, 1);
    const selectedIds = new Set(unifiedPhase.selectedCandidates.map((s) => s.candidate.id));
    for (const b of eligibleBenefits) {
      if (!selectedIds.has(b.candidate.id)) {
        const rejected = unifiedPhase.rejectedByLimit.find(
          (r) => r.candidateId === b.candidate.id
        );
        rejectedOffers.push({
          candidateId: b.candidate.id,
          reason: rejected?.reasonDetail ?? 'BEST_OFFER_ONLY_NOT_WINNER',
        });
      }
    }
    return {
      applicationStrategy: strategy,
      unifiedPhase,
      mergedSelected: unifiedPhase.selectedCandidates,
      resolutionReason: `BEST_OFFER_ONLY:${rules.winningStrategy ?? 'HIGHEST_CUSTOMER_SAVINGS'}`,
      rejectedOffers,
    };
  }

  const autoPhase = runAutoPhase(eligibleBenefits, context, runtimePolicy);
  const exclusiveSelected = autoPhase.selectedCandidates.some((b) => b.candidate.exclusive);
  const skipCouponPhase =
    runtimePolicy.stack.global.exclusiveSkipsCouponPhase && exclusiveSelected;

  let couponPhase: PriorityResult | undefined;
  if (!skipCouponPhase) {
    const couponEligible = eligibleBenefits.filter(
      (b) => b.candidate.trigger === DiscountTrigger.CODE
    );
    if (couponEligible.length > 0) {
      const runningAmount = Math.max(
        0,
        context.amount -
          autoPhase.selectedCandidates.reduce((s, c) => s + c.discountAmount, 0)
      );
      couponPhase = runCouponPhase(eligibleBenefits, context, runtimePolicy, runningAmount);
    }
  }

  const mergedSelected = [
    ...autoPhase.selectedCandidates,
    ...(couponPhase?.selectedCandidates ?? []),
  ];

  const selectedIds = new Set(mergedSelected.map((s) => s.candidate.id));
  for (const b of eligibleBenefits) {
    if (!selectedIds.has(b.candidate.id)) {
      rejectedOffers.push({
        candidateId: b.candidate.id,
        reason: strategy === 'PROMOTION_PLUS_COUPON' ? 'PROMO_COUPON_PAIR_LIMIT' : 'STACK_REJECTED',
      });
    }
  }

  return {
    applicationStrategy: strategy,
    autoPhase,
    couponPhase,
    mergedSelected,
    resolutionReason: strategy,
    rejectedOffers,
  };
}
