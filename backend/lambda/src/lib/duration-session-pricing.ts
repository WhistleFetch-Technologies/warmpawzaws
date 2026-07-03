/**
 * Duration-based session pricing (pet sitting visits, swimming pool sessions).
 * Bills in 30-minute blocks; list price applies to vendor `baseMinutes`.
 */

import {
  computeStayBilledMinutes,
  wallDateTimeToEpochMsKolkata,
} from './booking-stay-wall-time';

export const DURATION_SESSION_BILLING_SLOT_MINUTES = 30;

export const SWIMMING_MIN_SESSION_MINUTES = 30;
export const SWIMMING_MAX_SESSION_MINUTES = 240;

export function computeDurationSessionPriceRupees(
  unitPrice: number,
  baseMinutes: number,
  billedMinutes: number
): number {
  const up = Number.isFinite(unitPrice) ? Math.max(0, unitPrice) : 0;
  let bm = Number.isFinite(baseMinutes) ? baseMinutes : 60;
  if (bm < 15) bm = 60;
  const mins = Math.max(0, billedMinutes);
  if (mins < 1) return up;
  const slots = Math.max(1, Math.ceil(mins / DURATION_SESSION_BILLING_SLOT_MINUTES));
  const pricePerSlot = (up * DURATION_SESSION_BILLING_SLOT_MINUTES) / bm;
  const proportional = Math.round(slots * pricePerSlot);
  const floor = Math.min(up, Math.max(49, Math.round(up * 0.3)));
  return Math.max(proportional, floor);
}

/**
 * Same-day session length without overnight rollover (swimming).
 * Returns -1 when checkout date differs from booking date.
 */
export function computeSameDaySessionBilledMinutes(
  bookingDate: string,
  bookingTime: string,
  checkOutDate: string,
  checkOutTime: string
): number {
  if (String(checkOutDate).trim() !== String(bookingDate).trim()) {
    return -1;
  }
  const start = wallDateTimeToEpochMsKolkata(bookingDate, bookingTime);
  const end = wallDateTimeToEpochMsKolkata(checkOutDate, checkOutTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  if (end <= start) return 0;
  return computeStayBilledMinutes(bookingDate, bookingTime, checkOutDate, checkOutTime);
}
