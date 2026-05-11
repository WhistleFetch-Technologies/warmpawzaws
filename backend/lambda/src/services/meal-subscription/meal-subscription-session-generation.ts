/**
 * Rolling delivery session generation for canonical meal_subscriptions (P1).
 * Caller supplies PoolClient from withTransaction.
 */

import type { PoolClient } from 'pg';
import { DEFAULT_SESSION_HORIZON_DAYS } from '../../constants/meal-subscription-canonical';

export type SubscriptionRowForGeneration = {
  id: string;
  purchase_type: string | null;
  lifecycle_status: string | null;
  next_delivery_date: string | Date | null;
  start_date: string | Date | null;
  total_sessions: number | null;
  delivery_schedule_json: Record<string, unknown> | null;
};

function toDateOnly(d: string | Date): Date {
  if (d instanceof Date) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const x = new Date(String(d));
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
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

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function asScheduleJson(v: unknown): Record<string, unknown> | null {
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

/** Next delivery instant after the given calendar day (exclusive advance from last session date). */
export function advanceDeliveryCursor(
  cursor: Date,
  purchaseType: string,
  schedule: Record<string, unknown> | null,
): Date {
  const pt = String(purchaseType || '').toUpperCase();
  if (pt === 'MONTHLY_PLAN') {
    return addMonths(cursor, 1);
  }
  const sch = schedule || {};
  const pattern = String(sch.weeklyPattern || 'weekly_default');
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
    const raw = Array.isArray(sch.weekdays) ? sch.weekdays : [];
    const map: Record<string, number> = {
      sun: 0,
      mon: 1,
      tue: 2,
      wed: 3,
      thu: 4,
      fri: 5,
      sat: 6,
    };
    const targets = raw
      .map((x) => map[String(x).toLowerCase().slice(0, 3)])
      .filter((n) => n !== undefined) as number[];
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

function defaultSlotFromSchedule(schedule: Record<string, unknown> | null): Record<string, string> {
  if (schedule && typeof schedule.slot === 'object' && schedule.slot !== null && !Array.isArray(schedule.slot)) {
    const s = schedule.slot as Record<string, unknown>;
    const start = String(s.start ?? '09:00');
    const end = String(s.end ?? '12:00');
    return { start, end };
  }
  return { start: '09:00', end: '12:00' };
}

/**
 * Materializes future meal_subscription_deliveries up to horizonDays ahead,
 * without exceeding total_sessions when set.
 */
export async function ensureRollingSessions(
  client: PoolClient,
  sub: SubscriptionRowForGeneration,
  options?: { horizonDays?: number },
): Promise<{ inserted: number; lastDeliveryDate: string | null }> {
  const horizonDays = options?.horizonDays ?? DEFAULT_SESSION_HORIZON_DAYS;
  if (sub.lifecycle_status !== 'active') {
    return { inserted: 0, lastDeliveryDate: null };
  }

  const purchaseType = String(sub.purchase_type || '').toUpperCase();
  if (purchaseType !== 'WEEKLY_PLAN' && purchaseType !== 'MONTHLY_PLAN') {
    return { inserted: 0, lastDeliveryDate: null };
  }

  const horizonEnd = formatYmd(addDays(new Date(), horizonDays));
  const scheduleJson = asScheduleJson(sub.delivery_schedule_json);
  const slot = defaultSlotFromSchedule(scheduleJson);

  const maxRes = await client.query(
    `SELECT COALESCE(MAX(session_number), 0)::int AS mx,
            MAX(delivery_date)::text AS max_d
     FROM meal_subscription_deliveries
     WHERE subscription_id = $1`,
    [sub.id],
  );
  const maxSession = (maxRes.rows[0]?.mx as number) ?? 0;
  const maxDelivery = maxRes.rows[0]?.max_d as string | null;

  let sessionNumber = maxSession;
  let cursor: Date;
  if (maxSession === 0) {
    cursor = sub.next_delivery_date
      ? toDateOnly(sub.next_delivery_date)
      : sub.start_date
        ? toDateOnly(sub.start_date)
        : addDays(new Date(), 1);
  } else if (maxDelivery) {
    const md = toDateOnly(maxDelivery);
    cursor = advanceDeliveryCursor(md, purchaseType, scheduleJson);
  } else {
    cursor = addDays(new Date(), 1);
  }

  const capRes = await client.query(
    `SELECT COUNT(*)::int AS c FROM meal_subscription_deliveries WHERE subscription_id = $1`,
    [sub.id],
  );
  let existingNonCancelled = (capRes.rows[0]?.c as number) ?? 0;

  const totalCap = sub.total_sessions != null ? Number(sub.total_sessions) : null;

  let inserted = 0;
  let lastDateStr: string | null = null;

  while (formatYmd(cursor) <= horizonEnd) {
    if (totalCap != null && existingNonCancelled + inserted >= totalCap) break;

    sessionNumber += 1;
    const ymd = formatYmd(cursor);
    lastDateStr = ymd;

    const ins = await client.query(
      `INSERT INTO meal_subscription_deliveries (
         subscription_id, session_number, delivery_date, delivery_time_slot, status
       ) VALUES ($1, $2, $3::date, $4::jsonb, 'scheduled')
       ON CONFLICT (subscription_id, session_number) DO NOTHING
       RETURNING id`,
      [sub.id, sessionNumber, ymd, JSON.stringify(slot)],
    );
    if (ins.rowCount && ins.rowCount > 0) inserted += 1;

    cursor = advanceDeliveryCursor(cursor, purchaseType, scheduleJson);
  }

  if (inserted === 0 || !lastDateStr) {
    return { inserted, lastDeliveryDate: lastDateStr };
  }

  const nextRes = await client.query(
    `SELECT MIN(delivery_date)::text AS nd
     FROM meal_subscription_deliveries
     WHERE subscription_id = $1 AND status = 'scheduled'`,
    [sub.id],
  );
  const nextDelivery = nextRes.rows[0]?.nd as string | undefined;

  await client.query(
    `UPDATE meal_subscriptions SET
       session_horizon_generated_through = $2::date,
       next_delivery_date = COALESCE($3::date, $2::date),
       updated_at = NOW()
     WHERE id = $1`,
    [sub.id, lastDateStr, nextDelivery ?? null],
  );

  return { inserted, lastDeliveryDate: lastDateStr };
}
