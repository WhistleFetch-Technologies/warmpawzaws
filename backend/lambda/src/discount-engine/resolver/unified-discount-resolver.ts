import { DiscountDomain } from '../enums/discount-domain';
import { DiscountSource } from '../enums/discount-source';
import { DiscountTrigger } from '../enums/discount-trigger';
import { evaluateCandidateBenefit } from '../candidates/bridges/candidate-to-benefit-context';
import {
  candidateToPlatformInlineRuleContext,
  candidateToPlatformMatchRuleContext,
} from '../candidates/bridges/candidate-to-rule-context';
import { evaluateCandidateEligibility, evaluateRules } from '../rules/engine';
import type { DiscountCandidate } from '../candidates/types';
import type { DiscountContext } from '../models/discount-context';
import type { AppliedDiscount, DiscountBenefitLine } from '../models/discount-result';
import { emptyDiscountEngineResult } from '../models/discount-result';
import {
  isPriorityAuthoritative,
  loadRuntimePolicy,
} from '../policy/runtime-policy-loader';
import { getCandidateRepository, type DefaultCandidateRepository } from './candidate-repository';
import {
  discountContextToBenefitRuntime,
  discountContextToRuleRuntime,
} from './context-runtime';
import {
  applyLegacyStackToSelected,
  mapSelectedToBenefitOutcomes,
} from './legacy-stack-adapter';
import { runPriorityPipeline } from './priority-pipeline';
import { prepareUsageEntries } from './usage-preparation';
import {
  getStackEngine,
  getStackMode,
  isStackAuthoritative,
  isStackEnabled,
  mapStackAppliedToBenefitOutcomes,
} from '../stack';
import type { StackDecision } from '../stack/types';
import {
  getSettlementEngine,
  getSettlementMode,
  isSettlementAuthoritative,
  isSettlementEnabled,
  toDiscountSettlementPreview,
} from '../settlement';
import type { SettlementDecision } from '../settlement/types';
import type {
  CandidateBenefitOutcome,
  CandidateRuleOutcome,
  PriorityDiagnostics,
  ResolverResult,
  SettlementDiagnostics,
  StackDiagnostics,
  UnifiedDiscountResolver,
} from './types';
import type { EligibilityResult } from '../rules/types';

const RESOLVER_VERSION = 'phase-7.0';
const PRIORITY_VERSION = '1.0.0';

export class DefaultUnifiedDiscountResolver implements UnifiedDiscountResolver {
  constructor(
    private readonly repository: DefaultCandidateRepository = getCandidateRepository()
  ) {}

  async resolve(context: DiscountContext): Promise<ResolverResult> {
    const started = Date.now();
    const { candidates, providerBreakdown } = await this.repository.loadCandidates(context);
    const ruleRuntime = discountContextToRuleRuntime(context);
    const benefitRuntime = discountContextToBenefitRuntime(context);

    const ruleResults: CandidateRuleOutcome[] = [];
    const eligibleCandidates = [];
    const rejectedCandidates = [];

    for (const candidate of candidates) {
      const eligibility = this.evaluateRulesForCandidate(candidate, context, ruleRuntime);
      ruleResults.push({ candidate, eligibility });
      if (eligibility.eligible) {
        eligibleCandidates.push(candidate);
      } else {
        rejectedCandidates.push(candidate);
      }
    }

    const benefitResults: CandidateBenefitOutcome[] = [];
    for (const candidate of eligibleCandidates) {
      const benefit = evaluateCandidateBenefit(candidate, benefitRuntime);
      benefitResults.push({
        candidate,
        benefit,
        discountAmount: benefit.discountAmount,
      });
    }

    const priorityPipeline = runPriorityPipeline(context, benefitResults);
    let stackBenefitResults = benefitResults;
    let appliedCandidates: DiscountCandidate[] = [...eligibleCandidates];
    let authoritative = false;
    let stackAuthoritative = false;
    let fallbackReason: string | undefined;
    let stackDecision: StackDecision | undefined;
    const stackMode = getStackMode();

    if (isPriorityAuthoritative() && priorityPipeline.success) {
      const runtimePolicy = loadRuntimePolicy(context.domain);
      const legacyStacked = applyLegacyStackToSelected(
        priorityPipeline.mergedSelected,
        runtimePolicy,
        context
      );
      const legacyMapped = mapSelectedToBenefitOutcomes(legacyStacked, benefitResults);

      if (isStackEnabled()) {
        stackDecision = getStackEngine().stack({
          context,
          selectedCandidates: priorityPipeline.mergedSelected,
          benefitResults,
          runtimePolicy,
          policyFingerprint: runtimePolicy.policyFingerprint,
        });
      }

      if (isStackAuthoritative() && stackDecision) {
        const mapped = mapStackAppliedToBenefitOutcomes(
          stackDecision.applied,
          benefitResults
        );
        if (mapped.length > 0 || benefitResults.length === 0) {
          stackBenefitResults = mapped;
          appliedCandidates = mapped.map((o) => o.candidate);
          authoritative = true;
          stackAuthoritative = true;
        }
      } else if (legacyMapped.length > 0 || benefitResults.length === 0) {
        stackBenefitResults = legacyMapped;
        appliedCandidates = legacyMapped.map((o) => o.candidate);
        authoritative = true;
      }
    } else if (isPriorityAuthoritative() && !priorityPipeline.success) {
      fallbackReason = priorityPipeline.fallbackReason;
      console.warn('[discount-priority] authoritative fallback to legacy eligible set', {
        domain: context.domain,
        trigger: context.trigger,
        fallbackReason,
        errorMessage: priorityPipeline.errorMessage,
      });
    }

    const usagePrepared = prepareUsageEntries(stackBenefitResults);
    const pipelineTimeMs = Date.now() - started;
    const totalSavings = stackAuthoritative && stackDecision
      ? stackDecision.totalSavings
      : stackBenefitResults.reduce((s, o) => s + o.discountAmount, 0);
    const finalAmount = stackAuthoritative && stackDecision
      ? stackDecision.runningAmount
      : Math.max(0, context.amount - totalSavings);

    const applied: AppliedDiscount[] = stackBenefitResults.map((o, idx) => ({
      id: o.candidate.id,
      name: o.candidate.name,
      owner: o.candidate.owner,
      trigger: o.candidate.trigger,
      funding: o.candidate.funding,
      discountAmount: o.discountAmount,
      benefitType: o.benefit.appliedBenefit,
      order: idx + 1,
      legacySource: mapLegacySource(o.candidate.source),
      metadata: { source: o.candidate.source },
    }));

    const benefits: DiscountBenefitLine[] = stackBenefitResults.map((o) => ({
      type: o.benefit.appliedBenefit,
      amount: o.discountAmount,
      description: o.candidate.name,
    }));

    const rejectedByLimit =
      (priorityPipeline.autoPhase?.rejectedByLimit.length ?? 0) +
      (priorityPipeline.couponPhase?.rejectedByLimit.length ?? 0);

    const priorityDiagnostics: PriorityDiagnostics = {
      priorityMode: priorityPipeline.mode,
      priorityVersion: PRIORITY_VERSION,
      policyFingerprint: priorityPipeline.policyFingerprint,
      strategy: priorityPipeline.autoPhase?.strategy,
      selectedCount: authoritative
        ? appliedCandidates.length
        : priorityPipeline.mergedSelected.length,
      rejectedCount: rejectedByLimit,
      executionTimeMs: priorityPipeline.executionTimeMs,
      validationWarnings: priorityPipeline.validation?.warnings.length ?? 0,
      validationErrors: priorityPipeline.validation?.errors.length ?? 0,
      authoritative,
      fallbackReason,
      autoPhase: priorityPipeline.autoPhase,
      couponPhase: priorityPipeline.couponPhase,
      validation: priorityPipeline.validation,
    };

    const stackDiagnostics: StackDiagnostics = {
      stackMode,
      stackVersion: stackDecision?.audit.stackVersion ?? 'legacy-adapter',
      policyFingerprint: stackDecision?.audit.policyFingerprint ?? priorityPipeline.policyFingerprint,
      authoritative: stackAuthoritative,
      appliedCount: stackDecision?.applied.length ?? (authoritative ? appliedCandidates.length : 0),
      rejectedCount: stackDecision?.rejected.length ?? 0,
      executionTimeMs: stackDecision?.audit.executionTimeMs ?? 0,
      totalSavings: stackAuthoritative && stackDecision ? stackDecision.totalSavings : totalSavings,
      finalAmount: stackAuthoritative && stackDecision ? stackDecision.runningAmount : finalAmount,
      audit: stackDecision?.audit,
    };

    let settlementDecision: SettlementDecision | undefined;
    let settlementPreview = undefined;
    const settlementMode = getSettlementMode();
    let settlementAuthoritative = false;

    if (isSettlementEnabled() && applied.length >= 0) {
      const runtimePolicy =
        isPriorityAuthoritative() && priorityPipeline.success
          ? loadRuntimePolicy(context.domain)
          : loadRuntimePolicy(context.domain);

      settlementDecision = getSettlementEngine().settle({
        context,
        applied,
        originalAmount: context.amount,
        customerPayable: finalAmount,
        totalSavings,
        runtimePolicy,
        policyFingerprint: runtimePolicy.policyFingerprint,
      });
      settlementPreview = toDiscountSettlementPreview(settlementDecision.preview);
      settlementAuthoritative = isSettlementAuthoritative();
    }

    const settlementDiagnostics: SettlementDiagnostics = {
      settlementMode,
      settlementVersion: settlementDecision?.audit.settlementVersion ?? 'none',
      policyFingerprint: settlementDecision?.audit.policyFingerprint,
      authoritative: settlementAuthoritative,
      executionTimeMs: settlementDecision?.audit.executionTimeMs ?? 0,
      customerPayable: settlementDecision?.preview.customerPayable ?? finalAmount,
      vendorReceivable: settlementDecision?.preview.vendorReceivable ?? context.amount,
      platformCost: settlementDecision?.preview.platformCost ?? 0,
      vendorCost: settlementDecision?.preview.vendorCost ?? 0,
      netSettlement: settlementDecision?.preview.netSettlement ?? finalAmount,
      audit: settlementDecision?.audit,
    };

    const base = emptyDiscountEngineResult(context.amount);

    return {
      ...base,
      totalSavings,
      finalAmount,
      applied,
      benefits,
      settlement: settlementPreview,
      warnings: [],
      eligibleCandidates,
      rejectedCandidates,
      appliedCandidates,
      benefitResults,
      ruleResults,
      executionTimeMs: pipelineTimeMs,
      resolverVersion: RESOLVER_VERSION,
      metadata: {
        pipelineTimeMs,
        candidateCount: candidates.length,
        eligibleCount: eligibleCandidates.length,
        rejectedCount: rejectedCandidates.length,
        providerBreakdown,
        usagePrepared,
        domain: context.domain,
        trigger: context.trigger,
        priority: priorityDiagnostics,
        stack: stackDiagnostics,
        settlement: settlementDiagnostics,
      },
    };
  }

  private evaluateRulesForCandidate(
    candidate: DiscountCandidate,
    context: DiscountContext,
    ruleRuntime: ReturnType<typeof discountContextToRuleRuntime>
  ): EligibilityResult {
    if (
      candidate.source === DiscountSource.PLATFORM_PROMOTION &&
      ruleRuntime.platformMatchParams &&
      context.domain === DiscountDomain.SERVICE &&
      context.trigger === DiscountTrigger.AUTO
    ) {
      return evaluateRules(
        candidateToPlatformMatchRuleContext(candidate, {
          ...ruleRuntime,
          platformMatchParams: ruleRuntime.platformMatchParams,
        })
      );
    }
    if (
      candidate.source === DiscountSource.PLATFORM_PROMOTION &&
      context.trigger === DiscountTrigger.CODE
    ) {
      return evaluateRules(candidateToPlatformInlineRuleContext(candidate, ruleRuntime));
    }
    return evaluateCandidateEligibility(candidate, ruleRuntime);
  }
}

function mapLegacySource(
  source: DiscountSource
): 'vendor' | 'platform' | 'coupon' | undefined {
  if (source === DiscountSource.PLATFORM_COUPON) return 'coupon';
  if (source === DiscountSource.PLATFORM_PROMOTION) return 'platform';
  if (source === DiscountSource.VENDOR_PROMOTION || source === DiscountSource.VENDOR_COUPON) {
    return 'vendor';
  }
  return undefined;
}

let defaultResolver: DefaultUnifiedDiscountResolver | null = null;

export function getUnifiedDiscountResolver(): DefaultUnifiedDiscountResolver {
  if (!defaultResolver) {
    defaultResolver = new DefaultUnifiedDiscountResolver();
  }
  return defaultResolver;
}

export function resetUnifiedDiscountResolverForTests(): void {
  defaultResolver = new DefaultUnifiedDiscountResolver();
}
