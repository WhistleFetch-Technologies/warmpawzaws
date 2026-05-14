/**
 * Single source for subscription cadence math (pricing cycles + session cursor).
 * Keeps order-preview, checkout totals, and session generation aligned.
 */

export function asScheduleJson(v: unknown): Record<string, unknown> | null {
  if (!v) return null;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}

function addDays(d: Date, n: number): Date {
  const o = new Date(d);
  o.setDate(o.getDate() + n);
  return o;
}

function addMonths(d: Date, n: number): Date {
  const o = new Date(d);
  o.setMonth(o.getMonth() + n);
  return o;
}

const MONTHLY_VENDOR_FREQ = new Set(['DAILY', 'ALTERNATE_DAYS', 'TWICE_WEEKLY', 'WEEKLY']);

function normalizeMonthlyMode(schedule: Record<string, unknown> | null): 'fixed_sessions' | 'recurring_monthly' {
  const m = String(schedule?.monthlyMode ?? 'recurring_monthly')
    .trim()
    .toLowerCase();
  if (m === 'fixed_sessions') return 'fixed_sessions';
  return 'recurring_monthly';
}

/** Maps vendor/API weekday tokens to JS `Date#getDay()` (Sun=0 … Sat=6). */
export function parseJsWeekdayTargetsFromSchedule(schedule: Record<string, unknown> | null): number[] {
  const sch = schedule || {};
  const raw = Array.isArray(sch.weekdays) ? sch.weekdays : [];
  const upperMap: Record<string, number> = {
    SUNDAY: 0,
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
    SATURDAY: 6,
  };
  const shortMap: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };
  const seen = new Set<number>();
  const targets: number[] = [];
  for (const x of raw) {
    const s = String(x ?? '').trim();
    if (!s) continue;
    let dow = upperMap[s.toUpperCase()];
    if (dow === undefined) {
      const low3 = s.toLowerCase().slice(0, 3);
      dow = shortMap[low3];
    }
    if (dow !== undefined && !seen.has(dow)) {
      seen.add(dow);
      targets.push(dow);
    }
  }
  return targets;
}

function normalizeWeeklyPattern(schedule: Record<string, unknown> | null): string {
  const p = String(schedule?.weeklyPattern || 'weekly_default')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  return p || 'weekly_default';
}

/** Two JS weekdays used for monthly TWICE_WEEKLY (vendor “twice a week”). */
function twiceWeeklyJsTargets(schedule: Record<string, unknown> | null): number[] {
  const parsed = parseJsWeekdayTargetsFromSchedule(schedule);
  const uniq = [...new Set(parsed)].sort((a, b) => a - b);
  if (uniq.length >= 2) return [uniq[0], uniq[1]];
  if (uniq.length === 1) {
    const a = uniq[0];
    const b = (a + 3) % 7;
    return [Math.min(a, b), Math.max(a, b)];
  }
  return [1, 4];
}

function nextMatchingWeekdayStrictlyAfter(cursor: Date, targets: number[]): Date {
  const uniq = [...new Set(targets)];
  if (!uniq.length) return addDays(cursor, 7);
  let d = addDays(cursor, 1);
  for (let i = 0; i < 21; i++) {
    if (uniq.includes(d.getDay())) return d;
    d = addDays(d, 1);
  }
  return addDays(cursor, 7);
}

/** Next calendar delivery day after `cursor` (date-only semantics). */
export function advanceDeliveryCursor(
  cursor: Date,
  purchaseType: string,
  schedule: Record<string, unknown> | null,
): Date {
  const pt = String(purchaseType || '').toUpperCase();
  const sch = schedule || {};
  if (pt === 'MONTHLY_PLAN') {
    const mf = String(sch.monthlyDeliveryFrequency || sch.deliveryFrequency || '').toUpperCase();
    if (MONTHLY_VENDOR_FREQ.has(mf)) {
      if (mf === 'DAILY') return addDays(cursor, 1);
      if (mf === 'ALTERNATE_DAYS') return addDays(cursor, 2);
      if (mf === 'TWICE_WEEKLY') {
        return nextMatchingWeekdayStrictlyAfter(cursor, twiceWeeklyJsTargets(sch));
      }
      if (mf === 'WEEKLY') return addDays(cursor, 7);
    }
    return addMonths(cursor, 1);
  }
  const pattern = normalizeWeeklyPattern(sch);
  if (pattern === 'everyday') {
    return addDays(cursor, 1);
  }
  if (pattern === 'alternate_days') {
    return addDays(cursor, 2);
  }
  if (pattern === 'weekdays_only') {
    let d = addDays(cursor, 1);
    for (let i = 0; i < 14; i++) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) return d;
      d = addDays(d, 1);
    }
    return addDays(cursor, 1);
  }
  if (pattern === 'specific_weekdays') {
    const targets = parseJsWeekdayTargetsFromSchedule(sch);
    if (!targets.length) {
      return addDays(cursor, 7);
    }
    let d = addDays(cursor, 1);
    for (let i = 0; i < 21; i++) {
      if (targets.includes(d.getDay())) return d;
      d = addDays(d, 1);
    }
    return addDays(cursor, 7);
  }
  return addDays(cursor, 7);
}

/** Count deliveries in [windowStart, windowEnd] using “next delivery strictly after cursor” (aligned with TWICE_WEEKLY monthly). */
function countMonthlyCadenceDeliveriesInClosedWindow(
  schedule: Record<string, unknown> | null,
  windowStart: Date,
  windowEnd: Date,
): number {
  let cursor = addDays(windowStart, -1);
  let n = 0;
  while (true) {
    const next = advanceDeliveryCursor(cursor, 'MONTHLY_PLAN', schedule);
    if (next > windowEnd) break;
    if (next >= windowStart) n++;
    cursor = next;
    if (n > 200) break;
  }
  return Math.max(1, n);
}

/** Deliveries in one weekly billing window (catalog uses a full-week bundle). */
export function weeklyDeliveriesPerBillingCycle(schedule: Record<string, unknown> | null): number {
  const sch = schedule || {};
  const pattern = normalizeWeeklyPattern(sch);
  if (pattern === 'specific_weekdays') {
    const targets = parseJsWeekdayTargetsFromSchedule(sch);
    return Math.max(1, targets.length);
  }
  if (pattern === 'everyday') return 7;
  if (pattern === 'weekdays_only') return 5;
  if (pattern === 'alternate_days') {
    const anchor = new Date(2020, 0, 6);
    const endTs = anchor.getTime() + 7 * 86400000;
    let cursor = anchor;
    let n = 0;
    while (cursor.getTime() < endTs) {
      n++;
      cursor = advanceDeliveryCursor(cursor, 'WEEKLY_PLAN', { weeklyPattern: 'alternate_days' });
      if (n > 20) break;
    }
    return Math.max(1, n);
  }
  return 1;
}

/** Deliveries in one calendar-month billing window (matches monthly vendor cadence). */
export function monthlyDeliveriesPerBillingCycle(schedule: Record<string, unknown> | null): number {
  const sch = schedule || {};
  const mode = normalizeMonthlyMode(sch);
  const monthStart = new Date(2020, 0, 1);
  const monthEnd = new Date(2020, 0, 31);

  /** Fixed session pack: one billing pack = 4 calendar weeks (28 days), same cadence math for all vendor monthly freqs. */
  if (mode === 'fixed_sessions') {
    const windowEnd = addDays(monthStart, 27);
    return countMonthlyCadenceDeliveriesInClosedWindow(schedule, monthStart, windowEnd);
  }

  const mf = String(sch.monthlyDeliveryFrequency || sch.deliveryFrequency || '').toUpperCase();
  if (mf === 'TWICE_WEEKLY') {
    return countMonthlyCadenceDeliveriesInClosedWindow(schedule, monthStart, monthEnd);
  }
  let cursor = new Date(2020, 0, 1);
  const end = new Date(2020, 0, 31);
  let n = 0;
  while (cursor <= end) {
    n++;
    cursor = advanceDeliveryCursor(cursor, 'MONTHLY_PLAN', schedule);
    if (n > 120) break;
  }
  return Math.max(1, n);
}

export function deliveriesPerBillingCycle(
  purchaseType: string,
  schedule: Record<string, unknown> | null,
): number {
  const pt = String(purchaseType || '').toUpperCase();
  if (pt === 'WEEKLY_PLAN') return weeklyDeliveriesPerBillingCycle(schedule);
  if (pt === 'MONTHLY_PLAN') return monthlyDeliveriesPerBillingCycle(schedule);
  return 1;
}

export function billingCyclesFromSessions(totalSessions: number, deliveriesPerCycle: number): number {
  const cap = Math.max(1, Math.floor(deliveriesPerCycle || 1));
  const sessions = Math.max(1, Math.floor(totalSessions || 1));
  return Math.max(1, Math.ceil(sessions / cap));
}
