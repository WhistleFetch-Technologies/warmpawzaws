/**
 * Policy simulator — uses the same offer-resolution path as production resolver.
 */
import { DiscountDomain } from '../enums/discount-domain';
import { DiscountOwner } from '../enums/discount-owner';
import { DiscountSource } from '../enums/discount-source';
import { DiscountTrigger } from '../enums/discount-trigger';
import { ensureBusinessRules } from '../config/business-rules-mapper';
import type { DiscountPolicyBundle } from '../config/business-rules-mapper';
import { loadRuntimePolicy } from '../policy/runtime-policy-loader';
import type { DiscountContext } from '../models/discount-context';
import { resolveOffers } from './offer-resolution';
import type { CandidateBenefitOutcome } from './types';
import {
  mapResolverResultToUnifiedResponse,
  type UnifiedResolverResponse,
} from './unified-resolver-response';
import { getSettlementEngine } from '../settlement';
import { toDiscountSettlementPreview } from '../settlement/settlement-preview';
import type { AppliedDiscount } from '../models/discount-result';

export interface SimulatorOfferInput {
  offerType: string;
  enabled: boolean;
  discountType: 'PERCENT' | 'FIXED';
  value: number;
  priorityWeight?: number;
  platformCostPercent?: number;
}

const OFFER_SOURCE_MAP: Record<
  string,
  { source: DiscountSource; owner: DiscountOwner; trigger: DiscountTrigger }
> = {
  VENDOR_PROMOTION: {
    source: DiscountSource.VENDOR_PROMOTION,
    owner: DiscountOwner.VENDOR,
    trigger: DiscountTrigger.AUTO,
  },
  PLATFORM_PROMOTION: {
    source: DiscountSource.PLATFORM_PROMOTION,
    owner: DiscountOwner.PLATFORM,
    trigger: DiscountTrigger.AUTO,
  },
  VENDOR_COUPON: {
    source: DiscountSource.VENDOR_COUPON,
    owner: DiscountOwner.VENDOR,
    trigger: DiscountTrigger.CODE,
  },
  PLATFORM_COUPON: {
    source: DiscountSource.PLATFORM_COUPON,
    owner: DiscountOwner.PLATFORM,
    trigger: DiscountTrigger.CODE,
  },
};

function calcDiscount(price: number, offer: SimulatorOfferInput): number {
  if (!offer.enabled || offer.value <= 0) return 0;
  if (offer.discountType === 'PERCENT') {
    return Math.round(price * (offer.value / 100) * 100) / 100;
  }
  return Math.min(offer.value, price);
}

function buildSyntheticBenefits(
  servicePrice: number,
  offers: SimulatorOfferInput[]
): CandidateBenefitOutcome[] {
  const outcomes: CandidateBenefitOutcome[] = [];
  for (const offer of offers) {
    const mapping = OFFER_SOURCE_MAP[offer.offerType];
    if (!mapping) continue;
    const discountAmount = calcDiscount(servicePrice, offer);
    if (discountAmount <= 0) continue;
    const id = `sim-${offer.offerType.toLowerCase()}`;
    outcomes.push({
      candidate: {
        id,
        name: offer.offerType.replace(/_/g, ' '),
        source: mapping.source,
        owner: mapping.owner,
        trigger: mapping.trigger,
        domain: DiscountDomain.SERVICE,
        funding: mapping.owner === DiscountOwner.VENDOR ? 'VENDOR' : 'PLATFORM',
        exclusive: false,
        priorityWeight: offer.priorityWeight ?? 0,
        metadata: { offerType: offer.offerType },
      },
      benefit: {
        appliedBenefit: 'standard',
        rawAmount: discountAmount,
        cappedAmount: discountAmount,
      },
      discountAmount,
    });
  }
  return outcomes;
}

function buildSyntheticContext(servicePrice: number): DiscountContext {
  return {
    domain: DiscountDomain.SERVICE,
    trigger: DiscountTrigger.AUTO,
    amount: servicePrice,
    vendorId: 'sim-vendor',
    customerId: 'sim-customer',
    metadata: {},
  };
}

export function simulatePolicyWithResolver(
  bundle: DiscountPolicyBundle,
  input: { servicePrice: number; offers: SimulatorOfferInput[]; domain?: string }
): UnifiedResolverResponse {
  const servicePrice = Math.max(0, Number(input.servicePrice) || 0);
  const runtimePolicy = loadRuntimePolicy(DiscountDomain.SERVICE, {
    priority: bundle.priority,
    stack: bundle.stack,
    funding: bundle.funding,
    limits: bundle.limits,
    businessRules: bundle.businessRules,
  });

  const context = buildSyntheticContext(servicePrice);
  const benefitResults = buildSyntheticBenefits(servicePrice, input.offers);
  const offerResolution = resolveOffers(context, benefitResults, runtimePolicy);

  const applied: AppliedDiscount[] = offerResolution.mergedSelected.map((b, idx) => ({
    id: b.candidate.id,
    name: b.candidate.name,
    owner: b.candidate.owner,
    trigger: b.candidate.trigger,
    funding: b.candidate.funding,
    discountAmount: b.discountAmount,
    benefitType: b.benefit.appliedBenefit,
    order: idx + 1,
    metadata: { source: b.candidate.source },
  }));

  const totalSavings = applied.reduce((s, d) => s + d.discountAmount, 0);
  const finalAmount = Math.max(0, servicePrice - totalSavings);

  let settlementPreview = undefined;
  try {
    const settlementDecision = getSettlementEngine().settle({
      context,
      applied,
      originalAmount: servicePrice,
      customerPayable: finalAmount,
      totalSavings,
      runtimePolicy,
      policyFingerprint: runtimePolicy.policyFingerprint,
    });
    settlementPreview = toDiscountSettlementPreview(settlementDecision.preview);
  } catch {
    /* settlement optional in simulator */
  }

  const syntheticResult = {
    originalAmount: servicePrice,
    totalSavings,
    finalAmount,
    applied,
    benefits: applied.map((d) => ({
      type: d.benefitType ?? 'standard',
      amount: d.discountAmount,
      description: d.name,
    })),
    settlement: settlementPreview,
    warnings: [],
    eligibleCandidates: benefitResults.map((b) => b.candidate),
    rejectedCandidates: [],
    appliedCandidates: offerResolution.mergedSelected.map((b) => b.candidate),
    benefitResults,
    ruleResults: [],
    executionTimeMs: offerResolution.unifiedPhase?.executionTimeMs ?? 0,
    resolverVersion: 'simulator-1.0',
    metadata: {
      pipelineTimeMs: 0,
      candidateCount: benefitResults.length,
      eligibleCount: benefitResults.length,
      rejectedCount: offerResolution.rejectedOffers.length,
      providerBreakdown: {},
      usagePrepared: [],
      domain: DiscountDomain.SERVICE,
      trigger: DiscountTrigger.AUTO,
      priority: {
        priorityMode: 'AUTHORITATIVE' as const,
        priorityVersion: '1.0.0',
        policyFingerprint: runtimePolicy.policyFingerprint,
        strategy: offerResolution.unifiedPhase?.strategy,
        selectedCount: applied.length,
        rejectedCount: offerResolution.rejectedOffers.length,
        executionTimeMs: 0,
        validationWarnings: 0,
        validationErrors: 0,
        authoritative: true,
        autoPhase: offerResolution.autoPhase,
        couponPhase: offerResolution.couponPhase,
      },
    },
  };

  return mapResolverResultToUnifiedResponse(syntheticResult, runtimePolicy, {
    resolverSource: 'v2',
    offerResolution,
    bundle,
  });
}

export function shouldCollapseToSingleWinner(
  runtimePolicy: ReturnType<typeof loadRuntimePolicy>
): boolean {
  const rules = ensureBusinessRules({
    priority: runtimePolicy.priority,
    stack: runtimePolicy.stack,
    funding: runtimePolicy.funding,
    limits: runtimePolicy.limits,
    businessRules: runtimePolicy.businessRules,
  });
  return rules.applicationStrategy === 'BEST_OFFER_ONLY';
}
