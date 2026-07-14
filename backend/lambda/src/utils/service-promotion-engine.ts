/**
 * @deprecated Legacy vendor service promotion engine — retained for OFF/fallback (Phase 8C removal candidate).
 * Authoritative path: Unified Discount Resolver via resolveWithProductionMode.
 */

import { isPromotionLiveInIst } from './promotion-date-bounds';
import { parseJsonbStringArray } from './vendor-promotion-engine';
import { applyMaximumDiscount } from '../discount-engine/benefits/math';
import {
  computePlatformPromotionDiscountAmount,
  computeServiceComboDiscountAmount,
  computeServiceLoyaltyDiscountAmount,
  computeServiceStandardDiscountAmount,
} from '../discount-engine/benefits/adapters/service-booking-benefit.adapter';
import {
  shadowVendorServiceBaseEligibility,
  shadowVendorServiceFullEligibility,
} from '../discount-engine/rules/adapters/shadow-adapters';
import { servicePromotionEvaluateToDiscountContext } from '../discount-engine/adapters/context-mappers';
import { invokeResolverAlongsideLegacy } from '../discount-engine/resolver/production-bridge';

export type ServicePromotionRow = {
  id: string;
  vendor_id?: string;
  name: string;
  description?: string;
  code?: string | null;
  promotion_type: string;
  discount_type: string;
  discount_value: number;
  min_booking_value?: number | null;
  max_discount_amount?: number | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  usage_limit?: number | null;
  usage_count?: number | null;
  target_audience?: string | null;
  applicable_services?: string[];
  applicable_service_styles?: string[];
  combo_services?: string[];
  combo_discount?: number | null;
  visits_required?: number | null;
  loyalty_discount?: number | null;
};

export type ServiceEvaluateContext = {
  vendorId?: string;
  customerId?: string;
  serviceIds?: string[];
  serviceStyle?: string;
  bookingAmount: number;
  priorVendorBookingCount?: number;
  now?: Date;
};

export type ServicePromotionEvaluation = {
  discountAmount: number;
  promotionId: string;
  promotionType: string;
  label: string;
  description: string;
  autoApplyEligible: boolean;
  promotion: ServicePromotionRow;
};

export function normalizeServicePromotionRow(row: Record<string, unknown>): ServicePromotionRow {
  return {
    id: String(row.id),
    vendor_id: row.vendor_id != null ? String(row.vendor_id) : undefined,
    name: String(row.name || ''),
    description: row.description != null ? String(row.description) : undefined,
    code: row.code != null ? String(row.code) : null,
    promotion_type: String(row.promotion_type || 'flash_sale'),
    discount_type: String(row.discount_type || 'percentage'),
    discount_value: parseFloat(String(row.discount_value ?? 0)) || 0,
    min_booking_value:
      row.min_booking_value != null ? parseFloat(String(row.min_booking_value)) : null,
    max_discount_amount:
      row.max_discount_amount != null ? parseFloat(String(row.max_discount_amount)) : null,
    start_date: String(row.start_date),
    end_date: String(row.end_date),
    is_active: row.is_active !== false,
    usage_limit: row.usage_limit != null ? parseInt(String(row.usage_limit), 10) : null,
    usage_count: row.usage_count != null ? parseInt(String(row.usage_count), 10) : 0,
    target_audience: row.target_audience != null ? String(row.target_audience) : 'all',
    applicable_services: parseJsonbStringArray(row.applicable_services),
    applicable_service_styles: parseJsonbStringArray(row.applicable_service_styles),
    combo_services: parseJsonbStringArray(row.combo_services),
    combo_discount: row.combo_discount != null ? parseFloat(String(row.combo_discount)) : null,
    visits_required: row.visits_required != null ? parseInt(String(row.visits_required), 10) : null,
    loyalty_discount:
      row.loyalty_discount != null ? parseFloat(String(row.loyalty_discount)) : null,
  };
}

function normalizeStyle(raw: unknown): string {
  const value = String(raw || '').trim().toLowerCase();
  if (!value || value === 'all') return '';
  if (value === 'home' || value === 'at_home' || value === 'home_visit') return 'at_home';
  if (value === 'clinic' || value === 'center' || value === 'at_center') return 'at_center';
  if (value === 'online' || value === 'tele') return 'tele';
  return value;
}

function capDiscount(amount: number, promo: ServicePromotionRow, maxBase: number): number {
  return applyMaximumDiscount(amount, promo.max_discount_amount, maxBase);
}

export function isServicePromotionEligible(
  promo: ServicePromotionRow,
  ctx: ServiceEvaluateContext
): { ok: boolean; message?: string } {
  const now = ctx.now ?? new Date();
  let result: { ok: boolean; message?: string };
  if (!promo.is_active) result = { ok: false, message: 'Promotion is not active' };
  else if (!isPromotionLiveInIst(promo.start_date, promo.end_date, now)) {
    result = { ok: false, message: 'Promotion is not valid for the current date' };
  } else if (ctx.vendorId && promo.vendor_id && promo.vendor_id !== ctx.vendorId) {
    result = { ok: false, message: 'Promotion does not apply to this vendor' };
  } else if (promo.usage_limit != null && (promo.usage_count ?? 0) >= promo.usage_limit) {
    result = { ok: false, message: 'This promotion has reached its usage limit' };
  } else {
    const audience = promo.target_audience || 'all';
    const prior = ctx.priorVendorBookingCount ?? 0;
    if ((audience === 'new_users' || promo.promotion_type === 'first_booking') && prior > 0) {
      result = { ok: false, message: 'This promotion is for new customers only' };
    } else if (audience === 'returning_users' && prior === 0) {
      result = { ok: false, message: 'This promotion is for returning customers only' };
    } else if (promo.min_booking_value != null && ctx.bookingAmount < promo.min_booking_value) {
      result = {
        ok: false,
        message: `Minimum booking value of ₹${promo.min_booking_value} required`,
      };
    } else {
      const styles = promo.applicable_service_styles || [];
      const style = normalizeStyle(ctx.serviceStyle);
      if (styles.length > 0 && !styles.includes('all') && style) {
        if (!styles.map(normalizeStyle).includes(style)) {
          result = { ok: false, message: 'Promotion does not apply to this service style' };
        } else {
          result = checkServiceIds(promo, ctx);
        }
      } else {
        result = checkServiceIds(promo, ctx);
      }
    }
  }
  return shadowVendorServiceBaseEligibility(promo, ctx, result);
}

function checkServiceIds(
  promo: ServicePromotionRow,
  ctx: ServiceEvaluateContext
): { ok: boolean; message?: string } {
  const serviceIds = (ctx.serviceIds || []).map(String).filter(Boolean);
  const applicableServices = promo.applicable_services || [];
  if (applicableServices.length > 0 && serviceIds.length > 0) {
    const match = serviceIds.some((id) => applicableServices.includes(id));
    if (!match) {
      return { ok: false, message: 'Promotion does not apply to selected services' };
    }
  }
  return { ok: true };
}

function calculateCombo(
  promo: ServicePromotionRow,
  ctx: ServiceEvaluateContext
): ServicePromotionEvaluation | null {
  if (promo.promotion_type !== 'combo') return null;
  const comboIds = promo.combo_services || [];
  const selected = (ctx.serviceIds || []).map(String);
  if (comboIds.length === 0 || selected.length === 0) return null;
  if (!comboIds.every((id) => selected.includes(id))) return null;

  const pct = promo.combo_discount ?? promo.discount_value ?? 0;
  let legacyDiscount = (ctx.bookingAmount * pct) / 100;
  if (legacyDiscount <= 0) return null;
  const legacyCapped = capDiscount(legacyDiscount, promo, ctx.bookingAmount);
  const discountAmount = computeServiceComboDiscountAmount({
    bookingAmount: ctx.bookingAmount,
    comboDiscountPercent: pct,
    maxDiscountAmount: promo.max_discount_amount,
    legacyAmount: legacyCapped,
  });
  if (discountAmount <= 0) return null;

  return {
    discountAmount,
    promotionId: promo.id,
    promotionType: promo.promotion_type,
    label: promo.name,
    description: `Combo: ${pct}% OFF`,
    autoApplyEligible: !promo.code,
    promotion: promo,
  };
}

function calculateLoyalty(
  promo: ServicePromotionRow,
  ctx: ServiceEvaluateContext
): ServicePromotionEvaluation | null {
  if (promo.promotion_type !== 'loyalty') return null;
  const required = promo.visits_required ?? 0;
  const prior = ctx.priorVendorBookingCount ?? 0;
  if (required <= 0 || prior + 1 < required) return null;

  const pct = promo.loyalty_discount ?? promo.discount_value ?? 0;
  let legacyDiscount =
    promo.discount_type === 'fixed' ? pct : (ctx.bookingAmount * pct) / 100;
  if (legacyDiscount <= 0) return null;
  const legacyCapped = capDiscount(legacyDiscount, promo, ctx.bookingAmount);
  const discountAmount = computeServiceLoyaltyDiscountAmount({
    discountType: promo.discount_type,
    discountValue: pct,
    bookingAmount: ctx.bookingAmount,
    maxDiscountAmount: promo.max_discount_amount,
    legacyAmount: legacyCapped,
  });
  if (discountAmount <= 0) return null;

  return {
    discountAmount,
    promotionId: promo.id,
    promotionType: promo.promotion_type,
    label: promo.name,
    description: promo.name || 'Loyalty reward',
    autoApplyEligible: !promo.code,
    promotion: promo,
  };
}

function calculateStandardService(
  promo: ServicePromotionRow,
  ctx: ServiceEvaluateContext
): ServicePromotionEvaluation | null {
  if (promo.promotion_type === 'combo' || promo.promotion_type === 'loyalty') return null;

  let legacyDiscount = 0;
  if (promo.discount_type === 'percentage') {
    legacyDiscount = (ctx.bookingAmount * promo.discount_value) / 100;
  } else {
    legacyDiscount = promo.discount_value;
  }
  if (legacyDiscount <= 0) return null;
  const legacyCapped = capDiscount(legacyDiscount, promo, ctx.bookingAmount);
  const discountAmount = computeServiceStandardDiscountAmount({
    discountType: promo.discount_type,
    discountValue: promo.discount_value,
    bookingAmount: ctx.bookingAmount,
    maxDiscountAmount: promo.max_discount_amount,
    legacyAmount: legacyCapped,
  });
  if (discountAmount <= 0) return null;

  const desc =
    promo.discount_type === 'percentage'
      ? `${promo.discount_value}% OFF - ${promo.name}`
      : `₹${promo.discount_value} OFF - ${promo.name}`;

  return {
    discountAmount,
    promotionId: promo.id,
    promotionType: promo.promotion_type,
    label: promo.name,
    description: desc,
    autoApplyEligible: !promo.code,
    promotion: promo,
  };
}

export function evaluateServicePromotionDiscount(
  promo: ServicePromotionRow,
  ctx: ServiceEvaluateContext
): ServicePromotionEvaluation | null {
  const eligibility = isServicePromotionEligible(promo, ctx);
  if (!eligibility.ok) return null;

  const resolverLabel = promo.code
    ? 'evaluateServicePromotionDiscount-code'
    : 'evaluateServicePromotionDiscount-auto';
  const resolverContext = servicePromotionEvaluateToDiscountContext(promo, ctx);

  const combo = calculateCombo(promo, ctx);
  if (combo) {
    shadowVendorServiceFullEligibility(promo, ctx, true);
    invokeResolverAlongsideLegacy(resolverLabel, resolverContext);
    return combo;
  }
  const loyalty = calculateLoyalty(promo, ctx);
  if (loyalty) {
    shadowVendorServiceFullEligibility(promo, ctx, true);
    invokeResolverAlongsideLegacy(resolverLabel, resolverContext);
    return loyalty;
  }
  const standard = calculateStandardService(promo, ctx);
  shadowVendorServiceFullEligibility(promo, ctx, standard != null);
  invokeResolverAlongsideLegacy(resolverLabel, resolverContext);
  return standard;
}

export function evaluateAllServicePromotions(
  promotions: ServicePromotionRow[],
  ctx: ServiceEvaluateContext
): ServicePromotionEvaluation[] {
  const results: ServicePromotionEvaluation[] = [];
  for (const raw of promotions) {
    const promo =
      typeof raw === 'object' && raw != null && 'promotion_type' in raw
        ? raw
        : normalizeServicePromotionRow(raw as unknown as Record<string, unknown>);
    const ev = evaluateServicePromotionDiscount(promo, ctx);
    if (ev) results.push(ev);
  }
  results.sort((a, b) => b.discountAmount - a.discountAmount);
  return results;
}

export function calculateBestBookingPromotion(
  promotions: ServicePromotionRow[],
  ctx: ServiceEvaluateContext
): {
  originalAmount: number;
  discountedAmount: number;
  totalSavings: number;
  bestPromotion: ServicePromotionEvaluation | null;
  allPromotions: ServicePromotionEvaluation[];
} {
  const originalAmount = ctx.bookingAmount;
  const all = evaluateAllServicePromotions(promotions, ctx);
  const autoEligible = all.filter((e) => e.autoApplyEligible);
  const best = autoEligible[0] ?? null;
  const savings = best?.discountAmount ?? 0;
  return {
    originalAmount,
    discountedAmount: Math.max(0, originalAmount - savings),
    totalSavings: savings,
    bestPromotion: best,
    allPromotions: all,
  };
}

export type PlatformPromotionRow = {
  id: string;
  name: string;
  discount_type: string;
  discount_value: number;
  min_order_amount?: number | null;
  max_discount_amount?: number | null;
  is_spotlight?: boolean;
  published?: boolean;
};

export function calculatePlatformDiscount(
  promo: PlatformPromotionRow,
  amount: number
): number {
  if (amount <= 0) return 0;
  const min = promo.min_order_amount != null ? parseFloat(String(promo.min_order_amount)) : 0;
  if (min > 0 && amount < min) return 0;

  let legacyDiscount = 0;
  if (promo.discount_type === 'percentage') {
    legacyDiscount = (amount * parseFloat(String(promo.discount_value || 0))) / 100;
  } else {
    legacyDiscount = parseFloat(String(promo.discount_value || 0));
  }
  if (promo.max_discount_amount != null) {
    legacyDiscount = Math.min(legacyDiscount, parseFloat(String(promo.max_discount_amount)));
  }
  const legacyCapped = Math.min(Math.max(0, legacyDiscount), amount);

  return computePlatformPromotionDiscountAmount({
    discountType: promo.discount_type,
    discountValue: promo.discount_value,
    amount,
    maxDiscountAmount: promo.max_discount_amount,
    minOrderAmount: promo.min_order_amount,
    legacyAmount: legacyCapped,
  });
}

export type AppliedBookingPromotion = {
  source: 'vendor' | 'platform';
  id: string;
  name: string;
  discountAmount: number;
  promotionType?: string;
};

export type BookingPromotionResult = {
  originalAmount: number;
  vendorDiscountAmount: number;
  platformDiscountAmount: number;
  totalSavings: number;
  finalAmount: number;
  applied: AppliedBookingPromotion[];
  vendorPromotionId?: string;
  platformPromotionId?: string;
  settlement?: import('../discount-engine/models/discount-result').DiscountSettlementPreview;
};

function pickBestPlatformPromotion(
  platformPromotions: PlatformPromotionRow[],
  amount: number
): { promo: PlatformPromotionRow; discount: number } | null {
  const eligiblePlatform = platformPromotions
    .map((p) => ({
      promo: p,
      discount: calculatePlatformDiscount(p, amount),
    }))
    .filter((x) => x.discount > 0)
    .sort((a, b) => {
      if (a.promo.is_spotlight && !b.promo.is_spotlight) return -1;
      if (!a.promo.is_spotlight && b.promo.is_spotlight) return 1;
      return b.discount - a.discount;
    });
  return eligiblePlatform[0] ?? null;
}

/**
 * Policy Center BEST_OFFER_ONLY — one auto promo on the original amount (no vendor+platform stack).
 */
export function calculateBookingPromotionsBestOffer(params: {
  vendorPromotions: ServicePromotionRow[];
  platformPromotions: PlatformPromotionRow[];
  ctx: ServiceEvaluateContext;
}): BookingPromotionResult {
  const { vendorPromotions, platformPromotions, ctx } = params;
  const originalAmount = ctx.bookingAmount;
  const vendorResult = calculateBestBookingPromotion(vendorPromotions, ctx);
  const vendorDiscount = vendorResult.bestPromotion?.discountAmount ?? 0;
  const bestPlatform = pickBestPlatformPromotion(platformPromotions, originalAmount);
  const platformDiscount = bestPlatform?.discount ?? 0;

  if (vendorDiscount <= 0 && platformDiscount <= 0) {
    return {
      originalAmount,
      vendorDiscountAmount: 0,
      platformDiscountAmount: 0,
      totalSavings: 0,
      finalAmount: originalAmount,
      applied: [],
    };
  }

  const vendorWins = vendorDiscount >= platformDiscount;
  if (vendorWins && vendorResult.bestPromotion) {
    return {
      originalAmount,
      vendorDiscountAmount: vendorDiscount,
      platformDiscountAmount: 0,
      totalSavings: vendorDiscount,
      finalAmount: Math.max(0, originalAmount - vendorDiscount),
      applied: [
        {
          source: 'vendor',
          id: vendorResult.bestPromotion.promotionId,
          name: vendorResult.bestPromotion.label,
          discountAmount: vendorDiscount,
          promotionType: vendorResult.bestPromotion.promotionType,
        },
      ],
      vendorPromotionId: vendorResult.bestPromotion.promotionId,
    };
  }

  if (bestPlatform) {
    return {
      originalAmount,
      vendorDiscountAmount: 0,
      platformDiscountAmount: platformDiscount,
      totalSavings: platformDiscount,
      finalAmount: Math.max(0, originalAmount - platformDiscount),
      applied: [
        {
          source: 'platform',
          id: bestPlatform.promo.id,
          name: bestPlatform.promo.name,
          discountAmount: platformDiscount,
        },
      ],
      platformPromotionId: bestPlatform.promo.id,
    };
  }

  return {
    originalAmount,
    vendorDiscountAmount: 0,
    platformDiscountAmount: 0,
    totalSavings: 0,
    finalAmount: originalAmount,
    applied: [],
  };
}

/** @deprecated Sequential vendor-then-platform stack — use only when stack policy explicitly allows both legs. */
export function calculateBookingPromotionsSequentialStack(params: {
  vendorPromotions: ServicePromotionRow[];
  platformPromotions: PlatformPromotionRow[];
  ctx: ServiceEvaluateContext;
}): BookingPromotionResult {
  const { vendorPromotions, platformPromotions, ctx } = params;
  const originalAmount = ctx.bookingAmount;
  const applied: AppliedBookingPromotion[] = [];

  const vendorResult = calculateBestBookingPromotion(vendorPromotions, ctx);
  const vendorDiscount = vendorResult.bestPromotion?.discountAmount ?? 0;
  let current = Math.max(0, originalAmount - vendorDiscount);

  if (vendorResult.bestPromotion) {
    applied.push({
      source: 'vendor',
      id: vendorResult.bestPromotion.promotionId,
      name: vendorResult.bestPromotion.label,
      discountAmount: vendorDiscount,
      promotionType: vendorResult.bestPromotion.promotionType,
    });
  }

  let platformDiscount = 0;
  let platformPromotionId: string | undefined;
  const bestPlatform = pickBestPlatformPromotion(platformPromotions, current);

  if (bestPlatform) {
    platformDiscount = bestPlatform.discount;
    platformPromotionId = bestPlatform.promo.id;
    current = Math.max(0, current - platformDiscount);
    applied.push({
      source: 'platform',
      id: bestPlatform.promo.id,
      name: bestPlatform.promo.name,
      discountAmount: platformDiscount,
    });
  }

  return {
    originalAmount,
    vendorDiscountAmount: vendorDiscount,
    platformDiscountAmount: platformDiscount,
    totalSavings: vendorDiscount + platformDiscount,
    finalAmount: current,
    applied,
    vendorPromotionId: vendorResult.bestPromotion?.promotionId,
    platformPromotionId,
  };
}

export function calculateBookingPromotionsStack(params: {
  vendorPromotions: ServicePromotionRow[];
  platformPromotions: PlatformPromotionRow[];
  ctx: ServiceEvaluateContext;
}): BookingPromotionResult {
  // Legacy path: align with Policy Center BEST_OFFER_ONLY (POST /promotions/calculate-booking).
  return calculateBookingPromotionsBestOffer(params);
}
