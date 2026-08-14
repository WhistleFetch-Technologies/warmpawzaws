/**
 * Reverse pending package-session vendor_earnings when the parent purchase is cancelled.
 */

import type { SqlClient } from './package-session-sync';

export async function reversePendingPackageSessionEarnings(
  db: SqlClient,
  packagePurchaseId: string,
  logPrefix = '[PACKAGE-EARNINGS-REVERSE]'
): Promise<number> {
  if (!packagePurchaseId) return 0;

  const rows = await db.query(
    `UPDATE vendor_earnings ve
     SET status = 'cancelled'
     FROM bookings b
     WHERE ve.booking_id = b.id
       AND b.package_purchase_id = $1::uuid
       AND COALESCE(b.is_package_session, false) = true
       AND ve.status = 'pending'
     RETURNING ve.vendor_id::text AS vendor_id, ve.amount::numeric AS amount`,
    [packagePurchaseId]
  );

  const byVendor = new Map<string, number>();
  for (const row of rows.rows || []) {
    const vid = String(row.vendor_id ?? '');
    const amt = Number(row.amount ?? 0);
    if (!vid || !Number.isFinite(amt) || amt <= 0) continue;
    byVendor.set(vid, (byVendor.get(vid) || 0) + amt);
  }

  for (const [vendorId, sum] of byVendor) {
    await db
      .query(
        `UPDATE vendors
         SET pending_payout = GREATEST(COALESCE(pending_payout, 0) - $1, 0),
             total_earnings = GREATEST(COALESCE(total_earnings, 0) - $1, 0),
             updated_at = NOW()
         WHERE id = $2::uuid`,
        [sum, vendorId]
      )
      .catch((err: unknown) =>
        console.warn(`${logPrefix} vendor totals:`, (err as Error)?.message)
      );
  }

  const n = rows.rowCount ?? rows.rows?.length ?? 0;
  if (n > 0) {
    console.log(`${logPrefix} cancelled ${n} pending package session earnings row(s)`);
  }
  return n;
}
