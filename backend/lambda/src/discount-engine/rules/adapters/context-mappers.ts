import type {
  CartLineItem,
  EvaluateContext,
  PromotionRow,
} from '../../../utils/vendor-promotion-engine';
import type {
  ServiceEvaluateContext,
  ServicePromotionRow,
} from '../../../utils/service-promotion-engine';
import { getCandidateNormalizer } from '../../candidates/candidate-normalizer';
import {
  candidateToPlatformInlineRuleContext,
  candidateToPlatformMatchRuleContext,
  candidateToRuleContext,
} from '../../candidates/bridges/candidate-to-rule-context';
import type { RuleContext } from '../types';

const normalizer = () => getCandidateNormalizer();

export function vendorProductPromoToRuleContext(
  promo: PromotionRow,
  ctx: EvaluateContext = {},
  items?: CartLineItem[],
  evaluationMode: 'base' | 'full' = 'base'
): RuleContext {
  const candidate = normalizer().fromVendorProductPromotion(promo);
  return candidateToRuleContext(candidate, {
    now: ctx.now,
    customerId: ctx.customerId,
    contextVendorId: ctx.vendorId,
    priorVendorOrderCount: ctx.priorVendorOrderCount,
    items,
    manualCode: ctx.manualCode,
    evaluationMode,
  });
}

export function vendorServicePromoToRuleContext(
  promo: ServicePromotionRow,
  ctx: ServiceEvaluateContext,
  evaluationMode: 'base' | 'full' = 'base'
): RuleContext {
  const candidate = normalizer().fromVendorServicePromotion(promo);
  return candidateToRuleContext(candidate, {
    now: ctx.now,
    customerId: ctx.customerId,
    contextVendorId: ctx.vendorId,
    priorVendorBookingCount: ctx.priorVendorBookingCount,
    serviceIds: ctx.serviceIds,
    serviceStyle: ctx.serviceStyle,
    amount: ctx.bookingAmount,
    evaluationMode,
  });
}

export function platformPromoRowToRuleContext(
  row: Record<string, unknown>,
  params: {
    category?: string;
    serviceStyle?: string;
    serviceIds: string[];
    amount: number;
  }
): RuleContext {
  const candidate = normalizer().fromPlatformPromotion(row);
  return candidateToPlatformMatchRuleContext(candidate, {
    platformMatchParams: params,
  });
}

export function platformInlinePromoToRuleContext(
  promotion: Record<string, unknown>,
  params: {
    category?: string;
    serviceStyle?: string;
    serviceIds?: string[];
    amount?: number;
    now?: Date;
  }
): RuleContext {
  const candidate = normalizer().fromPlatformPromotion(promotion);
  return candidateToPlatformInlineRuleContext(candidate, {
    now: params.now,
    serviceCategory: params.category,
    serviceStyle: params.serviceStyle,
    serviceIds: params.serviceIds,
    amount: params.amount,
    evaluationMode: 'base',
  });
}

export function couponToRuleContext(input: {
  coupon: Record<string, unknown>;
  amount: number;
  usageCount?: number;
  now?: Date;
  customerId?: string;
}): RuleContext {
  const candidate = normalizer().fromCoupon(input.coupon);
  return candidateToRuleContext(candidate, {
    now: input.now,
    customerId: input.customerId,
    amount: input.amount,
    couponUsageCount: input.usageCount,
    evaluationMode: 'base',
  });
}
