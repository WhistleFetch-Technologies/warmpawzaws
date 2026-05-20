/**
 * Shared finance helpers for meal/pharmacy hyperlocal delivery_settlements
 * (admin daily accrual + batch settlement calculate-daily).
 */
import { query } from '../database/rds-connection';

export const FINITE_NET_PAYOUT_SQL = `CASE
  WHEN net_payout IS NULL OR net_payout::text = 'NaN' THEN 0
  ELSE net_payout::numeric
END`;

export const FINITE_ORDER_AMOUNT_SQL = `CASE
  WHEN order_amount IS NULL OR order_amount::text = 'NaN' THEN 0
  ELSE order_amount::numeric
END`;

export const FINITE_COMMISSION_AMOUNT_SQL = `CASE
  WHEN commission_amount IS NULL OR commission_amount::text = 'NaN' THEN 0
  ELSE commission_amount::numeric
END`;

export function safeMoneyAmount(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export type EligibleDeliverySettlementRow = {
  id: string;
  vendor_id: string;
  order_amount?: string | number | null;
  commission_amount?: string | number | null;
  net_payout?: string | number | null;
  meal_order_id?: string | null;
  pharmacy_order_id?: string | null;
};

/** Pending delivery_settlements past vendor tier hold — same rule as booking calculate-daily. */
export async function fetchEligibleDeliverySettlementsForBatchPayout(): Promise<
  EligibleDeliverySettlementRow[]
> {
  try {
    const res = await query(
      `SELECT ds.id, ds.vendor_id, ds.order_amount, ds.commission_amount, ds.net_payout,
              ds.meal_order_id, ds.pharmacy_order_id
       FROM delivery_settlements ds
       INNER JOIN vendors v ON ds.vendor_id = v.id
       LEFT JOIN vendor_tiers vt ON vt.is_active = true
         AND (TRIM(LOWER(v.tier)) = TRIM(LOWER(vt.tier_name)))
       WHERE LOWER(COALESCE(ds.status, '')) = 'pending'
         AND COALESCE(ds.order_delivered_at, ds.created_at)
           < (NOW() - (COALESCE(vt.payout_period_days, 7) * INTERVAL '1 day'))`,
    );
    return (res.rows || []) as EligibleDeliverySettlementRow[];
  } catch (error) {
    console.warn('[delivery-settlement-finance] eligible batch fetch failed:', error);
    return [];
  }
}
