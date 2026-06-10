/**
 * Customer checkout fee + GST totals per vendor for IST accrual windows.
 * Bookings: vendor_earnings.realized_at → payments (latest completed row per booking).
 * Meals/pharmacy: delivery_settlements.order_delivered_at + settlement fee columns;
 * pharmacy GST split from payments when linked; otherwise delivery_settlements.gst_amount → gst_total.
 */
import { query } from '../database/rds-connection';
import {
  FINITE_COMMISSION_AMOUNT_SQL,
  FINITE_NET_PAYOUT_SQL,
  FINITE_ORDER_AMOUNT_SQL,
  safeMoneyAmount,
} from './delivery-settlement-finance';

export type VendorAccrualFeeBreakdown = {
  platformFee: number;
  convenienceFee: number;
  deliveryFee: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstTotal: number;
};

export const VENDOR_ACCRUAL_FEE_CSV_HEADERS = [
  'platform_fee',
  'convenience_fee',
  'delivery_fee',
  'cgst_amount',
  'sgst_amount',
  'igst_amount',
  'gst_total',
] as const;

const EMPTY_BREAKDOWN: VendorAccrualFeeBreakdown = {
  platformFee: 0,
  convenienceFee: 0,
  deliveryFee: 0,
  cgstAmount: 0,
  sgstAmount: 0,
  igstAmount: 0,
  gstTotal: 0,
};

const PAYMENT_OK = `LOWER(TRIM(COALESCE(payment_status, ''))) IN ('completed', 'success', 'paid', 'partially_refunded')`;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function addBreakdown(a: VendorAccrualFeeBreakdown, b: VendorAccrualFeeBreakdown): VendorAccrualFeeBreakdown {
  return {
    platformFee: round2(a.platformFee + b.platformFee),
    convenienceFee: round2(a.convenienceFee + b.convenienceFee),
    deliveryFee: round2(a.deliveryFee + b.deliveryFee),
    cgstAmount: round2(a.cgstAmount + b.cgstAmount),
    sgstAmount: round2(a.sgstAmount + b.sgstAmount),
    igstAmount: round2(a.igstAmount + b.igstAmount),
    gstTotal: round2(a.gstTotal + b.gstTotal),
  };
}

/** gst_total stores full GST when CGST/SGST/IGST are not split on the source row. */
function rowToBreakdown(row: Record<string, unknown>): VendorAccrualFeeBreakdown {
  const cgst = safeMoneyAmount(row.cgst_amount);
  const sgst = safeMoneyAmount(row.sgst_amount);
  const igst = safeMoneyAmount(row.igst_amount);
  const gstOther = safeMoneyAmount(row.gst_other);
  const splitSum = cgst + sgst + igst;
  return {
    platformFee: safeMoneyAmount(row.platform_fee),
    convenienceFee: safeMoneyAmount(row.convenience_fee),
    deliveryFee: safeMoneyAmount(row.delivery_fee),
    cgstAmount: round2(cgst),
    sgstAmount: round2(sgst),
    igstAmount: round2(igst),
    gstTotal: round2(splitSum > 0 ? splitSum : gstOther),
  };
}

/**
 * @param periodStartYmd IST inclusive calendar date (YYYY-MM-DD)
 * @param periodEndExclusiveYmd IST exclusive end date (next day or next month 1st)
 */
export async function fetchVendorAccrualFeeBreakdownForIstRange(
  periodStartYmd: string,
  periodEndExclusiveYmd: string,
): Promise<Map<string, VendorAccrualFeeBreakdown>> {
  const out = new Map<string, VendorAccrualFeeBreakdown>();

  const bookingRes = await query(
    `WITH bounds AS (
       SELECT
         (to_timestamp($1::text || ' 00:00:00', 'YYYY-MM-DD HH24:MI:SS') AT TIME ZONE 'Asia/Kolkata') AS start_ts,
         (to_timestamp($2::text || ' 00:00:00', 'YYYY-MM-DD HH24:MI:SS') AT TIME ZONE 'Asia/Kolkata') AS end_ts
     )
     SELECT ve.vendor_id::text AS vendor_id,
            COALESCE(SUM(COALESCE(p.platform_fee, 0)), 0)::numeric(14,2) AS platform_fee,
            COALESCE(SUM(COALESCE(p.convenience_fee, 0)), 0)::numeric(14,2) AS convenience_fee,
            COALESCE(SUM(COALESCE(p.delivery_fee, 0)), 0)::numeric(14,2) AS delivery_fee,
            COALESCE(SUM(COALESCE(p.cgst_amount, 0)), 0)::numeric(14,2) AS cgst_amount,
            COALESCE(SUM(COALESCE(p.sgst_amount, 0)), 0)::numeric(14,2) AS sgst_amount,
            COALESCE(SUM(COALESCE(p.igst_amount, 0)), 0)::numeric(14,2) AS igst_amount,
            COALESCE(SUM(
              CASE
                WHEN COALESCE(p.cgst_amount, 0) + COALESCE(p.sgst_amount, 0) + COALESCE(p.igst_amount, 0) > 0
                  THEN 0
                ELSE COALESCE(p.gst_amount, 0)
              END
            ), 0)::numeric(14,2) AS gst_other
     FROM vendor_earnings ve
     CROSS JOIN bounds b
     LEFT JOIN LATERAL (
       SELECT platform_fee, convenience_fee, delivery_fee,
              cgst_amount, sgst_amount, igst_amount, gst_amount, payment_status
       FROM payments
       WHERE booking_id = ve.booking_id
         AND ${PAYMENT_OK}
       ORDER BY CASE WHEN LOWER(TRIM(COALESCE(payment_status, ''))) = 'completed' THEN 0 ELSE 1 END,
                COALESCE(completed_at, created_at) DESC NULLS LAST
       LIMIT 1
     ) p ON true
     WHERE ve.realized_at >= b.start_ts
       AND ve.realized_at < b.end_ts
       AND (ve.status IS DISTINCT FROM 'cancelled')
     GROUP BY ve.vendor_id`,
    [periodStartYmd, periodEndExclusiveYmd],
  ).catch(() => ({ rows: [] }));

  for (const row of bookingRes.rows || []) {
    const id = String(row.vendor_id || '');
    if (!id) continue;
    out.set(id, rowToBreakdown(row as Record<string, unknown>));
  }

  const deliveryRes = await query(
    `WITH bounds AS (
       SELECT
         (to_timestamp($1::text || ' 00:00:00', 'YYYY-MM-DD HH24:MI:SS') AT TIME ZONE 'Asia/Kolkata') AS start_ts,
         (to_timestamp($2::text || ' 00:00:00', 'YYYY-MM-DD HH24:MI:SS') AT TIME ZONE 'Asia/Kolkata') AS end_ts
     )
     SELECT ds.vendor_id::text AS vendor_id,
            COALESCE(SUM(COALESCE(ds.platform_fee, 0)), 0)::numeric(14,2) AS platform_fee,
            COALESCE(SUM(COALESCE(ds.convenience_fee, 0)), 0)::numeric(14,2) AS convenience_fee,
            COALESCE(SUM(COALESCE(ds.delivery_fee_collected, 0)), 0)::numeric(14,2) AS delivery_fee,
            COALESCE(SUM(COALESCE(pp.cgst_amount, 0)), 0)::numeric(14,2) AS cgst_amount,
            COALESCE(SUM(COALESCE(pp.sgst_amount, 0)), 0)::numeric(14,2) AS sgst_amount,
            COALESCE(SUM(COALESCE(pp.igst_amount, 0)), 0)::numeric(14,2) AS igst_amount,
            COALESCE(SUM(
              CASE
                WHEN COALESCE(pp.cgst_amount, 0) + COALESCE(pp.sgst_amount, 0) + COALESCE(pp.igst_amount, 0) > 0
                  THEN 0
                ELSE COALESCE(ds.gst_amount, 0) + COALESCE(pp.gst_amount, 0)
              END
            ), 0)::numeric(14,2) AS gst_other
     FROM delivery_settlements ds
     CROSS JOIN bounds b
     LEFT JOIN LATERAL (
       SELECT platform_fee, convenience_fee, delivery_fee,
              cgst_amount, sgst_amount, igst_amount, gst_amount
       FROM payments
       WHERE pharmacy_order_id = ds.pharmacy_order_id
         AND ${PAYMENT_OK}
       ORDER BY COALESCE(completed_at, created_at) DESC NULLS LAST
       LIMIT 1
     ) pp ON ds.pharmacy_order_id IS NOT NULL
     WHERE COALESCE(ds.order_delivered_at, ds.created_at) >= b.start_ts
       AND COALESCE(ds.order_delivered_at, ds.created_at) < b.end_ts
       AND LOWER(COALESCE(ds.status, '')) NOT IN ('failed', 'cancelled')
     GROUP BY ds.vendor_id`,
    [periodStartYmd, periodEndExclusiveYmd],
  ).catch(() => ({ rows: [] }));

  for (const row of deliveryRes.rows || []) {
    const id = String(row.vendor_id || '');
    if (!id) continue;
    const piece = rowToBreakdown(row as Record<string, unknown>);
    out.set(id, out.has(id) ? addBreakdown(out.get(id)!, piece) : piece);
  }

  return out;
}

export function feeBreakdownForVendor(
  map: Map<string, VendorAccrualFeeBreakdown>,
  vendorId: string,
): VendorAccrualFeeBreakdown {
  return map.get(String(vendorId)) ?? { ...EMPTY_BREAKDOWN };
}

export function mergeFeeBreakdownIntoAccrualRows(
  rows: Record<string, unknown>[],
  feeByVendor: Map<string, VendorAccrualFeeBreakdown>,
): Record<string, unknown>[] {
  return rows.map((r) => {
    const fb = feeBreakdownForVendor(feeByVendor, String(r.vendor_id));
    return {
      ...r,
      platform_fee: fb.platformFee,
      convenience_fee: fb.convenienceFee,
      delivery_fee: fb.deliveryFee,
      cgst_amount: fb.cgstAmount,
      sgst_amount: fb.sgstAmount,
      igst_amount: fb.igstAmount,
      gst_total: fb.gstTotal,
    };
  });
}

export function sumAccrualFeeBreakdowns(rows: Record<string, unknown>[]): VendorAccrualFeeBreakdown {
  return rows.reduce<VendorAccrualFeeBreakdown>(
    (acc, row) =>
      addBreakdown(acc, {
        platformFee: safeMoneyAmount(row.platform_fee),
        convenienceFee: safeMoneyAmount(row.convenience_fee),
        deliveryFee: safeMoneyAmount(row.delivery_fee),
        cgstAmount: safeMoneyAmount(row.cgst_amount),
        sgstAmount: safeMoneyAmount(row.sgst_amount),
        igstAmount: safeMoneyAmount(row.igst_amount),
        gstTotal: safeMoneyAmount(row.gst_total),
      }),
    { ...EMPTY_BREAKDOWN },
  );
}

export function feeBreakdownCsvCells(row: Record<string, unknown>): string[] {
  return [
    String(row.platform_fee ?? ''),
    String(row.convenience_fee ?? ''),
    String(row.delivery_fee ?? ''),
    String(row.cgst_amount ?? ''),
    String(row.sgst_amount ?? ''),
    String(row.igst_amount ?? ''),
    String(row.gst_total ?? ''),
  ];
}

/** Re-export finance SQL tokens for tests / docs parity with daily accrual. */
export { FINITE_COMMISSION_AMOUNT_SQL, FINITE_NET_PAYOUT_SQL, FINITE_ORDER_AMOUNT_SQL };
