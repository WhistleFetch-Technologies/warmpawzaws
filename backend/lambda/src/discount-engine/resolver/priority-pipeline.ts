import { DiscountTrigger } from '../enums/discount-trigger';
import { getPriorityEngine } from '../priority/priority-engine';
import type { EligibleBenefit, PriorityResult } from '../priority/priority-types';
import { getPolicyValidationEngine } from '../policy/policy-validation-engine';
import { getPriorityMode, isPriorityEnabled, type PriorityMode } from '../policy/priority-mode';
import { loadRuntimePolicy } from '../policy/runtime-policy-loader';
import type { ValidationResult } from '../policy/validation-result';
import type { DiscountContext } from '../models/discount-context';
import type { CandidateBenefitOutcome } from './types';

export interface PriorityPipelineResult {
  mode: PriorityMode;
  success: boolean;
  fallbackReason?: 'POLICY_VALIDATION_FAILED' | 'PRIORITY_ENGINE_FAILED' | 'PRIORITY_DISABLED';
  policyFingerprint?: string;
  publishId?: string;
  validation?: ValidationResult;
  autoPhase?: PriorityResult;
  couponPhase?: PriorityResult;
  mergedSelected: EligibleBenefit[];
  executionTimeMs: number;
  errorMessage?: string;
}

export function benefitOutcomesToEligible(
  outcomes: CandidateBenefitOutcome[]
): EligibleBenefit[] {
  return outcomes.map((o) => ({
    candidate: o.candidate,
    discountAmount: o.discountAmount,
    benefitType: o.benefit.appliedBenefit,
  }));
}

export function mergePrioritySelection(
  autoPhase: PriorityResult,
  couponPhase?: PriorityResult
): EligibleBenefit[] {
  return [...autoPhase.selectedCandidates, ...(couponPhase?.selectedCandidates ?? [])];
}

/**
 * Runs the Priority Engine pipeline (auto + optional coupon phase).
 * Never throws — returns `success: false` with fallbackReason on failure.
 */
export function runPriorityPipeline(
  context: DiscountContext,
  benefitResults: CandidateBenefitOutcome[]
): PriorityPipelineResult {
  const started = Date.now();
  const mode = getPriorityMode();

  if (!isPriorityEnabled()) {
    return {
      mode,
      success: false,
      fallbackReason: 'PRIORITY_DISABLED',
      mergedSelected: [],
      executionTimeMs: Date.now() - started,
    };
  }

  try {
    const runtimePolicy = loadRuntimePolicy(context.domain);
    const validation = getPolicyValidationEngine().validate(runtimePolicy);

    if (!validation.isPublishable) {
      return {
        mode,
        success: false,
        fallbackReason: 'POLICY_VALIDATION_FAILED',
        policyFingerprint: runtimePolicy.policyFingerprint,
        publishId: runtimePolicy.publishId,
        validation,
        mergedSelected: [],
        executionTimeMs: Date.now() - started,
      };
    }

    const eligibleBenefits = benefitOutcomesToEligible(benefitResults);
    const engine = getPriorityEngine();

    const autoPhase = engine.prioritize({
      eligibleBenefits,
      context,
      priorityConfiguration: runtimePolicy.priority,
      limitConfiguration: runtimePolicy.limits,
      runtimePolicy,
      policyFingerprint: runtimePolicy.policyFingerprint,
      phase: 'AUTO_PROMOTIONS',
    });

    let couponPhase: PriorityResult | undefined;
    const exclusiveSelected = autoPhase.selectedCandidates.some((b) => b.candidate.exclusive);
    const skipCouponPhase =
      runtimePolicy.stack.global.exclusiveSkipsCouponPhase && exclusiveSelected;
    const couponEligible = eligibleBenefits.filter(
      (b) => b.candidate.trigger === DiscountTrigger.CODE
    );

    if (!skipCouponPhase && couponEligible.length > 0) {
      const runningAmount = Math.max(
        0,
        context.amount - autoPhase.selectedCandidates.reduce((s, c) => s + c.discountAmount, 0)
      );
      couponPhase = engine.prioritize({
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

    return {
      mode,
      success: true,
      policyFingerprint: runtimePolicy.policyFingerprint,
      publishId: runtimePolicy.publishId,
      validation,
      autoPhase,
      couponPhase,
      mergedSelected: mergePrioritySelection(autoPhase, couponPhase),
      executionTimeMs: Date.now() - started,
    };
  } catch (err) {
    return {
      mode,
      success: false,
      fallbackReason: 'PRIORITY_ENGINE_FAILED',
      mergedSelected: [],
      executionTimeMs: Date.now() - started,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

export function logPriorityPipelineDiagnostics(
  label: string,
  pipeline: PriorityPipelineResult | null | undefined
): void {
  if (!pipeline) return;

  const logLabel =
    pipeline.mode === 'SHADOW'
      ? '[discount-priority] shadow complete'
      : '[discount-priority] pipeline complete';

  console.info(logLabel, {
    label,
    priorityMode: pipeline.mode,
    success: pipeline.success,
    fallbackReason: pipeline.fallbackReason,
    policyFingerprint: pipeline.policyFingerprint,
    validationErrors: pipeline.validation?.errors.length ?? 0,
    validationWarnings: pipeline.validation?.warnings.length ?? 0,
    autoOrdered: pipeline.autoPhase?.orderedCandidateList.length ?? 0,
    autoSelected: pipeline.autoPhase?.selectedCandidates.length ?? 0,
    autoRejectedByLimit: pipeline.autoPhase?.rejectedByLimit.length ?? 0,
    couponOrdered: pipeline.couponPhase?.orderedCandidateList.length ?? 0,
    couponSelected: pipeline.couponPhase?.selectedCandidates.length ?? 0,
    mergedSelected: pipeline.mergedSelected.length,
    exclusiveFlags: pipeline.autoPhase?.exclusiveCandidates.length ?? 0,
    strategy: pipeline.autoPhase?.strategy,
    executionTimeMs: pipeline.executionTimeMs,
    errorMessage: pipeline.errorMessage,
  });
}
