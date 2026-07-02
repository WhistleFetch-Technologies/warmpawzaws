import type { PriorityDecision, PriorityAudit } from './priority-audit';
import type {
  EligibleBenefit,
  PriorityEngineInput,
  PriorityResult,
  PriorityStrategyContext,
  RejectedByLimitEntry,
  ScoredBenefit,
} from './priority-types';
import {
  filterBenefitsForPhase,
  resolveSelectionLimit,
  sortScoredBenefits,
} from './priority-utils';
import { StrategyRegistry, getStrategyRegistry } from './strategy-registry';

export class PriorityEngine {
  constructor(private readonly strategyRegistry: StrategyRegistry = getStrategyRegistry()) {}

  /**
   * Pure ranking — no side effects, no I/O, no logging.
   * Does not decide coexistence (Stack Engine, Phase 6).
   */
  prioritize(input: PriorityEngineInput): PriorityResult {
    const started = performance.now();
    const {
      eligibleBenefits,
      context,
      priorityConfiguration,
      limitConfiguration,
      policyFingerprint,
      phase,
      runningAmount,
    } = input;

    const strategyKey = priorityConfiguration.global.strategy;
    const tieBreakers = priorityConfiguration.global.tieBreakers;
    const strategy = this.strategyRegistry.get(strategyKey);

    const phaseBenefits = filterBenefitsForPhase(eligibleBenefits, phase);
    const strategyCtx: PriorityStrategyContext = {
      context,
      phase,
      runningAmount,
      manualOrder: priorityConfiguration.global.manualOrder,
    };

    const scored: ScoredBenefit[] = phaseBenefits.map((benefit) => ({
      benefit,
      score: strategy.score(benefit, strategyCtx),
    }));

    const orderedScored = sortScoredBenefits(scored, tieBreakers);
    const orderedCandidateList = orderedScored.map((s) => s.benefit);

    const priorityMaxSelected = priorityConfiguration.global.phases[phase]?.maxSelected;
    const selectionLimit = resolveSelectionLimit(
      phase,
      priorityMaxSelected,
      limitConfiguration.global
    );

    const selectedCandidates =
      selectionLimit <= 0 ? [] : orderedCandidateList.slice(0, selectionLimit);

    const rejectedByLimit: RejectedByLimitEntry[] = orderedCandidateList
      .slice(selectionLimit)
      .map((benefit, offset) => ({
        candidateId: benefit.candidate.id,
        reasonCode:
          phase === 'COUPONS' ? ('COUPON_LIMIT' as const) : ('PROMOTION_LIMIT' as const),
        reasonDetail:
          phase === 'COUPONS'
            ? `Exceeded maxCoupons / maxSelected (${selectionLimit})`
            : `Exceeded maxAutoPromotions / maxSelected (${selectionLimit})`,
        rank: selectionLimit + offset + 1,
      }));

    const exclusiveCandidates = orderedCandidateList
      .map((benefit, index) => ({ benefit, rank: index + 1 }))
      .filter(({ benefit }) => Boolean(benefit.candidate.exclusive))
      .map(({ benefit, rank }) => ({ candidateId: benefit.candidate.id, rank }));

    const executionTimeMs = performance.now() - started;
    const decisions: PriorityDecision[] = orderedScored.map((entry, index) => {
      const rank = index + 1;
      const selected = rank <= selectedCandidates.length;
      const rejected = rejectedByLimit.find((r) => r.candidateId === entry.benefit.candidate.id);
      return {
        candidateId: entry.benefit.candidate.id,
        score: entry.score,
        rank,
        selectedForStack: selected,
        rejectedReason: rejected?.reasonCode,
        strategy: strategyKey,
        policyFingerprint,
        executionTimeMs: 0,
      };
    });

    const priorityAudit: PriorityAudit = {
      phase,
      policyFingerprint,
      strategy: strategyKey,
      decisions,
      executionTimeMs,
    };

    return {
      phase,
      policyFingerprint,
      strategy: strategyKey,
      tieBreakers,
      orderedCandidateList,
      selectedCandidates,
      rejectedByLimit,
      exclusiveCandidates,
      priorityAudit,
      executionTimeMs,
    };
  }
}

let defaultEngine: PriorityEngine | null = null;

export function getPriorityEngine(): PriorityEngine {
  if (!defaultEngine) {
    defaultEngine = new PriorityEngine();
  }
  return defaultEngine;
}

export function resetPriorityEngineForTests(engine?: PriorityEngine): void {
  defaultEngine = engine ?? new PriorityEngine();
}

export function runPriorityShadowPipeline(
  input: Omit<PriorityEngineInput, 'phase'> & { phases?: ('AUTO_PROMOTIONS' | 'COUPONS')[] }
): { auto: PriorityResult; coupon?: PriorityResult } {
  const engine = getPriorityEngine();
  const auto = engine.prioritize({ ...input, phase: 'AUTO_PROMOTIONS' });
  const couponBenefits = filterBenefitsForPhase(input.eligibleBenefits, 'COUPONS');
  if (!couponBenefits.length) {
    return { auto };
  }
  const coupon = engine.prioritize({
    ...input,
    phase: 'COUPONS',
    runningAmount: input.runningAmount,
  });
  return { auto, coupon };
}
