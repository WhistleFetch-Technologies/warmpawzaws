import { DiscountTrigger } from '../enums/discount-trigger';
import type { CandidateBenefitOutcome } from './types';
import type { DiscountContext } from '../models/discount-context';
import type { EligibleBenefit } from '../priority/priority-types';
import type { PriorityResult } from '../priority/priority-types';
import { getPriorityEngine } from '../priority/priority-engine';
import { getPolicyValidationEngine } from '../policy/policy-validation-engine';
import {
  isPriorityShadowEnabled,
  loadRuntimePolicy,
} from '../policy/runtime-policy-loader';
import type { ValidationResult } from '../policy/validation-result';

export interface PriorityShadowDiagnostics {
  policyFingerprint: string;
  publishId?: string;
  validation: ValidationResult;
  autoPhase: PriorityResult;
  couponPhase?: PriorityResult;
  shadowEnabled: boolean;
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

/**
 * Shadow-only priority pipeline — does not alter resolver monetary output.
 */
export function runPriorityShadow(
  context: DiscountContext,
  benefitResults: CandidateBenefitOutcome[]
): PriorityShadowDiagnostics | null {
  if (!isPriorityShadowEnabled()) return null;

  const runtimePolicy = loadRuntimePolicy(context.domain);
  const validation = getPolicyValidationEngine().validate(runtimePolicy);
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
  const couponEligible = eligibleBenefits.filter(
    (b) => b.candidate.trigger === DiscountTrigger.CODE
  );
  if (couponEligible.length > 0) {
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
    policyFingerprint: runtimePolicy.policyFingerprint,
    publishId: runtimePolicy.publishId,
    validation,
    autoPhase,
    couponPhase,
    shadowEnabled: true,
  };
}

export function logPriorityShadowDiagnostics(
  label: string,
  diagnostics: PriorityShadowDiagnostics | null
): void {
  if (!diagnostics) return;
  const { validation, autoPhase, couponPhase } = diagnostics;
  console.info('[discount-priority] shadow complete', {
    label,
    policyFingerprint: diagnostics.policyFingerprint,
    validationErrors: validation.errors.length,
    validationWarnings: validation.warnings.length,
    autoOrdered: autoPhase.orderedCandidateList.length,
    autoSelected: autoPhase.selectedCandidates.length,
    autoRejectedByLimit: autoPhase.rejectedByLimit.length,
    couponOrdered: couponPhase?.orderedCandidateList.length ?? 0,
    couponSelected: couponPhase?.selectedCandidates.length ?? 0,
    exclusiveFlags: autoPhase.exclusiveCandidates.length,
    strategy: autoPhase.strategy,
  });
}
