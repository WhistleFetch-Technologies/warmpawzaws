import type { DiscountContext } from '../models/discount-context';
import type { ResolverResult } from './types';
import { getUnifiedDiscountResolver } from './unified-discount-resolver';
import { logPriorityShadowDiagnostics } from './priority-shadow';

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
  console.info('[discount-resolver] pipeline complete', {
    label,
    candidateCount: result.metadata?.candidateCount,
    eligibleCount: result.metadata?.eligibleCount,
    rejectedCount: result.metadata?.rejectedCount,
    pipelineTimeMs: result.executionTimeMs,
    providerBreakdown: result.metadata?.providerBreakdown,
    resolverVersion: result.resolverVersion,
  });
  const priorityShadow = result.metadata?.priorityShadow as
    | import('./priority-shadow').PriorityShadowDiagnostics
    | undefined;
  logPriorityShadowDiagnostics(label, priorityShadow ?? null);
}

/** Fire-and-forget resolver invocation alongside legacy production path. */
export function invokeResolverAlongsideLegacy(
  label: string,
  context: DiscountContext
): void {
  void runResolverPipeline(context).then((result) => logResolverDiagnostics(label, result));
}
