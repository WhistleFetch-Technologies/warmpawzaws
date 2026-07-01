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
import { getCandidateRepository, type DefaultCandidateRepository } from './candidate-repository';
import {
  discountContextToBenefitRuntime,
  discountContextToRuleRuntime,
} from './context-runtime';
import { prepareUsageEntries } from './usage-preparation';
import type {
  CandidateBenefitOutcome,
  CandidateRuleOutcome,
  ResolverResult,
  UnifiedDiscountResolver,
} from './types';
import type { EligibilityResult } from '../rules/types';

const RESOLVER_VERSION = 'phase-4.0';

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

    const usagePrepared = prepareUsageEntries(benefitResults);
    const pipelineTimeMs = Date.now() - started;
    const totalSavings = benefitResults.reduce((s, o) => s + o.discountAmount, 0);

    const applied: AppliedDiscount[] = benefitResults.map((o, idx) => ({
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

    const benefits: DiscountBenefitLine[] = benefitResults.map((o) => ({
      type: o.benefit.appliedBenefit,
      amount: o.discountAmount,
      description: o.candidate.name,
    }));

    const base = emptyDiscountEngineResult(context.amount);

    return {
      ...base,
      totalSavings,
      finalAmount: Math.max(0, context.amount - totalSavings),
      applied,
      benefits,
      warnings: [],
      eligibleCandidates,
      rejectedCandidates,
      appliedCandidates: [...eligibleCandidates],
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
