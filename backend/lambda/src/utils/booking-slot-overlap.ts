/**
 * Duration-based booking slot overlap checks (mirrors POST /bookings/create semantics).
 */

import { SQL_BOOKING_BLOCKS_SLOT } from './payment-hold';

export type BookingSlotOverlapParams = {
  vendorId: string;
  bookingDate: string;
  bookingTime: string;
  durationMinutes: number;
  staffId?: string | null;
  excludeBookingId?: string | null;
};

export type ExistingBookingInterval = {
  booking_time: string;
  duration_minutes: number;
};

export type QueryFn = (
  sql: string,
  params?: unknown[]
) => Promise<{ rows: Array<{ id: string; booking_time: string; duration_minutes: number }> }>;

export function bookingTimeToMinutes(bookingTime: string): number {
  const normalized = String(bookingTime || '').trim().slice(0, 5);
  const [h, m] = normalized.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function intervalsOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return startA < endB && endA > startB;
}

export function hasDurationOverlapWithExisting(
  bookingTime: string,
  durationMinutes: number,
  existing: ExistingBookingInterval[]
): boolean {
  const newStart = bookingTimeToMinutes(bookingTime);
  const newEnd = newStart + Math.max(15, durationMinutes);

  return existing.some((row) => {
    const existingStart = bookingTimeToMinutes(String(row.booking_time));
    const existingDur = Math.max(15, Number(row.duration_minutes) || 30);
    const existingEnd = existingStart + existingDur;
    return intervalsOverlap(newStart, newEnd, existingStart, existingEnd);
  });
}

export async function loadBlockingBookingsForSlot(
  params: BookingSlotOverlapParams,
  runQuery: QueryFn
): Promise<Array<{ id: string; booking_time: string; duration_minutes: number }>> {
  const { vendorId, bookingDate, staffId, excludeBookingId } = params;

  const overlapQuery = staffId
    ? `SELECT id, booking_time, COALESCE(total_duration_minutes, duration_minutes, 30) as duration_minutes
       FROM bookings
       WHERE vendor_id = $1
       AND booking_date = $2
       AND staff_id = $3
       AND ($4::uuid IS NULL OR id != $4::uuid)
       AND ${SQL_BOOKING_BLOCKS_SLOT}`
    : `SELECT id, booking_time, COALESCE(total_duration_minutes, duration_minutes, 30) as duration_minutes
       FROM bookings
       WHERE vendor_id = $1
       AND booking_date = $2
       AND staff_id IS NULL
       AND ($3::uuid IS NULL OR id != $3::uuid)
       AND ${SQL_BOOKING_BLOCKS_SLOT}`;

  const overlapParams = staffId
    ? [vendorId, bookingDate, staffId, excludeBookingId ?? null]
    : [vendorId, bookingDate, excludeBookingId ?? null];

  const { rows } = await runQuery(overlapQuery, overlapParams);
  return rows;
}

export async function hasBookingSlotOverlap(
  params: BookingSlotOverlapParams,
  runQuery: QueryFn
): Promise<boolean> {
  const rows = await loadBlockingBookingsForSlot(params, runQuery);
  return hasDurationOverlapWithExisting(
    params.bookingTime,
    params.durationMinutes,
    rows
  );
}

export const SLOT_TAKEN_AT_VERIFY_REASON = 'slot_taken_at_verify';

export function overlapParamsFromBookingRow(
  bookingRow: Record<string, unknown>,
  bookingId: string
): BookingSlotOverlapParams | null {
  if (!bookingRow?.vendor_id || !bookingRow?.booking_date || !bookingRow?.booking_time) {
    return null;
  }
  return {
    vendorId: String(bookingRow.vendor_id),
    bookingDate: String(bookingRow.booking_date).slice(0, 10),
    bookingTime: String(bookingRow.booking_time).slice(0, 5),
    durationMinutes: Math.max(
      15,
      Number(bookingRow.total_duration_minutes ?? bookingRow.duration_minutes ?? 30)
    ),
    staffId: bookingRow.staff_id ? String(bookingRow.staff_id) : null,
    excludeBookingId: bookingId,
  };
}
