import type { LimitConfiguration } from '../config/types';
import type { DiscountContext } from '../models/discount-context';
import type { RuntimePolicy } from '../policy/runtime-policy';
import type { EligibleBenefit } from '../priority/priority-types';
import { discountContextToBenefitRuntime } from '../resolver/context-runtime';
import { getConflictResolver } from './conflict-resolver';
import { resolveStackPolicy } from './stack-policy';
import {
  classifyStackPhase,
  sortByStackOrder,
  splitByPhase,
  type StackPhase,
} from './stack-registry';
import {
  applySequentialDiscount,
  recomputeBenefitOnRunningAmount,
} from './sequential-rebase-calculator';
import { getStackMode } from './stack-mode';
import type {
  StackAppliedStep,
  StackAudit,
  StackDecision,
  StackEngineInput,
  StackRejectedCandidate,
  StackRejectionReason,
} from './types';

const STACK_ENGINE_VERSION = '1.0.0';

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function checkCumulativeLimits(
  originalAmount: number,
  runningAmount: number,
  appliedCount: number,
  limits: LimitConfiguration['global'],
  candidateDiscount: number
): { allowed: boolean; reason?: StackRejectionReason; detail?: string } {
  const totalSavings = originalAmount - runningAmount + candidateDiscount;
  const afterDiscount = runningAmount - candidateDiscount;

  if (limits.maxTotalDiscounts > 0 && appliedCount >= limits.maxTotalDiscounts) {
    return {
      allowed: false,
      reason: 'LIMIT',
      detail: `maxTotalDiscounts (${limits.maxTotalDiscounts}) reached`,
    };
  }

  if (limits.maxTotalDiscountPercent > 0 && originalAmount > 0) {
    const pct = (totalSavings / originalAmount) * 100;
    if (pct > limits.maxTotalDiscountPercent + 0.001) {
      return {
        allowed: false,
        reason: 'LIMIT',
        detail: `maxTotalDiscountPercent (${limits.maxTotalDiscountPercent}%) exceeded`,
      };
    }
  }

  if (limits.minPayableAmount > 0 && afterDiscount < limits.minPayableAmount - 0.001) {
    return {
      allowed: false,
      reason: 'MIN_PAYABLE',
      detail: `minPayableAmount (${limits.minPayableAmount}) violated`,
    };
  }

  return { allowed: true };
}

function handleExclusiveAuto(
  autoCandidates: EligibleBenefit[],
  policy: ReturnType<typeof resolveStackPolicy>
): { exclusiveOnly: EligibleBenefit[] | null; rejected: StackRejectedCandidate[] } {
  const rejected: StackRejectedCandidate[] = [];
  const exclusives = autoCandidates.filter((b) => b.candidate.exclusive);
  if (exclusives.length === 0) return { exclusiveOnly: null, rejected };

  if (!policy.exclusiveTerminatesAll) return { exclusiveOnly: null, rejected };

  const winner = sortByStackOrder(exclusives, policy.stackOrder)[0]!;
  for (const c of autoCandidates) {
    if (c.candidate.id !== winner.candidate.id) {
      rejected.push({
        candidateId: c.candidate.id,
        source: String(c.candidate.source),
        name: c.candidate.name,
        reason: 'EXCLUSIVE',
        detail: `Exclusive promotion ${winner.candidate.id} terminates stack`,
        phase: 'AUTO_PROMOTIONS',
        conflictWith: winner.candidate.id,
      });
    }
  }
  return { exclusiveOnly: [winner], rejected };
}

function processPhase(
  candidates: EligibleBenefit[],
  phase: StackPhase,
  context: DiscountContext,
  runtimePolicy: RuntimePolicy,
  runningAmount: number,
  appliedSoFar: EligibleBenefit[],
  appliedSteps: StackAppliedStep[],
  rejected: StackRejectedCandidate[],
  startOrder: number
): { runningAmount: number; applied: EligibleBenefit[]; nextOrder: number } {
  const policy = resolveStackPolicy(context.domain, runtimePolicy.stack);
  const sorted = sortByStackOrder(candidates, policy.stackOrder);
  const resolver = getConflictResolver();
  const benefitRuntime = discountContextToBenefitRuntime(context);
  const limits = runtimePolicy.limits.global;
  const applied: EligibleBenefit[] = [];
  let order = startOrder;
  let running = runningAmount;

  for (const candidate of sorted) {
    const conflict = resolver.canApply(
      candidate,
      [...appliedSoFar, ...applied],
      context,
      policy,
      runtimePolicy.funding,
      phase
    );

    if (!conflict.allowed) {
      rejected.push({
        candidateId: candidate.candidate.id,
        source: String(candidate.candidate.source),
        name: candidate.candidate.name,
        reason: conflict.reason ?? 'CONFLICT',
        reasonCode: conflict.reasonCode,
        ruleId: conflict.ruleId,
        conflictWith: conflict.conflictWith,
        detail: conflict.detail ?? 'Rejected by conflict resolver',
        funding: candidate.candidate.funding ? String(candidate.candidate.funding) : undefined,
        phase,
      });
      continue;
    }

    const applicationMode = policy.applicationModeDefault;
    const runningBefore = running;
    let discountAmount = candidate.discountAmount;

    if (applicationMode === 'SEQUENTIAL') {
      discountAmount = recomputeBenefitOnRunningAmount(
        candidate,
        context,
        running,
        benefitRuntime
      );
    }

    const limitCheck = checkCumulativeLimits(
      context.amount,
      running,
      appliedSoFar.length + applied.length,
      limits,
      discountAmount
    );
    if (!limitCheck.allowed) {
      rejected.push({
        candidateId: candidate.candidate.id,
        source: String(candidate.candidate.source),
        name: candidate.candidate.name,
        reason: limitCheck.reason ?? 'LIMIT',
        detail: limitCheck.detail ?? 'Cumulative limit exceeded',
        phase,
      });
      continue;
    }

    const { runningAfter, appliedDiscount } = applySequentialDiscount(running, discountAmount);
    if (appliedDiscount <= 0) {
      rejected.push({
        candidateId: candidate.candidate.id,
        source: String(candidate.candidate.source),
        name: candidate.candidate.name,
        reason: 'LIMIT',
        detail: 'Zero discount on running amount',
        phase,
      });
      continue;
    }

    order += 1;
    const appliedBenefit: EligibleBenefit = {
      ...candidate,
      discountAmount: roundMoney(appliedDiscount),
    };
    applied.push(appliedBenefit);
    running = runningAfter;

    appliedSteps.push({
      candidateId: candidate.candidate.id,
      source: String(candidate.candidate.source),
      name: candidate.candidate.name,
      phase,
      discountAmount: roundMoney(appliedDiscount),
      runningAmountBefore: roundMoney(runningBefore),
      runningAmountAfter: roundMoney(runningAfter),
      applicationMode,
      funding: candidate.candidate.funding ? String(candidate.candidate.funding) : undefined,
      order,
    });
  }

  return { runningAmount: running, applied, nextOrder: order };
}

/**
 * Stack Engine — coexistence, sequential application, cumulative caps.
 * Does not rank, evaluate rules, or settle.
 */
export class DefaultStackEngine {
  stack(input: StackEngineInput): StackDecision {
    const started = Date.now();
    const { context, selectedCandidates, runtimePolicy, policyFingerprint } = input;
    const policy = resolveStackPolicy(context.domain, runtimePolicy.stack);
    const mode = getStackMode();

    const appliedSteps: StackAppliedStep[] = [];
    const rejected: StackRejectedCandidate[] = [];
    const conflicts: StackAudit['conflicts'] = [];

    if (selectedCandidates.length === 0) {
      return this.emptyDecision(context, policyFingerprint, started, mode);
    }

    const { auto, coupons } = splitByPhase(selectedCandidates);

    const exclusiveResult = handleExclusiveAuto(auto, policy);
    rejected.push(...exclusiveResult.rejected);
    const autoToProcess = exclusiveResult.exclusiveOnly ?? auto;

    let runningAmount = context.amount;
    let order = 0;
    let allApplied: EligibleBenefit[] = [];

    const autoResult = processPhase(
      autoToProcess,
      'AUTO_PROMOTIONS',
      context,
      runtimePolicy,
      runningAmount,
      [],
      appliedSteps,
      rejected,
      order
    );
    runningAmount = autoResult.runningAmount;
    allApplied = [...autoResult.applied];
    order = autoResult.nextOrder;

    const skipCoupons =
      policy.exclusiveSkipsCouponPhase &&
      allApplied.some((b) => b.candidate.exclusive);

    if (!skipCoupons && coupons.length > 0) {
      if (!policy.allowCouponWithPromotion && allApplied.length > 0) {
        for (const c of coupons) {
          rejected.push({
            candidateId: c.candidate.id,
            source: String(c.candidate.source),
            name: c.candidate.name,
            reason: 'RULE',
            reasonCode: 'COUPON_WITH_PROMOTION_DISABLED',
            detail: 'allowCouponWithPromotion is false',
            phase: 'COUPONS',
          });
        }
      } else {
        const couponResult = processPhase(
          coupons,
          'COUPONS',
          context,
          runtimePolicy,
          runningAmount,
          allApplied,
          appliedSteps,
          rejected,
          order
        );
        runningAmount = couponResult.runningAmount;
        allApplied = [...allApplied, ...couponResult.applied];
      }
    }

    const totalSavings = roundMoney(context.amount - runningAmount);
    const audit: StackAudit = {
      mode,
      policyFingerprint,
      stackVersion: STACK_ENGINE_VERSION,
      originalAmount: context.amount,
      finalAmount: roundMoney(runningAmount),
      totalSavings,
      appliedSteps,
      rejected,
      conflicts,
      executionTimeMs: Date.now() - started,
    };

    return {
      applied: allApplied,
      rejected,
      audit,
      runningAmount: roundMoney(runningAmount),
      totalSavings,
    };
  }

  private emptyDecision(
    context: DiscountContext,
    policyFingerprint: string,
    started: number,
    mode: ReturnType<typeof getStackMode>
  ): StackDecision {
    const audit: StackAudit = {
      mode,
      policyFingerprint,
      stackVersion: STACK_ENGINE_VERSION,
      originalAmount: context.amount,
      finalAmount: context.amount,
      totalSavings: 0,
      appliedSteps: [],
      rejected: [],
      conflicts: [],
      executionTimeMs: Date.now() - started,
    };
    return {
      applied: [],
      rejected: [],
      audit,
      runningAmount: context.amount,
      totalSavings: 0,
    };
  }
}

let defaultEngine: DefaultStackEngine | null = null;

export function getStackEngine(): DefaultStackEngine {
  if (!defaultEngine) defaultEngine = new DefaultStackEngine();
  return defaultEngine;
}

export function resetStackEngineForTests(): void {
  defaultEngine = new DefaultStackEngine();
}
