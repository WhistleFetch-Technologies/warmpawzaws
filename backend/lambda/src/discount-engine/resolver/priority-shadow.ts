/**
 * @deprecated Use priority-pipeline.ts — kept for Phase 5A test compatibility.
 */
import type { PriorityPipelineResult } from './priority-pipeline';
import {
  benefitOutcomesToEligible,
  logPriorityPipelineDiagnostics,
  runPriorityPipeline,
} from './priority-pipeline';
import type { ValidationResult } from '../policy/validation-result';
import type { PriorityResult } from '../priority/priority-types';

export { benefitOutcomesToEligible };

export interface PriorityShadowDiagnostics {
  policyFingerprint: string;
  publishId?: string;
  validation: ValidationResult;
  autoPhase: PriorityResult;
  couponPhase?: PriorityResult;
  shadowEnabled: boolean;
}

export function runPriorityShadow(
  context: import('../models/discount-context').DiscountContext,
  benefitResults: import('./types').CandidateBenefitOutcome[]
): PriorityShadowDiagnostics | null {
  const pipeline = runPriorityPipeline(context, benefitResults);
  if (pipeline.mode === 'OFF' || !pipeline.autoPhase || !pipeline.validation) {
    return null;
  }
  return {
    policyFingerprint: pipeline.policyFingerprint!,
    publishId: pipeline.publishId,
    validation: pipeline.validation,
    autoPhase: pipeline.autoPhase,
    couponPhase: pipeline.couponPhase,
    shadowEnabled: pipeline.mode === 'SHADOW',
  };
}

export function logPriorityShadowDiagnostics(
  label: string,
  diagnostics: PriorityShadowDiagnostics | PriorityPipelineResult | null
): void {
  if (!diagnostics) return;
  if ('mode' in diagnostics) {
    logPriorityPipelineDiagnostics(label, diagnostics);
    return;
  }
  logPriorityPipelineDiagnostics(label, {
    mode: 'SHADOW',
    success: true,
    policyFingerprint: diagnostics.policyFingerprint,
    publishId: diagnostics.publishId,
    validation: diagnostics.validation,
    autoPhase: diagnostics.autoPhase,
    couponPhase: diagnostics.couponPhase,
    mergedSelected: [
      ...diagnostics.autoPhase.selectedCandidates,
      ...(diagnostics.couponPhase?.selectedCandidates ?? []),
    ],
    executionTimeMs: diagnostics.autoPhase.executionTimeMs,
  });
}
