import { query, select } from '../database/rds-connection';
import { isValidUUID } from '../types/entities';

/**
 * Package purchases use one chat thread on the canonical parent booking
 * (`is_package_session = false`). Session child rows share the same vendor/customer
 * but must not hold a separate message thread.
 */
export async function resolveChatBookingId(bookingId: string): Promise<string> {
  const raw = String(bookingId || '').trim();
  if (!raw || !isValidUUID(raw)) return raw;

  const bookings = await select('bookings', { id: raw });
  if (bookings.length === 0) return raw;

  const booking = bookings[0] as Record<string, unknown>;
  const isPackageSession = Boolean(booking.is_package_session);
  if (!isPackageSession) return raw;

  const parentBookingId = booking.parent_booking_id
    ? String(booking.parent_booking_id).trim()
    : '';
  if (parentBookingId && isValidUUID(parentBookingId)) {
    return parentBookingId;
  }

  const packagePurchaseId = booking.package_purchase_id
    ? String(booking.package_purchase_id).trim()
    : '';
  if (packagePurchaseId && isValidUUID(packagePurchaseId)) {
    const parent = await query(
      `SELECT id::text AS id
       FROM bookings
       WHERE package_purchase_id = $1::uuid
         AND COALESCE(is_package_session, false) = false
       ORDER BY created_at ASC NULLS LAST, updated_at ASC NULLS LAST
       LIMIT 1`,
      [packagePurchaseId]
    );
    const parentId = parent.rows?.[0]?.id ? String(parent.rows[0].id).trim() : '';
    if (parentId && isValidUUID(parentId)) return parentId;
  }

  return raw;
}
