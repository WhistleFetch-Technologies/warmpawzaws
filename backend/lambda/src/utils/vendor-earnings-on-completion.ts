/**
 * Create vendor_earnings + bump vendor totals when a booking is marked completed.
 * Used by vendor complete, staff complete, and any other completion path so the
 * dashboard (which prefers vendor_earnings) stays in sync.
 */
import { query } from '../database/rds-connection';
import { resolveVendorId } from './vendor-resolve';
import { getVendorCommissionRate, isCanonicalPackageParentBooking } from './vendor-commission-rate';

function pickBookingRealizedAtIso(booking: Record<string, unknown>): string | undefined {
  const raw = booking.completed_at ?? booking.completedAt ?? booking.updated_at ?? booking.updatedAt;
  if (raw == null || raw === '') return undefined;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export async function ensureVendorEarningsForCompletedBooking(
  booking: Record<string, unknown>,
  bookingId: string,
  logPrefix = '[EARNINGS]',
  options?: { realizedAt?: string }
): Promise<boolean> {
  if (isCanonicalPackageParentBooking(booking)) return false;

  try {
    const rawVendorId = String(booking.vendor_id ?? '');
    const earningsVendorId = await resolveVendorId(rawVendorId);
    const commissionRate = await getVendorCommissionRate(earningsVendorId);
    const totalAmount = parseFloat(String(booking.total_amount ?? '0'));
    const commissionAmount = Math.round((totalAmount * commissionRate) / 100 * 100) / 100;
    const vendorAmount = Math.round((totalAmount - commissionAmount) * 100) / 100;

    if (vendorAmount <= 0) return false;

    const realizedAt =
      options?.realizedAt ?? pickBookingRealizedAtIso(booking) ?? new Date().toISOString();

    // Atomic: parallel backfill / dashboard requests must not double-insert for one booking
    const inserted = await query(
      `INSERT INTO vendor_earnings (
         vendor_id, booking_id, amount, commission_amount, total_amount, commission_rate, status, realized_at
       )
       SELECT $1::uuid, $2::uuid, $3::numeric, $4::numeric, $5::numeric, $6::numeric, 'pending', $7::timestamptz
       WHERE NOT EXISTS (SELECT 1 FROM vendor_earnings WHERE booking_id = $2::uuid)
         AND $3::numeric > 0
       RETURNING id`,
      [
        earningsVendorId,
        bookingId,
        vendorAmount,
        commissionAmount,
        totalAmount,
        commissionRate,
        realizedAt,
      ]
    ).catch(() => ({ rows: [] as { id: string }[] }));

    if (!inserted.rows?.length) return false;

    await query(
      `UPDATE vendors 
       SET pending_payout = COALESCE(pending_payout, 0) + $1,
           total_earnings = COALESCE(total_earnings, 0) + $1,
           updated_at = NOW()
       WHERE id = $2`,
      [vendorAmount, earningsVendorId]
    ).catch((err: unknown) =>
      console.warn(`${logPrefix} vendor totals update:`, (err as Error)?.message)
    );
    return true;
  } catch (error: unknown) {
    console.error(`${logPrefix} Failed to create earnings after booking completion:`, error);
    return false;
  }
}

const DEFAULT_BACKFILL_LIMIT = 200;

/**
 * Idempotent: creates vendor_earnings for completed bookings under these vendor ids
 * that never got a row (e.g. staff completed before API wrote earnings).
 * Uses same commission + package-parent rules as completion handlers.
 */
export async function backfillMissingVendorEarningsForVendorIds(
  vendorIds: string[],
  logPrefix = '[EARNINGS-BACKFILL]',
  limit = DEFAULT_BACKFILL_LIMIT
): Promise<number> {
  const unique = [...new Set((vendorIds || []).filter(Boolean))];
  if (unique.length === 0) return 0;

  const hasTable = await query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'vendor_earnings'
     ) as ex`
  )
    .then((r) => Boolean(r.rows[0]?.ex))
    .catch(() => false);
  if (!hasTable) return 0;

  const missing = await query(
    `SELECT b.*
     FROM bookings b
     WHERE b.status = 'completed'
       AND b.vendor_id = ANY($1::uuid[])
       AND NOT EXISTS (SELECT 1 FROM vendor_earnings ve WHERE ve.booking_id = b.id)
     ORDER BY COALESCE(b.completed_at::timestamptz, b.updated_at::timestamptz) DESC NULLS LAST
     LIMIT $2`,
    [unique, Math.min(Math.max(1, limit), 500)]
  ).catch(() => ({ rows: [] as Record<string, unknown>[] }));

  const rows = missing.rows || [];
  let created = 0;
  for (const b of rows) {
    const id = String(b.id ?? '');
    if (!id) continue;
    const realizedAt = pickBookingRealizedAtIso(b);
    if (
      await ensureVendorEarningsForCompletedBooking(b, id, logPrefix, {
        realizedAt,
      })
    ) {
      created += 1;
    }
  }
  if (created > 0) {
    console.log(`${logPrefix} Created ${created} vendor_earnings row(s) for ${rows.length} candidate booking(s)`);
  }
  return created;
}
