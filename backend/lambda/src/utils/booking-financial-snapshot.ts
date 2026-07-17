/**
 * Write-once financial snapshot on the booking row.
 *
 * Bookings created by legacy clients (or before the meta existed) have no
 * `wp_financial_meta` in `bookings.notes`, so booking detail cannot render the
 * GST/fee breakdown without payment-row fallbacks. When payment creation
 * computes the authoritative breakdown, this persists it back to the booking:
 * `tax_amount` + serialized `wp_financial_meta` appended to `notes`.
 *
 * No-op when the booking already carries a meta. Callers must fail OPEN
 * (wrap in try/catch) — this must never block payment/order creation.
 */

import { query } from '../database/rds-connection';
import {
  serializeBookingFinancialMeta,
  type BookingFinancialNotesMeta,
} from '../lib/services/booking-promotion-service';

export async function writeBookingFinancialSnapshotIfMissing(
  bookingId: string,
  meta: BookingFinancialNotesMeta
): Promise<boolean> {
  const res = await query(`SELECT notes FROM bookings WHERE id = $1::uuid LIMIT 1`, [bookingId]);
  if (!res.rows?.length) return false;
  const notes = String(res.rows[0].notes || '');
  if (notes.includes('wp_financial_meta')) return false;

  const serialized = serializeBookingFinancialMeta(meta);
  const newNotes = notes.trim() ? `${notes} | ${serialized}` : serialized;
  await query(
    `UPDATE bookings SET tax_amount = $2, notes = $3, updated_at = NOW() WHERE id = $1::uuid`,
    [bookingId, meta.totalTax ?? 0, newNotes]
  );
  return true;
}
