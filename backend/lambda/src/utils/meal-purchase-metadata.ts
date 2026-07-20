/**
 * Meal product purchase / subscription metadata (JSON in dietary_requirements).
 * Normalizes legacy deliveryType ↔ purchaseType for filters, pricing, and checkout.
 */

import type { PurchaseType } from '../constants/meal-product-enums';
import { PURCHASE_TYPE_VALUES } from '../constants/meal-product-enums';
import { mergeMealPlanCatalogForApi } from './meal-product-persistence';

export function parseMealCatalogDiet(planOrDiet: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!planOrDiet) return {};
  if (
    planOrDiet.plan_name != null ||
    planOrDiet.price_per_meal != null ||
    planOrDiet.vendor_id != null ||
    planOrDiet.purchase_type != null
  ) {
    const raw = planOrDiet.dietary_requirements ?? planOrDiet.metadata;
    return mergeMealPlanCatalogForApi(planOrDiet, raw);
  }
  const raw = planOrDiet.dietary_requirements ?? planOrDiet.metadata;
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

export function normalizePurchaseType(diet: Record<string, unknown>): PurchaseType {
  const p = String(diet.purchaseType || '').toUpperCase();
  if ((PURCHASE_TYPE_VALUES as readonly string[]).includes(p)) return p as PurchaseType;

  const leg = String(diet.deliveryType || '').toUpperCase();
  if (leg === 'WEEKLY_SUBSCRIPTION') return 'WEEKLY_PLAN';
  if (leg === 'MONTHLY_SUBSCRIPTION') return 'MONTHLY_PLAN';
  return 'ONE_TIME';
}

/** Persisted legacy field for chip filters + older clients */
export function legacyDeliveryTypeMirror(purchaseType: PurchaseType): 'ONE_TIME' | 'WEEKLY_SUBSCRIPTION' | 'MONTHLY_SUBSCRIPTION' {
  if (purchaseType === 'WEEKLY_PLAN') return 'WEEKLY_SUBSCRIPTION';
  if (purchaseType === 'MONTHLY_PLAN') return 'MONTHLY_SUBSCRIPTION';
  return 'ONE_TIME';
}

export function safePositiveInt(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  if (Number.isFinite(n) && n >= 1) return Math.min(n, 50);
  return fallback;
}

export function resolveMealsPerDeliveryFromDiet(diet: Record<string, unknown>): number {
  const col = diet.meals_per_delivery ?? diet.mealsPerDelivery;
  const direct = col;
  if (direct != null && direct !== '') {
    const n = typeof direct === 'number' ? direct : parseInt(String(direct), 10);
    if (Number.isFinite(n) && n >= 1) return Math.min(n, 50);
  }
  const preset = String(diet.mealsPerDeliveryPreset || '').toUpperCase();
  if (preset === '1') return 1;
  if (preset === '3') return 3;
  if (preset === 'CUSTOM') {
    const c = diet.mealsPerDeliveryCustom;
    const n = typeof c === 'number' ? c : parseInt(String(c || ''), 10);
    if (Number.isFinite(n) && n >= 1) return Math.min(n, 50);
  }
  return 2;
}

export function resolveMonthlyMealsPerDayFromDiet(diet: Record<string, unknown>): number {
  const preset = String(diet.mealsPerDayPreset || '').trim();
  if (preset === '1') return 1;
  if (preset === '3') return 3;
  if (preset === 'CUSTOM') {
    const n = parseInt(String(diet.mealsPerDayCustom || '').trim(), 10);
    if (Number.isFinite(n) && n >= 1) return Math.min(n, 50);
  }
  const md = diet.mealsPerDay;
  if (md != null && md !== '') {
    const n = typeof md === 'number' ? md : parseInt(String(md), 10);
    if (Number.isFinite(n) && n >= 1) return Math.min(n, 50);
  }
  return 2;
}

export function deliveryDaysCount(diet: Record<string, unknown>): number {
  const days = diet.deliveryDays;
  if (!Array.isArray(days) || days.length === 0) return 0;
  return days.filter((d) => typeof d === 'string' && d.trim()).length;
}

const ORDERED_DAY_CODES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** Maps vendor catalog values (e.g. MONDAY) to short codes used by subscription/session code. */
export function normalizeCatalogDeliveryDaysArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const upperMap: Record<string, string> = {
    MONDAY: 'mon',
    TUESDAY: 'tue',
    WEDNESDAY: 'wed',
    THURSDAY: 'thu',
    FRIDAY: 'fri',
    SATURDAY: 'sat',
    SUNDAY: 'sun',
  };
  const found = new Set<string>();
  for (const item of raw) {
    const s = String(item || '').trim();
    if (!s) continue;
    const u = s.toUpperCase();
    let code = upperMap[u];
    if (!code) {
      const low = s.toLowerCase().slice(0, 3);
      if ((ORDERED_DAY_CODES as readonly string[]).includes(low)) code = low;
    }
    if (code) found.add(code);
  }
  return ORDERED_DAY_CODES.filter((d) => found.has(d));
}

/** Validates subscription quantity matches vendor meal catalog preset (non-CUSTOM). */
export function assertQuantityMatchesVendorMealsPreset(
  diet: Record<string, unknown>,
  purchaseType: 'WEEKLY_PLAN' | 'MONTHLY_PLAN',
  qty: number,
): void {
  if (purchaseType === 'WEEKLY_PLAN') {
    const preset = String(diet.mealsPerDeliveryPreset || '').toUpperCase();
    if (preset === 'CUSTOM') {
      const customRaw = diet.mealsPerDeliveryCustom;
      const n = typeof customRaw === 'number' ? customRaw : parseInt(String(customRaw || '').trim(), 10);
      if (!Number.isFinite(n) || n < 1) {
        throw Object.assign(new Error('Meal plan custom meals-per-delivery is invalid'), { statusCode: 400 });
      }
      if (qty !== Math.min(50, n)) {
        throw Object.assign(new Error(`Meals per delivery must be ${n} for this meal plan`), { statusCode: 400 });
      }
      return;
    }
    const expected = resolveMealsPerDeliveryFromDiet(diet);
    if (qty !== expected) {
      throw Object.assign(new Error(`Meals per delivery must be ${expected} for this meal plan`), {
        statusCode: 400,
      });
    }
    return;
  }

  const preset = String(diet.mealsPerDayPreset || '').trim();
  if (preset === 'CUSTOM') {
    const n = parseInt(String(diet.mealsPerDayCustom || '').trim(), 10);
    if (!Number.isFinite(n) || n < 1) {
      throw Object.assign(new Error('Meal plan custom meals-per-day is invalid'), { statusCode: 400 });
    }
    if (qty !== Math.min(50, n)) {
      throw Object.assign(new Error(`Meals per day must be ${n} for this meal plan`), { statusCode: 400 });
    }
    return;
  }
  const expected = resolveMonthlyMealsPerDayFromDiet(diet);
  if (qty !== expected) {
    throw Object.assign(new Error(`Meals per delivery must be ${expected} for this monthly plan`), {
      statusCode: 400,
    });
  }
}
