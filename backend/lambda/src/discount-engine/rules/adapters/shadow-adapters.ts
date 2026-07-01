import type { CartLineItem, EvaluateContext, PromotionRow } from '../../../utils/vendor-promotion-engine';
import type { ServiceEvaluateContext, ServicePromotionRow } from '../../../utils/service-promotion-engine';
import {
  couponToRuleContext,
  platformInlinePromoToRuleContext,
  platformPromoRowToRuleContext,
  vendorProductPromoToRuleContext,
  vendorServicePromoToRuleContext,
} from './context-mappers';
import { runEligibilityShadow } from '../shadow';

export function shadowVendorProductBaseEligibility(
  promo: PromotionRow,
  ctx: EvaluateContext,
  legacy: { ok: boolean; message?: string }
): { ok: boolean; message?: string } {
  const ruleCtx = vendorProductPromoToRuleContext(promo, ctx, undefined, 'base');
  runEligibilityShadow(ruleCtx, legacy.ok, legacy.message);
  return legacy;
}

export function shadowVendorProductFullEligibility(
  promo: PromotionRow,
  items: CartLineItem[],
  ctx: EvaluateContext,
  legacyHasDiscount: boolean
): void {
  const ruleCtx = vendorProductPromoToRuleContext(promo, ctx, items, 'full');
  runEligibilityShadow(ruleCtx, legacyHasDiscount);
}

export function shadowVendorServiceBaseEligibility(
  promo: ServicePromotionRow,
  ctx: ServiceEvaluateContext,
  legacy: { ok: boolean; message?: string }
): { ok: boolean; message?: string } {
  const ruleCtx = vendorServicePromoToRuleContext(promo, ctx, 'base');
  runEligibilityShadow(ruleCtx, legacy.ok, legacy.message);
  return legacy;
}

export function shadowVendorServiceFullEligibility(
  promo: ServicePromotionRow,
  ctx: ServiceEvaluateContext,
  legacyHasDiscount: boolean
): void {
  const ruleCtx = vendorServicePromoToRuleContext(promo, ctx, 'full');
  runEligibilityShadow(ruleCtx, legacyHasDiscount);
}

export function shadowPlatformPromoEligibility(
  row: Record<string, unknown>,
  params: { category?: string; serviceStyle?: string; serviceIds: string[]; amount: number },
  legacyMatches: boolean
): boolean {
  const ruleCtx = platformPromoRowToRuleContext(row, params);
  return runEligibilityShadow(ruleCtx, legacyMatches);
}

export function shadowPlatformInlineEligibility(
  promotion: Record<string, unknown>,
  params: {
    category?: string;
    serviceStyle?: string;
    serviceIds?: string[];
    amount?: number;
    now?: Date;
  },
  legacy: { eligible: boolean; reason?: string | null }
): { eligible: boolean; reason: string | null } {
  const ruleCtx = platformInlinePromoToRuleContext(promotion, params);
  runEligibilityShadow(ruleCtx, legacy.eligible, legacy.reason ?? undefined);
  return { eligible: legacy.eligible, reason: legacy.reason ?? null };
}

export function shadowCouponEligibility(
  coupon: Record<string, unknown>,
  amount: number,
  usageCount: number,
  legacyValid: boolean,
  legacyError?: string
): void {
  const ruleCtx = couponToRuleContext({ coupon, amount, usageCount });
  runEligibilityShadow(ruleCtx, legacyValid, legacyError);
}
