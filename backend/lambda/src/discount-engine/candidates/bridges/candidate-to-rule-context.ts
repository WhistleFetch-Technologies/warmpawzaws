import type { CartLineItem } from '../../../utils/vendor-promotion-engine';
import { cartLineSubtotal } from '../../../utils/vendor-promotion-engine';
import { DiscountDomain } from '../../enums/discount-domain';
import { DiscountOwner } from '../../enums/discount-owner';
import { DiscountSource } from '../../enums/discount-source';
import { DiscountStatus } from '../../enums/discount-status';
import type { DiscountCandidate } from '../types';
import { parseServicesList } from '../parse-utils';
import type { RuleContext, RuleDomain } from '../../rules/types';

export interface CandidateRuleRuntimeContext {
  now?: Date;
  customerId?: string;
  contextVendorId?: string;
  amount?: number;
  priorVendorOrderCount?: number;
  priorVendorBookingCount?: number;
  serviceIds?: string[];
  serviceStyle?: string;
  serviceCategory?: string;
  items?: CartLineItem[];
  manualCode?: string;
  couponUsageCount?: number;
  evaluationMode?: 'base' | 'full';
  /** Platform composite match — original row + runtime params */
  platformMatchParams?: {
    category?: string;
    serviceStyle?: string;
    serviceIds: string[];
    amount: number;
  };
}

function resolveRuleDomain(
  candidate: DiscountCandidate,
  mode?: 'platform' | 'platform_inline' | 'coupon'
): RuleDomain {
  if (candidate.source === DiscountSource.PLATFORM_COUPON) return 'coupon';
  if (mode === 'platform_inline') return 'platform_inline';
  if (candidate.domain === DiscountDomain.ECOMMERCE) return 'vendor_product';
  if (candidate.domain === DiscountDomain.SERVICE && candidate.owner === DiscountOwner.PLATFORM) {
    return mode === 'platform' ? 'platform' : 'platform_inline';
  }
  return 'vendor_service';
}

/** Maps canonical candidate + runtime checkout context → Rule Engine input. */
export function candidateToRuleContext(
  candidate: DiscountCandidate,
  runtime: CandidateRuleRuntimeContext,
  options?: { ruleDomain?: RuleDomain }
): RuleContext {
  const ruleDomain =
    options?.ruleDomain ??
    resolveRuleDomain(candidate, candidate.metadata?.isSpotlight ? 'platform' : undefined);

  const items = runtime.items ?? [];
  const amount =
    runtime.amount ??
    (items.length > 0 ? cartLineSubtotal(items) : undefined);

  return {
    domain: ruleDomain,
    promotionId: candidate.id,
    promotionType: candidate.benefits.type,
    now: runtime.now,
    isActive: candidate.status === DiscountStatus.ACTIVE,
    startDate: candidate.startDate,
    endDate: candidate.endDate,
    published: candidate.rules.published,
    vendorId: candidate.rules.vendorId,
    contextVendorId: runtime.contextVendorId,
    customerId: runtime.customerId,
    usageLimit: candidate.usage?.limit,
    usageCount: candidate.usage?.count ?? 0,
    maxUses: candidate.usage?.limit,
    couponUsageCount: runtime.couponUsageCount ?? candidate.usage?.count ?? 0,
    targetAudience: candidate.rules.targetAudience,
    minOrderValue: candidate.rules.minOrderValue,
    minBookingValue: candidate.rules.minBookingValue,
    minOrderAmount: candidate.benefits.minOrderAmount ?? candidate.rules.minOrderValue,
    amount,
    priorVendorOrderCount: runtime.priorVendorOrderCount,
    priorVendorBookingCount: runtime.priorVendorBookingCount,
    serviceIds: runtime.serviceIds,
    serviceStyle: runtime.serviceStyle,
    serviceCategory: runtime.serviceCategory ?? candidate.rules.serviceCategory,
    applicableProducts: candidate.rules.applicableProducts,
    applicableCategories: candidate.rules.applicableCategories,
    applicableServices: candidate.rules.applicableServices,
    applicableServiceStyles: candidate.rules.applicableServiceStyles,
    bundleProducts: candidate.benefits.bundleProductIds,
    comboServices: candidate.benefits.comboServiceIds,
    buyQuantity: candidate.benefits.buyQuantity ?? undefined,
    getQuantity: candidate.benefits.getQuantity ?? undefined,
    visitsRequired: candidate.benefits.visitsRequired ?? undefined,
    items,
    promotionCode: candidate.code,
    manualCode: runtime.manualCode,
    platformRow:
      ruleDomain === 'platform' || ruleDomain === 'platform_inline'
        ? candidate.originalEntity
        : undefined,
    metadata: { evaluationMode: runtime.evaluationMode ?? 'base' },
  };
}

export function candidateToPlatformInlineRuleContext(
  candidate: DiscountCandidate,
  runtime: CandidateRuleRuntimeContext
): RuleContext {
  const applicableServices =
    candidate.rules.applicableServices ?? parseServicesList(candidate.originalEntity.applicable_services);

  return candidateToRuleContext(
    {
      ...candidate,
      rules: { ...candidate.rules, applicableServices },
    },
    runtime,
    { ruleDomain: 'platform_inline' }
  );
}

export function candidateToPlatformMatchRuleContext(
  candidate: DiscountCandidate,
  runtime: CandidateRuleRuntimeContext & {
    platformMatchParams: NonNullable<CandidateRuleRuntimeContext['platformMatchParams']>;
  }
): RuleContext {
  return {
    ...candidateToRuleContext(candidate, runtime, { ruleDomain: 'platform' }),
    platformRow: candidate.originalEntity,
    amount: runtime.platformMatchParams.amount,
    serviceCategory: runtime.platformMatchParams.category,
    serviceStyle: runtime.platformMatchParams.serviceStyle,
    serviceIds: runtime.platformMatchParams.serviceIds,
  };
}
