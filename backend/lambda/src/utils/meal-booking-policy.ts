/**
 * Meal booking timing — vendor-defined per meal_plans row only (lead_time_hours, order_cutoff_time).
 */
import type {
  MealBookingPolicyEvaluateInput,
  MealBookingPolicyEvaluateResult,
  MealBookingPolicyBlockCode,
} from '@warmpawz/shared-types';

export const MEAL_BOOKING_TIMEZONE = 'Asia/Kolkata';
export const MEAL_LEAD_TIME_MIN_HOURS = 0;
export const MEAL_LEAD_TIME_MAX_HOURS = 72;

export const MEAL_PLAN_TIMING_MISSING_MSG =
  'Meal plan missing lead time or order cutoff; vendor must update the product.';

function isMealOrderProductionEnvironment(): boolean {
  const env = String(process.env.ENVIRONMENT || '').toLowerCase();
  const stage = String(process.env.STAGE || '').toLowerCase();
  return (
    process.env.NODE_ENV === 'production' ||
    env === 'prod' ||
    env === 'production' ||
    stage === 'prod' ||
    stage === 'production'
  );
}

/** Dev/UAT only: BYPASS_24H_MEAL_VALIDATION=true skips lead/cutoff checks. */
export function bypassMealLeadTimeValidationForDev(): boolean {
  if (isMealOrderProductionEnvironment()) return false;
  const v = String(process.env.BYPASS_24H_MEAL_VALIDATION || '')
    .toLowerCase()
    .trim();
  return v === 'true' || v === '1' || v === 'yes';
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function parseTimeHm(raw: string): { hours: number; minutes: number } | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(raw || '').trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

function formatTimeHm(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function parseDietaryJson(planRow: Record<string, unknown>): Record<string, unknown> {
  const raw = planRow.dietary_requirements;
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as unknown;
      return typeof o === 'object' && o != null && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

function localDateKey(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function zonedLocalParts(d: Date, timeZone: string): { y: number; m: number; day: number; h: number; min: number } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0);
  return { y: get('year'), m: get('month'), day: get('day'), h: get('hour'), min: get('minute') };
}

function isPastCutoffForSameDay(now: Date, cutoffTime: string, tz: string): boolean {
  const p = parseTimeHm(cutoffTime);
  if (!p) return false;
  const n = zonedLocalParts(now, tz);
  const cutoffMin = p.hours * 60 + p.minutes;
  const nowMin = n.h * 60 + n.min;
  return nowMin > cutoffMin;
}

export function clampLeadTimeHours(hours: number): number {
  return clamp(Math.round(hours), MEAL_LEAD_TIME_MIN_HOURS, MEAL_LEAD_TIME_MAX_HOURS);
}

/** @deprecated Use clampLeadTimeHours — kept for any stale imports during transition */
export function clampLeadTimeHoursForPlatform(hours: number, _platform?: unknown): number {
  return clampLeadTimeHours(hours);
}

export function extractMealPlanTiming(planRow: Record<string, unknown>): {
  leadTimeHours: number | null;
  orderCutoffTime: string | null;
} {
  const diet = parseDietaryJson(planRow);
  const leadRaw =
    planRow.lead_time_hours != null
      ? Number(planRow.lead_time_hours)
      : planRow.leadTimeHours != null
        ? Number(planRow.leadTimeHours)
        : diet.leadTimeHours != null
          ? Number(diet.leadTimeHours)
          : null;
  const leadTimeHours =
    leadRaw != null && Number.isFinite(leadRaw) ? clampLeadTimeHours(leadRaw) : null;
  const cutoffRaw =
    (typeof planRow.order_cutoff_time === 'string' && planRow.order_cutoff_time) ||
    (typeof planRow.orderCutoffTime === 'string' && planRow.orderCutoffTime) ||
    (typeof diet.orderCutoffTime === 'string' && diet.orderCutoffTime) ||
    null;
  const parsedCutoff = cutoffRaw ? parseTimeHm(cutoffRaw) : null;
  const orderCutoffTime = parsedCutoff
    ? formatTimeHm(parsedCutoff.hours, parsedCutoff.minutes)
    : null;
  return { leadTimeHours, orderCutoffTime };
}

export function requireMealPlanTiming(planRow: Record<string, unknown>):
  | { ok: true; leadTimeHours: number; orderCutoffTime: string }
  | { ok: false; error: string } {
  const { leadTimeHours, orderCutoffTime } = extractMealPlanTiming(planRow);
  if (leadTimeHours == null) {
    return { ok: false, error: MEAL_PLAN_TIMING_MISSING_MSG };
  }
  if (!orderCutoffTime) {
    return { ok: false, error: MEAL_PLAN_TIMING_MISSING_MSG };
  }
  return { ok: true, leadTimeHours, orderCutoffTime };
}

/** Same-day delivery is possible when lead time is at most 24 hours. */
export function resolveSameDayAllowedForPlan(leadTimeHours: number): boolean {
  return leadTimeHours <= 24;
}

export function evaluateMealBookingForPlan(
  input: MealBookingPolicyEvaluateInput,
  planRow: Record<string, unknown>,
): MealBookingPolicyEvaluateResult {
  const tz = MEAL_BOOKING_TIMEZONE;
  const now = input.now ? new Date(input.now) : new Date();

  if (bypassMealLeadTimeValidationForDev()) {
    return {
      allowed: true,
      earliestDeliveryAt: now.toISOString(),
      effectiveLeadTimeHours: 0,
      effectiveOrderCutoffTime: '23:59',
      sameDayAllowed: true,
      source: { leadTime: 'meal_plan', sameDay: 'meal_plan', cutoff: 'meal_plan' },
    };
  }

  const timing = requireMealPlanTiming(planRow);
  if (!timing.ok) {
    return {
      allowed: false,
      earliestDeliveryAt: now.toISOString(),
      effectiveLeadTimeHours: 0,
      effectiveOrderCutoffTime: '',
      sameDayAllowed: false,
      blockCode: 'MISSING_PLAN_TIMING',
      message: timing.error,
      source: { leadTime: 'meal_plan', sameDay: 'meal_plan', cutoff: 'meal_plan' },
    };
  }

  const { leadTimeHours, orderCutoffTime } = timing;
  const sameDayAllowed = resolveSameDayAllowedForPlan(leadTimeHours);
  const earliest = new Date(now.getTime() + leadTimeHours * 3600000);
  const delivery = new Date(input.requestedDeliveryAt);
  const deliveryKey = localDateKey(delivery, tz);
  const nowKey = localDateKey(now, tz);
  const isSameCalendarDay = deliveryKey === nowKey;

  let blockCode: MealBookingPolicyBlockCode | undefined;
  let message: string | undefined;

  if (isSameCalendarDay && !sameDayAllowed) {
    blockCode = 'SAME_DAY_NOT_ALLOWED';
    message = `Same-day delivery is not available for this plan. Order at least ${leadTimeHours} hours ahead.`;
  } else if (isSameCalendarDay && sameDayAllowed && isPastCutoffForSameDay(now, orderCutoffTime, tz)) {
    blockCode = 'SAME_DAY_CUTOFF_PASSED';
    message = `Today's order cutoff (${orderCutoffTime}) has passed. Choose a later delivery date.`;
  }

  if (!blockCode && delivery.getTime() < earliest.getTime()) {
    blockCode = 'LEAD_TIME_TOO_SHORT';
    message = `Place your order at least ${leadTimeHours} hours before delivery.`;
  }

  return {
    allowed: !blockCode,
    earliestDeliveryAt: earliest.toISOString(),
    effectiveLeadTimeHours: leadTimeHours,
    effectiveOrderCutoffTime: orderCutoffTime,
    sameDayAllowed,
    blockCode,
    message,
    source: { leadTime: 'meal_plan', sameDay: 'meal_plan', cutoff: 'meal_plan' },
  };
}
