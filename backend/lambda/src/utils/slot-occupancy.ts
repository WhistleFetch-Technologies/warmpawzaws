/**
 * Authoritative slot occupancy: interval overlap + capacity + vendor/staff resource key.
 * Used by availability, create, reschedule, package, follow-up, and late-payment revival.
 * Instant tele is excluded — it uses a separate queue capacity model.
 */

import type { PoolClient } from 'pg';
import { query, withTransaction } from '../database/rds-connection';
import { SQL_BOOKING_BLOCKS_SLOT } from './payment-hold';
import { dayOfWeekFromYmd } from './ist-scheduling';

export const SLOT_CONFLICT_CODE = 'SLOT_CONFLICT';
export const SLOT_CONFLICT_MESSAGE = 'This time slot is already booked. Please select a different time.';
export const SLOT_OCCUPANCY_LOCK_NAMESPACE = 'booking-slot-occupancy';

const SQL_EXCLUDE_INSTANT_TELE = `COALESCE(is_instant_tele, false) = false`;
const SQL_EXCLUDE_PACKAGE_PARENT = `NOT (package_purchase_id IS NOT NULL AND COALESCE(is_package_session, false) = false)`;

export type OccupyingBooking = {
  id?: string;
  booking_time: string;
  duration_minutes: number;
  staff_id?: string | null;
};

export type SqlQueryFn = (sql: string, params?: any[]) => Promise<{ rows: any[] }>;

export type OccupancyDb = PoolClient | SqlQueryFn;

function asQueryFn(db: OccupancyDb): SqlQueryFn {
  if (typeof db === 'function') return db;
  return (sql, params) => db.query(sql, params);
}

export function parseBookingTimeMinutes(time: string | null | undefined): number {
  const s = String(time || '00:00').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  return (parseInt(m[1], 10) || 0) * 60 + (parseInt(m[2], 10) || 0);
}

/** First positive duration from service/package config. 30 is last-resort only when config is missing. */
export function resolveDurationMinutes(...candidates: unknown[]): number {
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return Math.max(1, Math.round(n));
  }
  return 30;
}

export function intervalsOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return startA < endB && endA > startB;
}

export function countOverlappingBookings(
  occupying: OccupyingBooking[],
  startMinutes: number,
  endMinutes: number,
  excludeBookingId?: string | null
): number {
  let n = 0;
  for (const row of occupying) {
    if (excludeBookingId && row.id && String(row.id) === String(excludeBookingId)) continue;
    const otherStart = parseBookingTimeMinutes(row.booking_time);
    const otherDur = Math.max(1, Number(row.duration_minutes) || 30);
    if (intervalsOverlap(startMinutes, endMinutes, otherStart, otherStart + otherDur)) n += 1;
  }
  return n;
}

export function isRequestedIntervalAvailable(params: {
  occupying: OccupyingBooking[];
  startTime: string;
  durationMinutes: number;
  capacity?: number;
  excludeBookingId?: string | null;
}): boolean {
  const start = parseBookingTimeMinutes(params.startTime);
  const duration = Math.max(1, Number(params.durationMinutes) || 30);
  const capacity = Math.max(1, Number(params.capacity) || 1);
  const overlapping = countOverlappingBookings(
    params.occupying,
    start,
    start + duration,
    params.excludeBookingId
  );
  return overlapping < capacity;
}

/**
 * Lock key: vendorId|date|staffId-or-nostaff + namespace booking-slot-occupancy.
 * Unassigned bookings (prod: staff_id IS NULL) share one vendor+date lock.
 * Distinct staff ids lock separately so Staff A and Staff B can book the same start
 * when the resource model allows simultaneous staff.
 */
export function slotOccupancyLockPair(
  vendorId: string,
  dateYmd: string,
  staffId?: string | null
): [string, string] {
  const staffKey = staffId ? String(staffId) : 'nostaff';
  return [`${vendorId}|${dateYmd}|${staffKey}`, SLOT_OCCUPANCY_LOCK_NAMESPACE];
}

/** Transaction-scoped lock. Safe when no booking rows exist yet (unlike SELECT FOR UPDATE). */
export async function acquireSlotOccupancyLock(
  client: PoolClient,
  vendorId: string,
  dateYmd: string,
  staffId?: string | null
): Promise<void> {
  const [resource, ns] = slotOccupancyLockPair(vendorId, dateYmd, staffId);
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1::text), hashtext($2::text))`, [
    resource,
    ns,
  ]);
}

export async function loadOccupyingBookings(
  db: OccupancyDb,
  params: {
    vendorId: string;
    date: string;
    staffId?: string | null;
    excludeBookingId?: string | null;
  }
): Promise<OccupyingBooking[]> {
  const q = asQueryFn(db);
  const bind: any[] = [params.vendorId, params.date];
  let staffSql = '';
  if (params.staffId === null) {
    staffSql = ' AND staff_id IS NULL';
  } else if (typeof params.staffId === 'string' && params.staffId) {
    bind.push(params.staffId);
    staffSql = ` AND staff_id = $${bind.length}`;
  }
  let excludeSql = '';
  if (params.excludeBookingId) {
    bind.push(params.excludeBookingId);
    excludeSql = ` AND id <> $${bind.length}::uuid`;
  }

  const { rows } = await q(
    `SELECT id::text AS id,
            booking_time,
            COALESCE(total_duration_minutes, duration_minutes, 30)::int AS duration_minutes,
            staff_id
     FROM bookings
     WHERE vendor_id::text = $1::text
       AND booking_date = $2::date
       AND ${SQL_BOOKING_BLOCKS_SLOT}
       AND ${SQL_EXCLUDE_INSTANT_TELE}
       AND ${SQL_EXCLUDE_PACKAGE_PARENT}
       ${staffSql}
       ${excludeSql}`,
    bind
  );

  return (rows || []).map((r: any) => ({
    id: r.id ? String(r.id) : undefined,
    booking_time: String(r.booking_time || '00:00'),
    duration_minutes: Math.max(1, Number(r.duration_minutes) || 30),
    staff_id: r.staff_id ? String(r.staff_id) : null,
  }));
}

export async function loadVendorWindowCapacity(
  db: OccupancyDb,
  vendorId: string,
  dateYmd: string,
  startTime: string
): Promise<number> {
  const q = asQueryFn(db);
  const dow = dayOfWeekFromYmd(dateYmd);
  const startMin = parseBookingTimeMinutes(startTime);
  try {
    const { rows } = await q(
      `SELECT COALESCE(max_capacity, 1) AS max_capacity,
              COALESCE(time_window_start, start_time) AS win_start,
              COALESCE(time_window_end, end_time) AS win_end
       FROM vendor_availability_v2
       WHERE vendor_id::text = $1::text
         AND day_of_week = $2
         AND COALESCE(is_available, is_enabled, true) = true`,
      [vendorId, dow]
    );
    for (const row of rows || []) {
      const winStart = parseBookingTimeMinutes(row.win_start);
      const winEnd = parseBookingTimeMinutes(row.win_end);
      if (startMin >= winStart && startMin < winEnd) {
        const cap = parseInt(String(row.max_capacity), 10);
        return Number.isFinite(cap) && cap > 0 ? cap : 1;
      }
    }
  } catch {
    return 1;
  }
  return 1;
}

export async function loadVendorServiceDurationMinutes(
  db: OccupancyDb,
  vendorServiceId: string | null | undefined
): Promise<number> {
  if (!vendorServiceId) return resolveDurationMinutes();
  const q = asQueryFn(db);
  try {
    const { rows } = await q(
      `SELECT duration_minutes FROM vendor_services WHERE id::text = $1::text LIMIT 1`,
      [vendorServiceId]
    );
    const row = rows?.[0];
    return resolveDurationMinutes(row?.duration_minutes);
  } catch {
    return resolveDurationMinutes();
  }
}

export async function evaluateSlotAvailability(
  db: OccupancyDb,
  params: {
    vendorId: string;
    date: string;
    startTime: string;
    durationMinutes: number;
    staffId?: string | null;
    excludeBookingId?: string | null;
    capacity?: number;
  }
): Promise<boolean> {
  const occupying = await loadOccupyingBookings(db, {
    vendorId: params.vendorId,
    date: params.date,
    staffId: params.staffId === undefined ? null : params.staffId,
    excludeBookingId: params.excludeBookingId,
  });
  const capacity =
    params.capacity != null
      ? params.capacity
      : await loadVendorWindowCapacity(db, params.vendorId, params.date, params.startTime);
  return isRequestedIntervalAvailable({
    occupying,
    startTime: params.startTime,
    durationMinutes: params.durationMinutes,
    capacity,
    excludeBookingId: params.excludeBookingId,
  });
}

export class SlotConflictError extends Error {
  code = SLOT_CONFLICT_CODE;
  constructor(message: string = 'SLOT_CONFLICT') {
    super(message);
    this.name = 'SlotConflictError';
  }
}

/** Lock + occupancy check inside an existing transaction (create / reschedule / revive). */
export async function assertSlotAvailableInTx(
  client: PoolClient,
  params: {
    vendorId: string;
    date: string;
    startTime: string;
    durationMinutes: number;
    staffId?: string | null;
    excludeBookingId?: string | null;
    capacity?: number;
  }
): Promise<void> {
  await acquireSlotOccupancyLock(client, params.vendorId, params.date, params.staffId ?? null);
  const ok = await evaluateSlotAvailability(client, params);
  if (!ok) throw new SlotConflictError();
}

export async function assertNoVendorSlotConflictsForSchedule(
  vendorId: string,
  schedule: Array<{ date: string; time: string }>,
  runQuery: SqlQueryFn = query,
  durationMinutes?: number
): Promise<{ ok: true } | { ok: false; status: 409; code: 'SLOT_CONFLICT'; message: string }> {
  const resolvedDuration = resolveDurationMinutes(durationMinutes);
  const dates = [...new Set(schedule.map((s) => String(s.date || '').trim()).filter(Boolean))].sort();

  const checkWith = async (db: OccupancyDb) => {
    for (const slot of schedule) {
      const date = String(slot.date || '').trim();
      const time = String(slot.time || '').trim();
      if (!date || !time) continue;
      const ok = await evaluateSlotAvailability(db, {
        vendorId,
        date,
        startTime: time,
        durationMinutes: resolvedDuration,
        staffId: null,
      });
      if (!ok) {
        return {
          ok: false as const,
          status: 409 as const,
          code: SLOT_CONFLICT_CODE as 'SLOT_CONFLICT',
          message: SLOT_CONFLICT_MESSAGE,
        };
      }
    }
    return { ok: true as const };
  };

  if (runQuery !== query) {
    return checkWith(runQuery);
  }

  return withTransaction(async (client) => {
    for (const date of dates) {
      await acquireSlotOccupancyLock(client, vendorId, date, null);
    }
    return checkWith(client);
  });
}
