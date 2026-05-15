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
export function resolveMealPurchaseSubtotalInr(
  plan: Record<string, unknown> | null | undefined,
  quantity: number,
  opts?: { weeklyEffectiveDeliveryDays?: number },
): number {
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
    let deliveries = Math.max(1, deliveryDaysCount(diet));
    const eff = opts?.weeklyEffectiveDeliveryDays;
    if (eff != null && Number.isFinite(eff) && eff >= 1) {
      deliveries = Math.min(7, Math.floor(eff));
    }
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

function parseMealOrderPurchaseSnapshot(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as unknown;
      return typeof o === 'object' && o != null && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

/**
 * Subscription parent `meal_orders` row stores the full billing-cycle bundle (food + fees).
 * Customer lists should show this row as one session — divide displayed line + total by session count.
 */
export function resolveCustomerMealPlanOrderDisplayTotals(
  order: {
    purchase_snapshot?: unknown;
    subtotal?: unknown;
    delivery_fee?: unknown;
    platform_fee?: unknown;
    total_amount?: unknown;
    quantity?: unknown;
  },
  plan: Record<string, unknown> | null | undefined,
): { subtotal: number; total: number } {
  const base = resolveMealCheckoutTotalInr(order, plan);
  const snap = parseMealOrderPurchaseSnapshot(order.purchase_snapshot);
  const role = String(snap.subscriptionVendorBookingRole || '');
  const ts = Number(snap.subscriptionTotalSessions);
  const n = Number.isFinite(ts) && ts >= 1 ? Math.floor(ts) : 0;
  if (role === 'parent' && n >= 1) {
    return {
      subtotal: roundMoney(base.subtotal / n),
      total: roundMoney(base.total / n),
    };
  }
  return base;
}
