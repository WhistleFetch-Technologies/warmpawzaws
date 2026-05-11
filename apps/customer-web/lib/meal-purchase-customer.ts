/**
 * Customer-facing copy + pricing hints for meal purchase modes (no backend jargon in UI strings).
 */

export type CustomerPurchaseType = 'ONE_TIME' | 'WEEKLY_PLAN' | 'MONTHLY_PLAN';

const DAY_LABEL: Record<string, string> = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun',
};

const FREQ_LABEL: Record<string, string> = {
  DAILY: 'Daily deliveries',
  ALTERNATE_DAYS: 'Every other day',
  TWICE_WEEKLY: 'Twice a week',
  WEEKLY: 'Once a week',
};

/** Vendor catalog `deliveryFrequency` (monthly nutrition plans). */
export function monthlyDeliveryFrequencyCustomerLabel(code: string): string {
  const u = String(code || '').toUpperCase();
  return FREQ_LABEL[u] || 'Recurring deliveries';
}

export function normalizeCustomerPurchaseType(diet: Record<string, unknown>): CustomerPurchaseType {
  const p = String(diet.purchaseType || '').toUpperCase();
  if (p === 'WEEKLY_PLAN' || p === 'MONTHLY_PLAN' || p === 'ONE_TIME') return p as CustomerPurchaseType;
  const leg = String(diet.deliveryType || '').toUpperCase();
  if (leg === 'WEEKLY_SUBSCRIPTION') return 'WEEKLY_PLAN';
  if (leg === 'MONTHLY_SUBSCRIPTION') return 'MONTHLY_PLAN';
  return 'ONE_TIME';
}

function safeNum(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function mealsPerDelivery(diet: Record<string, unknown>): number {
  const d = diet.mealsPerDelivery;
  if (d != null && d !== '') {
    const n = typeof d === 'number' ? d : parseInt(String(d), 10);
    if (Number.isFinite(n) && n >= 1) return Math.min(n, 50);
  }
  const preset = String(diet.mealsPerDeliveryPreset || '').toUpperCase();
  if (preset === '1') return 1;
  if (preset === '3') return 3;
  if (preset === 'CUSTOM') {
    const n = parseInt(String(diet.mealsPerDeliveryCustom || '').trim(), 10);
    if (Number.isFinite(n) && n >= 1) return Math.min(n, 50);
  }
  return 2;
}

function mealsPerDayMonthly(diet: Record<string, unknown>): number {
  const preset = String(diet.mealsPerDayPreset || '').trim();
  if (preset === '1') return 1;
  if (preset === '3') return 3;
  if (preset === 'CUSTOM') {
    const n = parseInt(String(diet.mealsPerDayCustom || '').trim(), 10);
    if (Number.isFinite(n) && n >= 1) return Math.min(n, 50);
  }
  const md = diet.mealsPerDay;
  if (md != null) {
    const n = typeof md === 'number' ? md : parseInt(String(md), 10);
    if (Number.isFinite(n) && n >= 1) return Math.min(n, 50);
  }
  return 2;
}

function deliveryDaysList(diet: Record<string, unknown>): string[] {
  const days = diet.deliveryDays;
  if (!Array.isArray(days)) return [];
  return days.map((d) => String(d).toUpperCase()).filter(Boolean);
}

export function customerPurchaseHeadline(pt: CustomerPurchaseType): string {
  if (pt === 'WEEKLY_PLAN') return 'Weekly meal plan';
  if (pt === 'MONTHLY_PLAN') return 'Monthly nutrition plan';
  return 'Buy once';
}

export function customerPricingLine(plan: Record<string, unknown>, diet: Record<string, unknown>): string {
  const pt = normalizeCustomerPurchaseType(diet);
  const subPrice = safeNum(diet.subscriptionPrice);

  if (pt === 'ONE_TIME') {
    const u = safeNum(plan.price_per_meal) || safeNum(plan.pricePerMeal) || safeNum(plan.price);
    return u > 0 ? `₹${Math.round(u).toLocaleString('en-IN')} one-time` : '';
  }

  if (pt === 'WEEKLY_PLAN') {
    const days = deliveryDaysList(diet);
    const nDel = days.length > 0 ? days.length : 1;
    const mpd = mealsPerDelivery(diet);
    const unit = safeNum(plan.price_per_meal) || safeNum(plan.pricePerMeal) || safeNum(plan.price);
    const perDelivery = subPrice > 0 ? subPrice : unit > 0 ? Math.round(unit * mpd * 100) / 100 : 0;
    const weekly = perDelivery > 0 ? Math.round(perDelivery * nDel) : 0;
    if (weekly > 0) return `₹${weekly.toLocaleString('en-IN')}/week`;
    return '';
  }

  const mealsDay = mealsPerDayMonthly(diet);
  const unitMo = safeNum(plan.price_per_meal) || safeNum(plan.pricePerMeal) || safeNum(plan.price);
  const perDay = subPrice > 0 ? subPrice : unitMo > 0 ? Math.round(unitMo * mealsDay * 100) / 100 : 0;
  const monthly = perDay > 0 ? Math.round(perDay * 30) : 0;
  if (monthly > 0) return `₹${monthly.toLocaleString('en-IN')}/month`;
  const fallback = safeNum(plan.price_per_meal) || safeNum(plan.pricePerMeal) || safeNum(plan.price);
  return fallback > 0 ? `₹${Math.round(fallback).toLocaleString('en-IN')}` : '';
}

export function customerBenefitBullets(pt: CustomerPurchaseType, diet: Record<string, unknown>): string[] {
  if (pt === 'ONE_TIME') {
    return ['Great for trying a new recipe', 'No recurring commitment'];
  }
  if (pt === 'WEEKLY_PLAN') {
    const days = deliveryDaysList(diet);
    const dayPart =
      days.length > 0 ? `Delivered ${days.map((d) => DAY_LABEL[d] || d).join(', ')}` : 'Scheduled weekly deliveries';
    const md = mealsPerDelivery(diet);
    const pause = diet.pauseAllowed !== false ? 'Pause anytime' : '';
    const out = [dayPart, `${md} meal${md === 1 ? '' : 's'} per delivery`];
    if (pause) out.push(pause);
    return out;
  }
  const freq = String(diet.deliveryFrequency || '').toUpperCase();
  const freqLabel = FREQ_LABEL[freq] || 'Recurring deliveries';
  const m = mealsPerDayMonthly(diet);
  const cancel = diet.cancelAnytime !== false ? 'Cancel anytime' : '';
  const out = [freqLabel, `${m} meal${m === 1 ? '' : 's'} per day`, 'Consistent nutrition'];
  if (cancel) out.push(cancel);
  return out;
}
