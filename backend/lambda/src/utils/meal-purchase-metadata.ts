/**
 * Meal product purchase / subscription metadata (JSON in dietary_requirements / products.metadata).
 * Normalizes legacy deliveryType ↔ purchaseType for filters, pricing, and checkout.
 */

import type { PurchaseType } from '../constants/meal-product-enums';
import { PURCHASE_TYPE_VALUES } from '../constants/meal-product-enums';

export function parseMealCatalogDiet(planOrDiet: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!planOrDiet) return {};
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
  const direct = diet.mealsPerDelivery;
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
