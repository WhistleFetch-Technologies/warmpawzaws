/**
 * Meal booking policy — platform settings + per-plan overrides (meal_plans columns).
 */
import { query } from '../database/rds-connection';
import type {
  MealBookingPolicyEvaluateInput,
  MealBookingPolicyEvaluateResult,
  MealBookingPolicyRulesV1,
  MealBookingPolicyBlockCode,
  MealPurchaseType,
  MealLeadTimeBounds,
} from '@warmpawz/shared-types';

export const MEAL_BOOKING_PLATFORM_POLICY_KEY = 'meal:booking:platform_policy';

export const DEFAULT_MEAL_BOOKING_POLICY: MealBookingPolicyRulesV1 = {
  schemaVersion: 1,
  timezone: 'Asia/Kolkata',
  leadTime: { defaultHours: 24, minHours: 0, maxHours: 72 },
  orderCutoff: { time: '18:00', timezone: 'Asia/Kolkata', appliesToSameDayDelivery: false },
  sameDay: {
    enabled: true,
    minLeadTimeHours: 2,
    cutoff: { time: '11:00', timezone: 'Asia/Kolkata', appliesToSameDayDelivery: true },
    maxOrdersPerDay: null,
  },
  deliverySlot: { mode: 'calendar_day', excludeWeekends: false },
  byPurchaseType: [
    { purchaseType: 'ONE_OFF', leadTimeHours: 24 },
    { purchaseType: 'WEEKLY_PLAN', leadTimeHours: 24, rescheduleMinHoursBefore: 12 },
    { purchaseType: 'MONTHLY_PLAN', leadTimeHours: 24, rescheduleMinHoursBefore: 12 },
  ],
  messages: {
    customerBlockTemplate:
      'Place your order at least {{hours}} hours before delivery.',
    vendorHintTemplate: 'Customers must order at least {{hours}}h before delivery (cutoff {{cutoff}}).',
  },
  devBypassLeadTime: false,
};

/** Dev/UAT: policy engine on; prod until MEAL_BOOKING_POLICY_ENABLED=true uses legacy plan-only check. */
export function isMealBookingPolicyRolloutEnabled(): boolean {
  const env = String(process.env.ENVIRONMENT || process.env.STAGE || '').toLowerCase();
  const nodeProd = process.env.NODE_ENV === 'production';
  const isProd = env === 'prod' || env === 'production' || (nodeProd && env !== 'dev' && env !== 'uat');
  if (isProd) {
    return String(process.env.MEAL_BOOKING_POLICY_ENABLED || '').toLowerCase() === 'true';
  }
  return true;
}

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

export function devBypassMealLeadTimeFromPolicy(policy: MealBookingPolicyRulesV1): boolean {
  if (isMealOrderProductionEnvironment()) return false;
  return !!policy.devBypassLeadTime;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function parseTimeHm(raw: string): { hours: number; minutes: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(raw || '').trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

/** Calendar date YYYY-MM-DD in timezone */
function localDateKey(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function isWeekendInTz(d: Date, timeZone: string): boolean {
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(d);
  return weekday === 'Sat' || weekday === 'Sun';
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

/** Approximate UTC instant for local date+time in IANA zone (good enough for lead/cutoff). */
function zonedLocalToUtc(
  y: number,
  m: number,
  day: number,
  h: number,
  min: number,
  timeZone: string,
): Date {
  const guess = new Date(Date.UTC(y, m - 1, day, h, min, 0));
  const p = zonedLocalParts(guess, timeZone);
  const diffMin = (h - p.h) * 60 + (min - p.min);
  const dayDiff = day - p.day;
  return new Date(guess.getTime() + dayDiff * 86400000 + diffMin * 60000);
}

function purchaseTypeOverride(
  policy: MealBookingPolicyRulesV1,
  purchaseType: MealPurchaseType,
): MealBookingPolicyRulesV1['byPurchaseType'] extends (infer U)[] | undefined ? U | undefined : undefined {
  const pt = String(purchaseType || 'ONE_OFF').toUpperCase();
  const list = policy.byPurchaseType || [];
  return (
    list.find((x) => String(x.purchaseType).toUpperCase() === pt) ||
    list.find((x) => String(x.purchaseType).toUpperCase() === 'ALL')
  );
}

export function validateMealBookingPolicyRules(
  raw: unknown,
): { ok: true; policy: MealBookingPolicyRulesV1 } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Policy must be an object' };
  }
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== 1) {
    return { ok: false, error: 'schemaVersion must be 1' };
  }
  const lead = o.leadTime as MealLeadTimeBounds | undefined;
  if (!lead || typeof lead.defaultHours !== 'number' || typeof lead.minHours !== 'number' || typeof lead.maxHours !== 'number') {
    return { ok: false, error: 'leadTime.defaultHours, minHours, maxHours required' };
  }
  if (lead.minHours > lead.maxHours) {
    return { ok: false, error: 'leadTime.minHours cannot exceed maxHours' };
  }
  const orderCutoff = o.orderCutoff as { time?: string } | undefined;
  if (!orderCutoff?.time || !parseTimeHm(orderCutoff.time)) {
    return { ok: false, error: 'orderCutoff.time must be HH:mm' };
  }
  const policy = {
    ...DEFAULT_MEAL_BOOKING_POLICY,
    ...(o as MealBookingPolicyRulesV1),
    schemaVersion: 1 as const,
  };
  return { ok: true, policy };
}

export async function fetchPlatformMealBookingPolicy(): Promise<MealBookingPolicyRulesV1> {
  try {
    const r = await query(
      `SELECT setting_value FROM platform_settings WHERE setting_key = $1 LIMIT 1`,
      [MEAL_BOOKING_PLATFORM_POLICY_KEY],
    );
    if (!r.rows?.length) return { ...DEFAULT_MEAL_BOOKING_POLICY };
    const parsed = validateMealBookingPolicyRules((r.rows[0] as { setting_value: unknown }).setting_value);
    return parsed.ok ? parsed.policy : { ...DEFAULT_MEAL_BOOKING_POLICY };
  } catch {
    return { ...DEFAULT_MEAL_BOOKING_POLICY };
  }
}

export async function savePlatformMealBookingPolicy(
  policy: MealBookingPolicyRulesV1,
): Promise<void> {
  const jsonStr = JSON.stringify(policy);
  const existing = await query(
    `SELECT id FROM platform_settings WHERE setting_key = $1 LIMIT 1`,
    [MEAL_BOOKING_PLATFORM_POLICY_KEY],
  );
  if (existing.rows.length > 0) {
    await query(
      `UPDATE platform_settings SET setting_value = $1::jsonb, updated_at = NOW() WHERE setting_key = $2`,
      [jsonStr, MEAL_BOOKING_PLATFORM_POLICY_KEY],
    );
  } else {
    await query(
      `INSERT INTO platform_settings (setting_key, setting_value, setting_type, description, is_public, created_at, updated_at)
       VALUES ($1, $2::jsonb, 'object', $3, false, NOW(), NOW())`,
      [
        MEAL_BOOKING_PLATFORM_POLICY_KEY,
        jsonStr,
        'Platform meal order lead time, same-day delivery, and cutoff rules',
      ],
    );
  }
}

export function clampLeadTimeHoursForPlatform(
  hours: number,
  platform: MealBookingPolicyRulesV1,
): number {
  return clamp(Math.round(hours), platform.leadTime.minHours, platform.leadTime.maxHours);
}

export interface MealPlanPolicyOverrides {
  leadTimeHours?: number | null;
  orderCutoffTime?: string | null;
}

export function resolveEffectiveLeadTimeHours(
  platform: MealBookingPolicyRulesV1,
  plan: MealPlanPolicyOverrides,
  purchaseType: MealPurchaseType,
): { hours: number; source: 'meal_plan' | 'purchase_type' | 'platform' } {
  const pt = purchaseTypeOverride(platform, purchaseType);
  let hours = platform.leadTime.defaultHours;
  let source: 'meal_plan' | 'purchase_type' | 'platform' = 'platform';
  if (pt?.leadTimeHours != null && Number.isFinite(Number(pt.leadTimeHours))) {
    hours = Number(pt.leadTimeHours);
    source = 'purchase_type';
  }
  if (plan.leadTimeHours != null && Number.isFinite(Number(plan.leadTimeHours))) {
    hours = Number(plan.leadTimeHours);
    source = 'meal_plan';
  }
  return { hours: clampLeadTimeHoursForPlatform(hours, platform), source };
}

export function resolveSameDayAllowed(
  platform: MealBookingPolicyRulesV1,
  effectiveLeadHours: number,
  planLeadHours: number | null | undefined,
): boolean {
  if (!platform.sameDay.enabled) return false;
  const planH = planLeadHours != null ? Number(planLeadHours) : null;
  const lead = planH != null && Number.isFinite(planH) ? planH : effectiveLeadHours;
  const minSame = platform.sameDay.minLeadTimeHours ?? platform.leadTime.minHours;
  return lead <= Math.max(platform.leadTime.defaultHours, minSame) || lead <= minSame + 0.001;
}

function isPastCutoffForSameDay(now: Date, cutoffTime: string, tz: string): boolean {
  const p = parseTimeHm(cutoffTime);
  if (!p) return false;
  const n = zonedLocalParts(now, tz);
  const cutoffMin = p.hours * 60 + p.minutes;
  const nowMin = n.h * 60 + n.min;
  return nowMin > cutoffMin;
}

export function evaluateMealBookingPolicy(
  platform: MealBookingPolicyRulesV1,
  plan: MealPlanPolicyOverrides,
  input: MealBookingPolicyEvaluateInput,
): MealBookingPolicyEvaluateResult {
  const tz = platform.timezone || 'Asia/Kolkata';
  const now = input.now ? new Date(input.now) : new Date();
  const purchaseType = (String(input.purchaseType || 'ONE_OFF').toUpperCase() as MealPurchaseType) || 'ONE_OFF';

  if (devBypassMealLeadTimeFromPolicy(platform)) {
    return {
      allowed: true,
      earliestDeliveryAt: now.toISOString(),
      effectiveLeadTimeHours: 0,
      effectiveOrderCutoffTime: platform.orderCutoff.time,
      sameDayAllowed: true,
      source: { leadTime: 'platform', sameDay: 'platform', cutoff: 'platform' },
    };
  }

  const { hours: effectiveLeadTimeHours, source: leadSource } = resolveEffectiveLeadTimeHours(
    platform,
    plan,
    purchaseType,
  );
  const planLead = plan.leadTimeHours != null ? Number(plan.leadTimeHours) : null;
  const sameDayAllowed = resolveSameDayAllowed(platform, effectiveLeadTimeHours, planLead);

  const cutoffTime =
    (plan.orderCutoffTime && parseTimeHm(plan.orderCutoffTime) ? plan.orderCutoffTime : null) ||
    platform.orderCutoff.time;

  const earliest = new Date(now.getTime() + effectiveLeadTimeHours * 3600000);
  const delivery = new Date(input.requestedDeliveryAt);
  const deliveryKey = localDateKey(delivery, tz);
  const nowKey = localDateKey(now, tz);
  const isSameCalendarDay = deliveryKey === nowKey;

  let blockCode: MealBookingPolicyBlockCode | undefined;
  let message: string | undefined;

  if (platform.deliverySlot?.excludeWeekends && isWeekendInTz(delivery, tz)) {
    blockCode = 'WEEKEND_BLOCKED';
    message = 'Delivery is not available on weekends for this plan.';
  } else if (isSameCalendarDay && !sameDayAllowed) {
    blockCode = 'SAME_DAY_NOT_ALLOWED';
    message = `Same-day delivery is not available. Order at least ${effectiveLeadTimeHours} hours ahead.`;
  } else if (isSameCalendarDay && sameDayAllowed) {
    const sameDayCutoff =
      platform.sameDay.cutoff?.time && parseTimeHm(platform.sameDay.cutoff.time)
        ? platform.sameDay.cutoff.time
        : cutoffTime;
    if (isPastCutoffForSameDay(now, sameDayCutoff, tz)) {
      blockCode = 'SAME_DAY_CUTOFF_PASSED';
      message = `Today's order cutoff (${sameDayCutoff}) has passed. Choose a later delivery date.`;
    }
  }

  if (!blockCode && delivery.getTime() < earliest.getTime()) {
    blockCode = 'LEAD_TIME_TOO_SHORT';
    const tpl =
      platform.messages?.customerBlockTemplate ||
      'Place your order at least {{hours}} hours before delivery.';
    message = tpl.replace(/\{\{hours\}\}/g, String(effectiveLeadTimeHours));
  }

  return {
    allowed: !blockCode,
    earliestDeliveryAt: earliest.toISOString(),
    effectiveLeadTimeHours,
    effectiveOrderCutoffTime: cutoffTime,
    sameDayAllowed,
    blockCode,
    message,
    source: {
      leadTime: leadSource === 'meal_plan' ? 'meal_plan' : 'platform',
      sameDay: 'platform',
      cutoff: plan.orderCutoffTime ? 'meal_plan' : 'platform',
    },
  };
}

export async function evaluateMealBookingForPlan(
  input: MealBookingPolicyEvaluateInput & { vendorId?: string },
  planRow: Record<string, unknown>,
): Promise<MealBookingPolicyEvaluateResult> {
  const platform = await fetchPlatformMealBookingPolicy();
  const plan: MealPlanPolicyOverrides = {
    leadTimeHours:
      planRow.lead_time_hours != null
        ? Number(planRow.lead_time_hours)
        : planRow.leadTimeHours != null
          ? Number(planRow.leadTimeHours)
          : null,
    orderCutoffTime:
      (typeof planRow.order_cutoff_time === 'string' && planRow.order_cutoff_time) ||
      (typeof planRow.orderCutoffTime === 'string' && planRow.orderCutoffTime) ||
      null,
  };
  return evaluateMealBookingPolicy(platform, plan, input);
}
