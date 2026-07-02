import type { DiscountContext } from '../models/discount-context';
import type { ResolverResult } from './types';
import { getUnifiedDiscountResolver } from './unified-discount-resolver';
import { logPriorityPipelineDiagnostics } from './priority-pipeline';
import type { PriorityDiagnostics, StackDiagnostics } from './types';

/**
 * Runs the unified resolver pipeline for diagnostics.
 * Does not alter caller return values — production behaviour preserved.
 */
export async function runResolverPipeline(
  context: DiscountContext
): Promise<ResolverResult | null> {
  try {
    return await getUnifiedDiscountResolver().resolve(context);
  } catch (err) {
    console.warn('[discount-resolver] pipeline failed', {
      domain: context.domain,
      trigger: context.trigger,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export function logResolverDiagnostics(
  label: string,
  result: ResolverResult | null
): void {
  if (!result) return;
  const priority = result.metadata?.priority as PriorityDiagnostics | undefined;
  const stack = result.metadata?.stack as StackDiagnostics | undefined;
  console.info('[discount-resolver] pipeline complete', {
    label,
    candidateCount: result.metadata?.candidateCount,
    eligibleCount: result.metadata?.eligibleCount,
    rejectedCount: result.metadata?.rejectedCount,
    pipelineTimeMs: result.executionTimeMs,
    providerBreakdown: result.metadata?.providerBreakdown,
    resolverVersion: result.resolverVersion,
    priorityMode: priority?.priorityMode,
    priorityAuthoritative: priority?.authoritative,
    selectedCount: priority?.selectedCount,
    policyFingerprint: priority?.policyFingerprint,
    stackMode: stack?.stackMode,
    stackAuthoritative: stack?.authoritative,
    stackAppliedCount: stack?.appliedCount,
    stackRejectedCount: stack?.rejectedCount,
  });
  if (priority) {
    logPriorityPipelineDiagnostics(label, {
      mode: priority.priorityMode,
      success: !priority.fallbackReason,
      fallbackReason: priority.fallbackReason as
        | import('./priority-pipeline').PriorityPipelineResult['fallbackReason']
        | undefined,
      policyFingerprint: priority.policyFingerprint,
      validation: priority.validation,
      autoPhase: priority.autoPhase,
      couponPhase: priority.couponPhase,
      mergedSelected: [
        ...(priority.autoPhase?.selectedCandidates ?? []),
        ...(priority.couponPhase?.selectedCandidates ?? []),
      ],
      executionTimeMs: priority.executionTimeMs,
    });
  }
}

/** Fire-and-forget resolver invocation alongside legacy production path. */
export function invokeResolverAlongsideLegacy(
  label: string,
  context: DiscountContext
): void {
  void runResolverPipeline(context).then((result) => logResolverDiagnostics(label, result));
}
