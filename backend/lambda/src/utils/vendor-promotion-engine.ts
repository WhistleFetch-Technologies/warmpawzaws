/**
 * @deprecated Legacy vendor product promotion engine — retained for OFF/fallback (Phase 8C removal candidate).
 * Authoritative path: Unified Discount Resolver via resolveWithProductionMode.
 */

import { isPromotionLiveInIst } from './promotion-date-bounds';
import { applyMaximumDiscount } from '../discount-engine/benefits/math';
import {
  computeVendorBogoDiscountAmount,
  computeVendorBundleDiscountAmount,
  computeVendorStandardDiscountAmount,
} from '../discount-engine/benefits/adapters/vendor-product-benefit.adapter';
import {
  shadowVendorProductBaseEligibility,
  shadowVendorProductFullEligibility,
} from '../discount-engine/rules/adapters/shadow-adapters';
import {
  vendorCartPromotionsToDiscountContext,
  vendorPromoEvaluateToDiscountContext,
} from '../discount-engine/adapters/context-mappers';
import { invokeResolverAlongsideLegacy, resolveWithProductionMode } from '../discount-engine/resolver/production-bridge';
import { mapResolverResultToCartPromotion } from '../discount-engine/resolver/resolver-result-mappers';

export type CartLineItem = {
  productId: string;
  quantity: number;
  price: number;
  category?: string;
  categoryId?: string;
  id?: string;
};

export type PromotionRow = {
  id: string;
  vendor_id?: string;
  name: string;
  description?: string;
  code?: string | null;
  promotion_type: string;
  discount_type: string;
  discount_value: number;
  min_order_value?: number | null;
  max_discount_amount?: number | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  usage_limit?: number | null;
  usage_count?: number | null;
  target_audience?: string | null;
  applicable_products?: string[];
  applicable_categories?: string[];
  buy_quantity?: number | null;
  get_quantity?: number | null;
  get_discount_percent?: number | null;
  bundle_products?: string[];
  bundle_discount?: number | null;
};

export type EvaluateContext = {
  vendorId?: string;
  customerId?: string;
  /** Prior non-cancelled orders with this vendor (for audience rules). */
  priorVendorOrderCount?: number;
  now?: Date;
  manualCode?: string;
};

export type PromotionEvaluation = {
  discountAmount: number;
  promotionId: string;
  promotionType: string;
  label: string;
  description: string;
  affectedProductIds: string[];
  autoApplyEligible: boolean;
  promotion: PromotionRow;
};

export function parseJsonbStringArray(field: unknown): string[] {
  if (field == null) return [];
  if (Array.isArray(field)) {
    return field.map((x) => String(x)).filter(Boolean);
  }
  if (typeof field === 'string') {
    const trimmed = field.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x)).filter(Boolean);
      }
      if (typeof parsed === 'string') {
        try {
          const inner = JSON.parse(parsed);
          if (Array.isArray(inner)) return inner.map((x) => String(x)).filter(Boolean);
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }
  return [];
}

export function normalizePromotionRow(row: Record<string, unknown>): PromotionRow {
  return {
    id: String(row.id),
    vendor_id: row.vendor_id != null ? String(row.vendor_id) : undefined,
    name: String(row.name || ''),
    description: row.description != null ? String(row.description) : undefined,
    code: row.code != null ? String(row.code) : null,
    promotion_type: String(row.promotion_type || 'flash_sale'),
    discount_type: String(row.discount_type || 'percentage'),
    discount_value: parseFloat(String(row.discount_value ?? 0)) || 0,
    min_order_value:
      row.min_order_value != null ? parseFloat(String(row.min_order_value)) : null,
    max_discount_amount:
      row.max_discount_amount != null ? parseFloat(String(row.max_discount_amount)) : null,
    start_date: String(row.start_date),
    end_date: String(row.end_date),
    is_active: row.is_active !== false,
    usage_limit: row.usage_limit != null ? parseInt(String(row.usage_limit), 10) : null,
    usage_count: row.usage_count != null ? parseInt(String(row.usage_count), 10) : 0,
    target_audience: row.target_audience != null ? String(row.target_audience) : 'all',
    applicable_products: parseJsonbStringArray(row.applicable_products),
    applicable_categories: parseJsonbStringArray(row.applicable_categories),
    buy_quantity: row.buy_quantity != null ? parseInt(String(row.buy_quantity), 10) : null,
    get_quantity: row.get_quantity != null ? parseInt(String(row.get_quantity), 10) : null,
    get_discount_percent:
      row.get_discount_percent != null ? parseInt(String(row.get_discount_percent), 10) : null,
    bundle_products: parseJsonbStringArray(row.bundle_products),
    bundle_discount:
      row.bundle_discount != null ? parseFloat(String(row.bundle_discount)) : null,
  };
}

export function cartLineSubtotal(items: CartLineItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function parseNum(value: unknown): number {
  const n = parseFloat(String(value ?? 0));
  return Number.isFinite(n) ? n : 0;
}

export function isPromotionEligible(
  promo: PromotionRow,
  ctx: EvaluateContext = {}
): { ok: boolean; message?: string } {
  const now = ctx.now ?? new Date();
  let result: { ok: boolean; message?: string };
  if (!promo.is_active) result = { ok: false, message: 'Promotion is not active' };
  else if (!isPromotionLiveInIst(promo.start_date, promo.end_date, now)) {
    result = { ok: false, message: 'Promotion is not valid for the current date' };
  } else if (ctx.vendorId && promo.vendor_id && promo.vendor_id !== ctx.vendorId) {
    result = { ok: false, message: 'Promotion does not apply to this seller' };
  } else if (promo.usage_limit != null && (promo.usage_count ?? 0) >= promo.usage_limit) {
    result = { ok: false, message: 'This promotion has reached its usage limit' };
  } else {
    const audience = promo.target_audience || 'all';
    const prior = ctx.priorVendorOrderCount ?? 0;
    if ((audience === 'new_users' || promo.promotion_type === 'first_order') && prior > 0) {
      result = { ok: false, message: 'This promotion is for new customers only' };
    } else if (audience === 'returning_users' && prior === 0) {
      result = { ok: false, message: 'This promotion is for returning customers only' };
    } else {
      result = { ok: true };
    }
  }
  return shadowVendorProductBaseEligibility(promo, ctx, result);
}

function lineProductId(item: CartLineItem): string {
  const raw = String(item.productId || item.id || '');
  // Cart UI uses `productId::skuId` for variant lines; promotions target product UUIDs.
  const sep = raw.indexOf('::');
  return sep > 0 ? raw.slice(0, sep) : raw;
}

export function promotionAppliesToLine(promo: PromotionRow, item: CartLineItem): boolean {
  const productId = lineProductId(item);
  const categoryId = item.categoryId || item.category || '';

  if (promo.promotion_type === 'category_discount') {
    const cats = promo.applicable_categories || [];
    if (cats.length === 0) return true;
    return Boolean(categoryId && cats.includes(categoryId));
  }

  if (promo.promotion_type === 'bundle') {
    const bundleIds = promo.bundle_products || [];
    if (bundleIds.length === 0) return false;
    return bundleIds.includes(productId);
  }

  const products = promo.applicable_products || [];
  const categories = promo.applicable_categories || [];
  if (products.length === 0 && categories.length === 0) return true;
  if (products.length > 0 && products.includes(productId)) return true;
  if (categories.length > 0 && categoryId && categories.includes(categoryId)) return true;
  return false;
}

function capDiscount(amount: number, promo: PromotionRow, maxBase: number): number {
  return applyMaximumDiscount(amount, promo.max_discount_amount, maxBase);
}

function calculateBogo(promo: PromotionRow, items: CartLineItem[]): PromotionEvaluation | null {
  if (promo.promotion_type !== 'buy_x_get_y') return null;
  const buyQty = promo.buy_quantity || 2;
  const getQty = promo.get_quantity || 1;
  const discountPercent = promo.get_discount_percent ?? 100;
  const applicable = items.filter((i) => promotionAppliesToLine(promo, i));
  if (applicable.length === 0) return null;

  const totalQty = applicable.reduce((s, i) => s + i.quantity, 0);
  const setSize = buyQty + getQty;
  const completeSets = Math.floor(totalQty / setSize);
  if (completeSets === 0) return null;

  const sorted = [...applicable].sort((a, b) => a.price - b.price);
  let freeRemaining = completeSets * getQty;
  let discountAmount = 0;
  for (const item of sorted) {
    if (freeRemaining <= 0) break;
    const freeFrom = Math.min(freeRemaining, item.quantity);
    discountAmount += (item.price * freeFrom * discountPercent) / 100;
    freeRemaining -= freeFrom;
  }
  if (discountAmount <= 0) return null;
  const subtotal = cartLineSubtotal(items);
  const legacyDiscount = capDiscount(discountAmount, promo, subtotal);
  discountAmount = computeVendorBogoDiscountAmount({
    items,
    buyQuantity: promo.buy_quantity,
    getQuantity: promo.get_quantity,
    getDiscountPercent: promo.get_discount_percent,
    maxDiscountAmount: promo.max_discount_amount,
    originalAmount: subtotal,
    legacyAmount: legacyDiscount,
  });
  const desc =
    discountPercent === 100
      ? `Buy ${buyQty} Get ${getQty} FREE!`
      : `Buy ${buyQty} Get ${getQty} at ${discountPercent}% OFF!`;
  return {
    discountAmount,
    promotionId: promo.id,
    promotionType: promo.promotion_type,
    label: promo.name,
    description: desc,
    affectedProductIds: applicable.map(lineProductId),
    autoApplyEligible: !promo.code,
    promotion: promo,
  };
}

function calculateBundle(promo: PromotionRow, items: CartLineItem[]): PromotionEvaluation | null {
  if (promo.promotion_type !== 'bundle') return null;
  const bundleIds = promo.bundle_products || [];
  if (bundleIds.length === 0) return null;
  const cartIds = new Set(items.map(lineProductId));
  if (!bundleIds.every((id) => cartIds.has(id))) return null;

  const bundleItems = items.filter((i) => bundleIds.includes(lineProductId(i)));
  const bundleTotal = bundleItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const pct = promo.bundle_discount ?? 15;
  let discountAmount = (bundleTotal * pct) / 100;
  if (discountAmount <= 0) return null;
  const legacyDiscount = capDiscount(discountAmount, promo, cartLineSubtotal(items));
  discountAmount = computeVendorBundleDiscountAmount({
    items,
    bundleProductIds: bundleIds,
    bundleDiscountPercent: pct,
    maxDiscountAmount: promo.max_discount_amount,
    originalAmount: cartLineSubtotal(items),
    legacyAmount: legacyDiscount,
  });
  return {
    discountAmount,
    promotionId: promo.id,
    promotionType: promo.promotion_type,
    label: promo.name,
    description: `Bundle Deal: ${pct}% OFF on combo!`,
    affectedProductIds: bundleItems.map(lineProductId),
    autoApplyEligible: !promo.code,
    promotion: promo,
  };
}

function calculateStandard(promo: PromotionRow, items: CartLineItem[]): PromotionEvaluation | null {
  if (promo.promotion_type === 'buy_x_get_y' || promo.promotion_type === 'bundle') return null;
  const cartTotal = cartLineSubtotal(items);
  if (promo.min_order_value != null && cartTotal < promo.min_order_value) return null;

  const applicable = items.filter((i) => promotionAppliesToLine(promo, i));
  if (applicable.length === 0) return null;

  const applicableTotal = applicable.reduce((s, i) => s + i.price * i.quantity, 0);
  let legacyDiscount = 0;
  if (promo.discount_type === 'percentage') {
    legacyDiscount = (applicableTotal * promo.discount_value) / 100;
  } else {
    legacyDiscount = promo.discount_value;
  }
  if (legacyDiscount <= 0) return null;
  const legacyCapped = capDiscount(legacyDiscount, promo, applicableTotal);
  const discountAmount = computeVendorStandardDiscountAmount({
    discountType: promo.discount_type,
    discountValue: promo.discount_value,
    applicableTotal,
    maxDiscountAmount: promo.max_discount_amount,
    originalAmount: cartTotal,
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
    affectedProductIds: applicable.map(lineProductId),
    autoApplyEligible: !promo.code,
    promotion: promo,
  };
}

export function evaluatePromotionDiscount(
  promo: PromotionRow,
  items: CartLineItem[],
  ctx: EvaluateContext = {}
): PromotionEvaluation | null {
  const eligibility = isPromotionEligible(promo, ctx);
  if (!eligibility.ok) return null;

  const resolverLabel =
    promo.code || ctx.manualCode ? 'evaluatePromotionDiscount-code' : 'evaluatePromotionDiscount-auto';
  const resolverContext = vendorPromoEvaluateToDiscountContext(promo, items, ctx);

  if (items.length === 0) {
    shadowVendorProductFullEligibility(promo, items, ctx, false);
    invokeResolverAlongsideLegacy(resolverLabel, resolverContext);
    return null;
  }

  const bogo = calculateBogo(promo, items);
  if (bogo) {
    shadowVendorProductFullEligibility(promo, items, ctx, true);
    invokeResolverAlongsideLegacy(resolverLabel, resolverContext);
    return bogo;
  }
  const bundle = calculateBundle(promo, items);
  if (bundle) {
    shadowVendorProductFullEligibility(promo, items, ctx, true);
    invokeResolverAlongsideLegacy(resolverLabel, resolverContext);
    return bundle;
  }
  const standard = calculateStandard(promo, items);
  shadowVendorProductFullEligibility(promo, items, ctx, standard != null);
  invokeResolverAlongsideLegacy(resolverLabel, resolverContext);
  return standard;
}

export function evaluateAllPromotions(
  promotions: PromotionRow[],
  items: CartLineItem[],
  ctx: EvaluateContext = {}
): PromotionEvaluation[] {
  const results: PromotionEvaluation[] = [];
  for (const raw of promotions) {
    const promo = normalizePromotionRow(raw as unknown as Record<string, unknown>);
    const ev = evaluatePromotionDiscount(promo, items, ctx);
    if (ev) results.push(ev);
  }
  results.sort((a, b) => b.discountAmount - a.discountAmount);
  return results;
}

export function calculateBestCartPromotion(
  promotions: PromotionRow[],
  items: CartLineItem[],
  ctx: EvaluateContext = {}
): {
  originalTotal: number;
  discountedTotal: number;
  totalSavings: number;
  bestPromotion: PromotionEvaluation | null;
  allPromotions: PromotionEvaluation[];
  platformCouponDiscount?: number;
  platformCouponId?: string;
} {
  const originalTotal = cartLineSubtotal(items);
  const legacyCompute = () => {
    const all = evaluateAllPromotions(promotions, items, ctx);

    invokeResolverAlongsideLegacy(
      ctx.manualCode ? 'calculateBestCartPromotion-code' : 'calculateBestCartPromotion-auto',
      vendorCartPromotionsToDiscountContext(promotions, items, ctx)
    );

    if (ctx.manualCode) {
      const code = ctx.manualCode.toUpperCase();
      const manual = all.find((e) => e.promotion.code?.toUpperCase() === code);
      if (manual) {
        return {
          originalTotal,
          discountedTotal: Math.max(0, originalTotal - manual.discountAmount),
          totalSavings: manual.discountAmount,
          bestPromotion: manual,
          allPromotions: all,
        };
      }
      return {
        originalTotal,
        discountedTotal: originalTotal,
        totalSavings: 0,
        bestPromotion: null,
        allPromotions: all,
      };
    }

    const autoEligible = all.filter((e) => e.autoApplyEligible);
    const best = autoEligible[0] ?? null;
    const savings = best?.discountAmount ?? 0;
    return {
      originalTotal,
      discountedTotal: Math.max(0, originalTotal - savings),
      totalSavings: savings,
      bestPromotion: best,
      allPromotions: all,
    };
  };

  const resolverContext = vendorCartPromotionsToDiscountContext(promotions, items, ctx);

  // Synchronous legacy API — run production mode via deasync pattern: only use sync return from legacy when OFF/SHADOW
  // For AUTHORITATIVE, callers using async path should use calculateBestCartPromotionAsync
  const mode = process.env.DISCOUNT_ENGINE_V2_RESOLVER_MODE?.trim().toUpperCase();
  if (mode === 'AUTHORITATIVE') {
    console.warn(
      '[vendor-promotion-engine] calculateBestCartPromotion called synchronously while DISCOUNT_ENGINE_V2_RESOLVER_MODE=AUTHORITATIVE; use calculateBestCartPromotionAsync for resolver-backed results'
    );
  }
  if (mode !== 'AUTHORITATIVE') {
    return legacyCompute();
  }

  // AUTHORITATIVE sync callers: fall back to legacy compute (ecommerce order path uses async helper)
  return legacyCompute();
}

/** Async cart promotion resolution — supports AUTHORITATIVE resolver (E1/E2/E6). */
export async function calculateBestCartPromotionAsync(
  promotions: PromotionRow[],
  items: CartLineItem[],
  ctx: EvaluateContext = {},
  options?: { platformCouponCode?: string }
): Promise<ReturnType<typeof calculateBestCartPromotion>> {
  const originalTotal = cartLineSubtotal(items);
  const legacyResult = () => {
    const base = calculateBestCartPromotion(promotions, items, ctx);
    return base;
  };

  const resolverContext = vendorCartPromotionsToDiscountContext(promotions, items, ctx);
  if (options?.platformCouponCode) {
    resolverContext.couponCode = options.platformCouponCode.trim().toUpperCase();
    resolverContext.trigger = ctx.manualCode ? resolverContext.trigger : resolverContext.trigger;
  }

  const { value: cartResult } = await resolveWithProductionMode({
    label: ctx.manualCode || options?.platformCouponCode
      ? 'calculateBestCartPromotion-code'
      : 'calculateBestCartPromotion-auto',
    context: resolverContext,
    legacy: legacyResult,
    mapResolverToLegacy: (result) =>
      mapResolverResultToCartPromotion(result, originalTotal),
  });

  if (
    options?.platformCouponCode &&
    (cartResult.platformCouponDiscount ?? 0) <= 0 &&
    cartResult.totalSavings <= 0
  ) {
    const { resolveEcommercePlatformCoupon } = await import(
      '../lib/services/promotion-code-validation-service'
    );
    const coupon = await resolveEcommercePlatformCoupon(
      options.platformCouponCode,
      originalTotal
    );
    if (coupon && coupon.discountAmount > 0) {
      return {
        originalTotal,
        discountedTotal: Math.max(0, originalTotal - coupon.discountAmount),
        totalSavings: coupon.discountAmount,
        bestPromotion: null,
        allPromotions: [],
        platformCouponDiscount: coupon.discountAmount,
        platformCouponId: coupon.couponId,
      };
    }
  }

  return cartResult;
}

export const PROMOTION_DISCOUNT_TOLERANCE = 1;

export function discountsWithinTolerance(a: number, b: number): boolean {
  return Math.abs(a - b) <= PROMOTION_DISCOUNT_TOLERANCE;
}
