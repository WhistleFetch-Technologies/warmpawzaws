/**
 * Package purchase schedule validation: distinct slots per day + vendor conflict checks.
 */

import { query } from '../database/rds-connection';
import {
  expandVendorPackageSessionSchedule,
  type VendorPackageSessionScheduleItem,
} from './vendor-package-razorpay-flow';
import { assertNoVendorSlotConflictsForSchedule } from './slot-occupancy';

export type PackageScheduleSlot = {
  date: string;
  time: string;
  sessionNumber?: number;
};

export type PackageScheduleValidationResult =
  | { ok: true }
  | {
      ok: false;
      status: 400 | 409;
      code: 'DUPLICATE_SLOT_TIMES' | 'SLOT_CONFLICT';
      message: string;
    };

type QueryFn = typeof query;

/** Normalize to HH:mm for slot comparison (accepts HH:mm or HH:mm:ss). */
export function normalizeSlotTimeKey(t: unknown): string {
  const s = String(t ?? '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return '';
  const hh = String(Math.min(23, Math.max(0, parseInt(m[1], 10)))).padStart(2, '0');
  const mm = String(Math.min(59, Math.max(0, parseInt(m[2], 10)))).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Returns duplicate (date|time) keys found in schedule. */
export function findDuplicateScheduleSlotKeys(schedule: PackageScheduleSlot[]): string[] {
  const counts = new Map<string, number>();
  for (const slot of schedule) {
    const date = String(slot.date || '').trim();
    const time = normalizeSlotTimeKey(slot.time);
    if (!date || !time) continue;
    const key = `${date}|${time}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key);
}

export function assertDistinctScheduleSlots(
  schedule: PackageScheduleSlot[]
): PackageScheduleValidationResult {
  if (findDuplicateScheduleSlotKeys(schedule).length > 0) {
    return {
      ok: false,
      status: 400,
      code: 'DUPLICATE_SLOT_TIMES',
      message: 'Each session slot on the same day must use a different time.',
    };
  }
  return { ok: true };
}

export async function assertNoVendorSlotConflicts(
  vendorId: string,
  schedule: PackageScheduleSlot[],
  runQuery: QueryFn = query,
  durationMinutes?: number
): Promise<PackageScheduleValidationResult> {
  return assertNoVendorSlotConflictsForSchedule(vendorId, schedule, runQuery, durationMinutes);
}

export async function validatePackagePurchaseSchedule(params: {
  vendorId: string;
  sessionSchedule: VendorPackageSessionScheduleItem[];
  unlimitedPurchase: boolean;
  totalSessionsForPurchase: number;
  sessionsPerDay: number;
  sessionIntervalDays: number;
  queryFn?: QueryFn;
  durationMinutes?: number;
}): Promise<PackageScheduleValidationResult> {
  if (params.unlimitedPurchase || params.totalSessionsForPurchase <= 0) {
    return { ok: true };
  }

  const expanded = expandVendorPackageSessionSchedule(
    params.sessionSchedule,
    params.totalSessionsForPurchase,
    {
      sessionsPerDay: params.sessionsPerDay,
      intervalDays: params.sessionIntervalDays,
    }
  );

  const schedule: PackageScheduleSlot[] = expanded
    .map((s) => ({
      date: String(s.date || '').trim(),
      time: String(s.time || '').trim(),
      sessionNumber: s.sessionNumber,
    }))
    .filter((s) => s.date && s.time);

  const distinct = assertDistinctScheduleSlots(schedule);
  if (!distinct.ok) return distinct;

  return assertNoVendorSlotConflicts(
    params.vendorId,
    schedule,
    params.queryFn ?? query,
    params.durationMinutes
  );
}

export function isPackageSlotUniqueViolation(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  const msg = String(err?.message || '');
  return (
    err?.code === '23505' &&
    (msg.includes('idx_booking_slot_vendor_unique') ||
      msg.includes('idx_booking_slot_staff_unique') ||
      msg.includes('unique constraint'))
  );
}
