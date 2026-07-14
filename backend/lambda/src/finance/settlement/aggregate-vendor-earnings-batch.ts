/**
 * Aggregate pending vendor_earnings for daily settlement batch (Finance S2).
 * No commission recalculation — ledger is source of truth.
 */
import { query } from '../../database/rds-connection';

export type AggregatedVendorEarningsSettlement = {
  vendorId: string;
  earningIds: string[];
  bookingIds: string[];
  totalAmount: number;
  commissionAmount: number;
  netAmount: number;
};

export async function fetchEligibleVendorEarningsForBatch(): Promise<
  AggregatedVendorEarningsSettlement[]
> {
  const rows = await query(
    `SELECT ve.id::text AS earning_id,
            ve.booking_id::text AS booking_id,
            ve.vendor_id::text AS vendor_id,
            ve.amount::numeric AS vendor_net,
            ve.commission_amount::numeric AS commission_amount,
            ve.total_amount::numeric AS commission_base
     FROM vendor_earnings ve
     INNER JOIN bookings b ON b.id = ve.booking_id
     INNER JOIN vendors v ON v.id = ve.vendor_id
     LEFT JOIN vendor_tiers vt ON vt.is_active = true
       AND TRIM(LOWER(v.tier)) = TRIM(LOWER(vt.tier_name))
     WHERE ve.status = 'pending'
       AND ve.settlement_id IS NULL
       AND b.status = 'completed'
       AND b.settled_at IS NULL
       AND b.completed_at < (NOW() - (COALESCE(vt.payout_period_days, 7) * INTERVAL '1 day'))
     ORDER BY ve.vendor_id, ve.realized_at ASC NULLS LAST`
  );

  const byVendor = new Map<string, AggregatedVendorEarningsSettlement>();

  for (const row of rows.rows ?? []) {
    const vendorId = String(row.vendor_id || '');
    if (!vendorId) continue;

    let agg = byVendor.get(vendorId);
    if (!agg) {
      agg = {
        vendorId,
        earningIds: [],
        bookingIds: [],
        totalAmount: 0,
        commissionAmount: 0,
        netAmount: 0,
      };
      byVendor.set(vendorId, agg);
    }

    const commissionBase = parseFloat(String(row.commission_base || '0'));
    const commission = parseFloat(String(row.commission_amount || '0'));
    const net = parseFloat(String(row.vendor_net || '0'));

    agg.earningIds.push(String(row.earning_id));
    if (row.booking_id) agg.bookingIds.push(String(row.booking_id));
    agg.totalAmount += commissionBase;
    agg.commissionAmount += commission;
    agg.netAmount += net;
  }

  return [...byVendor.values()];
}

export async function markVendorEarningsSettled(
  earningIds: string[],
  settlementId: string
): Promise<void> {
  if (!earningIds.length) return;
  await query(
    `UPDATE vendor_earnings
     SET settlement_id = $1::uuid,
         status = 'settled'
     WHERE id = ANY($2::uuid[])
       AND settlement_id IS NULL`,
    [settlementId, earningIds]
  ).catch(() => undefined);
}
