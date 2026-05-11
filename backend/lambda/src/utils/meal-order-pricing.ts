/** Shared meal checkout math: legacy meal_plans use `price`; newer rows use `price_per_meal`. */

import {
  deliveryDaysCount,
  normalizePurchaseType,
  parseMealCatalogDiet,
  resolveMealsPerDeliveryFromDiet,
  resolveMonthlyMealsPerDayFromDiet,
} from './meal-purchase-metadata';

export function safeMoney(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function mealPlanUnitPriceInr(plan: Record<string, unknown> | null | undefined): number {
  if (!plan) return 0;
  for (const k of ['price_per_meal', 'price', 'amount'] as const) {
    const v = plan[k];
    if (v == null || v === '') continue;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

/**
 * Checkout subtotal for meal catalog rows (respects purchaseType + subscription pricing in dietary JSON).
 * ONE_TIME: base unit × qty
 * WEEKLY_PLAN: (per-delivery price × deliveries/week) × qty — first billing cycle estimate
 * MONTHLY_PLAN: (per-day price × 30) × qty — monthly estimate
 */
export function resolveMealPurchaseSubtotalInr(plan: Record<string, unknown> | null | undefined, quantity: number): number {
  if (!plan) return 0;
  const qty = Math.max(1, Math.floor(quantity || 1));
  const diet = parseMealCatalogDiet(plan);
  const pt = normalizePurchaseType(diet);
  const baseUnit = mealPlanUnitPriceInr(plan);

  if (pt === 'ONE_TIME') {
    return baseUnit > 0 ? roundMoney(baseUnit * qty) : 0;
  }

  const subPrice = safeMoney(diet.subscriptionPrice);

  if (pt === 'WEEKLY_PLAN') {
    const deliveries = Math.max(1, deliveryDaysCount(diet));
    const mpd = resolveMealsPerDeliveryFromDiet(diet);
    const perDelivery = subPrice > 0 ? subPrice : roundMoney(baseUnit * mpd);
    const weekly = roundMoney(perDelivery * deliveries);
    return weekly > 0 ? roundMoney(weekly * qty) : 0;
  }

  if (pt === 'MONTHLY_PLAN') {
    const mealsDay = resolveMonthlyMealsPerDayFromDiet(diet);
    const perDay = subPrice > 0 ? subPrice : roundMoney(baseUnit * mealsDay);
    const monthly = roundMoney(perDay * 30);
    return monthly > 0 ? roundMoney(monthly * qty) : 0;
  }

  return baseUnit > 0 ? roundMoney(baseUnit * qty) : 0;
}

/** Meal line total (vendor listing): prefer persisted subtotal; else plan unit × qty. */
export function resolveMealLineSubtotalInr(
  order: { subtotal?: unknown; quantity?: unknown },
  plan: Record<string, unknown> | null | undefined,
): number {
  const stored = safeMoney(order.subtotal);
  if (stored > 0) return roundMoney(stored);

  const qtyRaw = order.quantity;
  let qty = 1;
  if (qtyRaw != null && qtyRaw !== '') {
    const n = typeof qtyRaw === 'number' ? qtyRaw : parseInt(String(qtyRaw), 10);
    if (Number.isFinite(n) && n >= 1) qty = Math.floor(n);
  }

  const purchaseBased = resolveMealPurchaseSubtotalInr(plan ?? {}, qty);
  if (purchaseBased > 0) return purchaseBased;

  const unit = mealPlanUnitPriceInr(plan);
  return unit > 0 ? roundMoney(unit * qty) : 0;
}

/** Customer grand total: prefer persisted total_amount when > 0; else subtotal + delivery + platform (after resolving subtotal). */
export function resolveMealCheckoutTotalInr(
  order: {
    subtotal?: unknown;
    delivery_fee?: unknown;
    platform_fee?: unknown;
    total_amount?: unknown;
    quantity?: unknown;
  },
  plan: Record<string, unknown> | null | undefined,
): { subtotal: number; total: number } {
  const subtotal = resolveMealLineSubtotalInr(order, plan);
  const delivery = safeMoney(order.delivery_fee);
  const platform = safeMoney(order.platform_fee);
  const storedTotal = safeMoney(order.total_amount);
  const computed = roundMoney(subtotal + delivery + platform);
  const total = storedTotal > 0 ? roundMoney(storedTotal) : computed;
  return { subtotal, total };
}
