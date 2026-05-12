/**
 * Vendor catalog constraints for meal subscription checkout (aligned with backend meal-purchase-metadata).
 */

import { parsePlanDietary } from '@/lib/meal-plan-catalog-display';

const ORDERED_DAY_CODES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** Maps vendor DAY_OF_WEEK_OPTIONS (MONDAY, …) to short codes used in subscription APIs. */
export function normalizeVendorDeliveryDayCodes(raw: unknown): string[] {
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
    let code = upperMap[s.toUpperCase()];
    if (!code) {
      const low = s.toLowerCase().slice(0, 3);
      if ((ORDERED_DAY_CODES as readonly string[]).includes(low)) code = low;
    }
    if (code) found.add(code);
  }
  return ORDERED_DAY_CODES.filter((d) => found.has(d));
}

export function vendorWeeklyDeliveryDaysFromPlan(plan: Record<string, unknown> | null): string[] {
  if (!plan) return [];
  const d = parsePlanDietary(plan);
  return normalizeVendorDeliveryDayCodes(d.deliveryDays);
}

export function vendorMealsPerDeliveryFromCatalog(diet: Record<string, unknown>): number {
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

export function vendorMonthlyMealsPerDayFromCatalog(diet: Record<string, unknown>): number {
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

export function vendorQuantityDefaultFromPlan(
  plan: Record<string, unknown>,
  purchaseType: 'WEEKLY_PLAN' | 'MONTHLY_PLAN',
): number {
  const d = parsePlanDietary(plan);
  return purchaseType === 'WEEKLY_PLAN'
    ? vendorMealsPerDeliveryFromCatalog(d)
    : vendorMonthlyMealsPerDayFromCatalog(d);
}

/** When false, customer may edit meals quantity (vendor CUSTOM preset). */
export function vendorLocksMealsQuantity(
  plan: Record<string, unknown>,
  purchaseType: 'WEEKLY_PLAN' | 'MONTHLY_PLAN',
): boolean {
  const d = parsePlanDietary(plan);
  if (purchaseType === 'WEEKLY_PLAN') {
    return String(d.mealsPerDeliveryPreset || '').toUpperCase() !== 'CUSTOM';
  }
  return String(d.mealsPerDayPreset || '').trim() !== 'CUSTOM';
}

/** Vendor monthly nutrition plan cadence (`DELIVERY_FREQUENCY_OPTIONS`). */
export function vendorMonthlyDeliveryFrequencyFromPlan(plan: Record<string, unknown> | null): string | null {
  if (!plan) return null;
  const d = parsePlanDietary(plan);
  const f = String(d.deliveryFrequency || '').toUpperCase();
  if (f === 'DAILY' || f === 'ALTERNATE_DAYS' || f === 'TWICE_WEEKLY' || f === 'WEEKLY') return f;
  return null;
}

/** Recommended signup length in weeks (weekly plans); null if unset. */
export function vendorRecommendedPlanWeeksFromPlan(plan: Record<string, unknown> | null): number | null {
  if (!plan) return null;
  const d = parsePlanDietary(plan);
  const sub = d.subscriptionConfig;
  const raw =
    d.recommendedPlanLengthWeeks ??
    (typeof sub === 'object' && sub != null && !Array.isArray(sub)
      ? (sub as Record<string, unknown>).recommendedPlanLengthWeeks
      : undefined);
  const n = Number(raw);
  if (n === 1 || n === 2 || n === 4) return n;
  return null;
}
