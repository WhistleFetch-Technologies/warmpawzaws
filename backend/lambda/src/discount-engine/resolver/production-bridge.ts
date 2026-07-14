import type { DiscountContext } from '../models/discount-context';
import type { ResolverResult } from './types';
import { getUnifiedDiscountResolver } from './unified-discount-resolver';
import { logPriorityPipelineDiagnostics } from './priority-pipeline';
import {
  getResolverMode,
  isResolverAuthoritative,
  isResolverEnabled,
} from '../policy/resolver-mode';
import type { PriorityDiagnostics, SettlementDiagnostics, StackDiagnostics } from './types';
import { isResolverResultAuthoritativeUsable } from './resolver-result-mappers';

export type ProductionFallbackLog = {
  label: string;
  reason: string;
  legacyUsed: true;
  resolverVersion?: string;
  durationMs: number;
  domain?: string;
  trigger?: string;
};

export type ProductionResolutionLog = {
  label: string;
  source: 'v2' | 'legacy';
  resolverVersion?: string;
  durationMs: number;
  totalSavings?: number;
};

const FALLBACK_LOG_SAMPLE_RATE = 1;

function shouldLogFallback(): boolean {
  if (FALLBACK_LOG_SAMPLE_RATE >= 1) return true;
  return Math.random() < FALLBACK_LOG_SAMPLE_RATE;
}

export function logProductionFallback(entry: ProductionFallbackLog): void {
  if (!shouldLogFallback()) return;
  console.warn('[discount-resolver] production fallback', entry);
}

export function logProductionResolution(entry: ProductionResolutionLog): void {
  console.info('[discount-resolver] production resolution', entry);
}

/**
 * Runs the unified resolver pipeline.
 * @deprecated Prefer resolveWithProductionMode for HTTP paths — this remains the low-level entry.
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
  const settlement = result.metadata?.settlement as SettlementDiagnostics | undefined;
  console.info('[discount-resolver] pipeline complete', {
    label,
    resolverMode: getResolverMode(),
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
    settlementMode: settlement?.settlementMode,
    settlementAuthoritative: settlement?.authoritative,
    vendorReceivable: settlement?.vendorReceivable,
    platformCost: settlement?.platformCost,
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

/**
 * Fire-and-forget resolver invocation alongside legacy production path.
 * Skipped when RESOLVER_MODE=OFF; used for SHADOW diagnostics and non-migrated legacy call sites.
 */
export function invokeResolverAlongsideLegacy(
  label: string,
  context: DiscountContext
): void {
  if (!isResolverEnabled()) return;
  void runResolverPipeline(context).then((result) => logResolverDiagnostics(label, result));
}

export type ProductionResolveOptions<TLegacy> = {
  label: string;
  context: DiscountContext;
  legacy: () => Promise<TLegacy> | TLegacy;
  mapResolverToLegacy: (result: ResolverResult) => TLegacy;
  /** Optional shadow compare when mode=SHADOW */
  compareShadow?: (legacy: TLegacy, resolver: ResolverResult) => void;
};

/**
 * Phase 8B production entry — switches between legacy, shadow, and authoritative resolver.
 * Legacy implementation is always retained as fallback.
 */
export async function resolveWithProductionMode<TLegacy>(
  options: ProductionResolveOptions<TLegacy>
): Promise<{ value: TLegacy; source: 'legacy' | 'v2'; resolverResult?: ResolverResult }> {
  const mode = getResolverMode();
  const started = Date.now();

  if (mode === 'OFF') {
    const value = await Promise.resolve(options.legacy());
    return { value, source: 'legacy' };
  }

  if (mode === 'SHADOW') {
    const legacyValue = await Promise.resolve(options.legacy());
    void runResolverPipeline(options.context).then((result) => {
      logResolverDiagnostics(`${options.label}-shadow`, result);
      if (result && options.compareShadow) {
        try {
          options.compareShadow(legacyValue, result);
        } catch (err) {
          console.warn('[discount-resolver] shadow compare failed', {
            label: options.label,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    });
    return { value: legacyValue, source: 'legacy' };
  }

  // AUTHORITATIVE — try V2, fall back to legacy on any failure
  try {
    const resolverResult = await runResolverPipeline(options.context);
    if (isResolverResultAuthoritativeUsable(resolverResult)) {
      const mapped = options.mapResolverToLegacy(resolverResult);
      logProductionResolution({
        label: options.label,
        source: 'v2',
        resolverVersion: resolverResult.resolverVersion,
        durationMs: Date.now() - started,
        totalSavings: resolverResult.totalSavings,
      });
      return { value: mapped, source: 'v2', resolverResult };
    }
    throw new Error('resolver_result_unusable');
  } catch (err) {
    logProductionFallback({
      label: options.label,
      reason: err instanceof Error ? err.message : String(err),
      legacyUsed: true,
      durationMs: Date.now() - started,
      domain: options.context.domain,
      trigger: options.context.trigger,
    });
    const legacyValue = await Promise.resolve(options.legacy());
    return { value: legacyValue, source: 'legacy' };
  }
}

/** Whether HTTP handlers should prefer V2 when resolveWithProductionMode is not yet wired. */
export function shouldUseResolverAtHttpLayer(): boolean {
  return isResolverAuthoritative();
}
