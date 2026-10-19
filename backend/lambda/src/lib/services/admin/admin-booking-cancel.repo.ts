/**
 * SQL for admin cancel & refund (POST /admin/bookings/:id/cancel).
 */
import { query, withTransaction } from '../../../database/rds-connection';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_PREFIX_RE = /^[0-9a-f]{8,}$/i;

export type BookingLookup =
  | { kind: 'found'; row: Record<string, unknown> }
  | { kind: 'not_found' }
  | { kind: 'ambiguous'; count: number }
  | { kind: 'invalid' };

/** Full booking UUID, or the 8+ hex prefix customers see as "#ABCD1234". */
export async function dbFindBookingForAdmin(idOrPrefix: string): Promise<BookingLookup> {
  const raw = String(idOrPrefix || '').trim().replace(/^#/, '').toLowerCase();
  if (UUID_RE.test(raw)) {
    const r = await query(`SELECT * FROM bookings WHERE id = $1::uuid LIMIT 1`, [raw]);
    return r.rows?.[0] ? { kind: 'found', row: r.rows[0] } : { kind: 'not_found' };
  }
  if (!ID_PREFIX_RE.test(raw)) return { kind: 'invalid' };
  const r = await query(`SELECT * FROM bookings WHERE id::text LIKE $1 LIMIT 2`, [`${raw}%`]);
  const rows = r.rows || [];
  if (rows.length === 0) return { kind: 'not_found' };
  if (rows.length > 1) return { kind: 'ambiguous', count: rows.length };
  return { kind: 'found', row: rows[0] };
}

export async function dbBookingDisplayContext(bookingId: string) {
  const r = await query(
    `SELECT c.full_name AS customer_name, c.phone AS customer_phone,
            v.business_name AS vendor_name,
            COALESCE(s.name, vs.service_name, sc.service_name, sc.display_name) AS service_name
     FROM bookings b
     LEFT JOIN customers c ON c.id = b.customer_id
     LEFT JOIN vendors v ON v.id = b.vendor_id
     LEFT JOIN services s ON s.id = b.service_id
     LEFT JOIN vendor_services vs ON vs.id = b.service_id
     LEFT JOIN service_catalog sc ON sc.id = b.service_id
     WHERE b.id = $1::uuid
     LIMIT 1`,
    [bookingId]
  );
  return (r.rows?.[0] ?? {}) as {
    customer_name?: string | null;
    customer_phone?: string | null;
    vendor_name?: string | null;
    service_name?: string | null;
  };
}

/** Refunds already issued for this booking — wallet credits and gateway refund rows. */
export async function dbPriorBookingRefunds(bookingId: string) {
  const r = await query(
    `SELECT
       (SELECT COALESCE(SUM(amount), 0)::text
          FROM wallet_transactions
         WHERE transaction_type = 'credit'
           AND COALESCE(reference_type, '') IN ('booking_refund', 'booking_refund_sync')
           AND reference_id::text = $1) AS wallet_refunded,
       (SELECT COALESCE(SUM(refund_amount), 0)::text
          FROM refunds
         WHERE booking_id = $1::uuid
           AND refund_status NOT IN ('failed', 'rejected')) AS refunds_recorded,
       (SELECT COUNT(*)::int
          FROM refunds
         WHERE booking_id = $1::uuid
           AND refund_status = 'pending') AS pending_refunds`,
    [bookingId]
  );
  const row = (r.rows?.[0] ?? {}) as Record<string, unknown>;
  const walletRefunded = Math.round((parseFloat(String(row.wallet_refunded ?? '0')) || 0) * 100) / 100;
  const refundsRecorded = Math.round((parseFloat(String(row.refunds_recorded ?? '0')) || 0) * 100) / 100;
  return {
    walletRefunded,
    refundsRecorded,
    pendingRefunds: Number(row.pending_refunds ?? 0) || 0,
  };
}

/**
 * Marks the booking cancelled only if it is still in one of `fromStatuses` (no double cancel).
 * Package parent → also cancels the purchase, its scheduled sessions and child session bookings.
 */
export async function dbAdminCancelBooking(params: {
  bookingId: string;
  reason: string;
  fromStatuses: string[];
  packagePurchaseId: string | null;
  isPackageParent: boolean;
}): Promise<Record<string, unknown> | null> {
  return withTransaction(async (client) => {
    const upd = await client.query(
      `UPDATE bookings
       SET status = 'cancelled',
           cancelled_at = NOW(),
           cancellation_reason = $2,
           cancelled_by = 'admin',
           updated_at = NOW()
       WHERE id = $1::uuid AND status = ANY($3::text[])
       RETURNING *`,
      [params.bookingId, params.reason, params.fromStatuses]
    );
    const updated = upd.rows?.[0] ?? null;
    if (!updated) return null;

    if (params.packagePurchaseId && params.isPackageParent) {
      await client.query(
        `UPDATE package_purchases
         SET status = 'cancelled', expires_at = NOW(), updated_at = NOW()
         WHERE id = $1::uuid`,
        [params.packagePurchaseId]
      );
      await client.query(
        `UPDATE package_scheduled_sessions
         SET status = 'cancelled', updated_at = NOW()
         WHERE package_purchase_id = $1::uuid
           AND status IN ('pending', 'scheduled')`,
        [params.packagePurchaseId]
      );
      await client.query(
        `UPDATE bookings
         SET status = 'cancelled',
             cancelled_at = COALESCE(cancelled_at, NOW()),
             cancellation_reason = COALESCE(cancellation_reason, $2),
             cancelled_by = COALESCE(cancelled_by, 'admin'),
             updated_at = NOW()
         WHERE package_purchase_id = $1::uuid
           AND COALESCE(is_package_session, false) = true
           AND status IN ('pending', 'confirmed')`,
        [params.packagePurchaseId, params.reason]
      );
    }
    return updated as Record<string, unknown>;
  });
}

export async function dbAdminRoleRow(adminId: string) {
  if (!UUID_RE.test(adminId)) return null;
  const r = await query(`SELECT id, email, role FROM admins WHERE id = $1::uuid LIMIT 1`, [adminId]);
  return (r.rows?.[0] ?? null) as { id: string; email?: string; role?: string } | null;
}
