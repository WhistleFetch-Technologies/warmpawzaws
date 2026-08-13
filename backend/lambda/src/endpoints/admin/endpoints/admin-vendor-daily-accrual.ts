/**
 * Admin: vendor daily accrual (IST calendar day) from vendor_earnings.realized_at
 * plus delivery_settlements (meal/pharmacy) by order_delivered_at.
 * POST compute materializes vendor_daily_accrual; GET / export.csv list with bank resolution.
 */

import { Hono } from 'hono';
import { query } from '../../../database/rds-connection';
import {
  FINITE_COMMISSION_AMOUNT_SQL,
  FINITE_NET_PAYOUT_SQL,
  FINITE_ORDER_AMOUNT_SQL,
} from '../../../utils/delivery-settlement-finance';
import {
  assertReportDate,
  istDayEndExclusiveYmd,
  istMonthEndExclusiveYmd,
  istMonthStartYmd,
  listIstMonthDays,
  parseYearMonthQuery,
} from '../../../utils/vendor-accrual-ist';
import {
  VENDOR_ACCRUAL_FEE_CSV_HEADERS,
  feeBreakdownCsvCells,
  fetchVendorAccrualFeeBreakdownForIstRange,
  mergeFeeBreakdownIntoAccrualRows,
  sumAccrualFeeBreakdowns,
} from '../../../utils/vendor-accrual-fee-breakdown';
import { fetchFundingDiscountTotalsForIstRange } from '../../../utils/resolve-settlement-breakdown-for-report';
import { sqlPackageAllocatedEarningsAgg } from '../../../utils/package-session-earnings-allocation';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const str = String(v);
  if (/[",\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

async function tableExists(name: string): Promise<boolean> {
  const r = await query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS ex`,
    [name]
  ).catch(() => ({ rows: [{ ex: false }] }));
  return Boolean(r.rows?.[0]?.ex);
}

/** IST "yesterday" relative to current instant (for default compute date). */
async function defaultYesterdayIstDate(): Promise<string> {
  const r = await query(
    `SELECT ((timezone('Asia/Kolkata', now()))::date - 1)::text AS d`
  ).catch(() => ({ rows: [{ d: '' }] }));
  const d = r.rows?.[0]?.d;
  return typeof d === 'string' && DATE_RE.test(d) ? d : new Date().toISOString().slice(0, 10);
}

async function fetchAccrualRowsWithBanks(reportDate: string): Promise<{
  ok: true;
  rows: Record<string, unknown>[];
} | { ok: false; error: string; status: 503 }> {
  if (!(await tableExists('vendor_daily_accrual'))) {
    return {
      ok: false,
      error: 'vendor_daily_accrual not found. Apply migration 732_vendor_daily_accrual.sql.',
      status: 503,
    };
  }

  const accrualRes = await query(
    `SELECT a.id, a.report_date, a.vendor_id, a.gross_amount, a.commission_amount, a.net_amount,
            a.earnings_line_count, a.missing_earnings_booking_count,
            a.delivery_settlement_line_count, a.missing_delivery_settlement_count,
            a.currency, a.computed_at,
            v.business_name, v.owner_name, v.phone AS vendor_phone
     FROM vendor_daily_accrual a
     INNER JOIN vendors v ON v.id = a.vendor_id
     WHERE a.report_date = $1::date
     ORDER BY v.business_name ASC NULLS LAST, v.owner_name ASC NULLS LAST`,
    [reportDate]
  ).catch(() => ({ rows: [] }));

  const rows = await attachBankDetailsToAccrualRows(accrualRes.rows || []);
  return { ok: true, rows };
}

async function attachBankDetailsToAccrualRows(
  accrualRows: Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  const vendorIds: string[] = accrualRows.map((r) => String(r.vendor_id));
  const bankByVendor = new Map<string, Record<string, unknown>>();

  const hasAccounts = await tableExists('vendor_bank_accounts');
  const hasDetails = await tableExists('vendor_bank_details');

  if (vendorIds.length > 0 && hasAccounts) {
    const ba = await query(
      `SELECT DISTINCT ON (vendor_id)
         vendor_id, bank_name, account_number, ifsc_code, account_holder_name, is_verified,
         verification_status, razorpay_fund_account_id
       FROM vendor_bank_accounts
       WHERE vendor_id = ANY($1::uuid[])
       ORDER BY vendor_id, is_primary DESC NULLS LAST, created_at DESC`,
      [vendorIds]
    ).catch(() => ({ rows: [] }));
    for (const row of ba.rows || []) {
      bankByVendor.set(String(row.vendor_id), { ...row, _bankSource: 'vendor_bank_accounts' });
    }
  }

  if (hasDetails && vendorIds.length > 0) {
    const missing = vendorIds.filter((id) => !bankByVendor.has(id));
    if (missing.length > 0) {
      const bd = await query(
        `SELECT DISTINCT ON (vendor_id)
           vendor_id, bank_name, account_number, ifsc_code, account_holder_name, is_verified
         FROM vendor_bank_details
         WHERE vendor_id = ANY($1::uuid[])
         ORDER BY vendor_id, created_at DESC`,
        [missing]
      ).catch(() => ({ rows: [] }));
      for (const row of bd.rows || []) {
        const id = String(row.vendor_id);
        if (!bankByVendor.has(id)) {
          bankByVendor.set(id, { ...row, _bankSource: 'vendor_bank_details' });
        }
      }
    }
  }

  return accrualRows.map((r) => {
    const bid = String(r.vendor_id);
    const b = bankByVendor.get(bid);
    return {
      ...r,
      bankName: b?.bank_name ?? null,
      accountNumber: b?.account_number ?? null,
      ifscCode: b?.ifsc_code ?? null,
      accountHolderName: b?.account_holder_name ?? null,
      bankVerified: b?.is_verified ?? null,
      bankVerificationStatus: b?.verification_status ?? null,
      razorpayFundAccountId: b?.razorpay_fund_account_id ?? null,
      bankSource: b?._bankSource ?? null,
      hasBankOnFile: Boolean(b),
    };
  });
}

async function fetchMonthlyAccrualRowsWithBanks(
  year: number,
  month: number
): Promise<
  | { ok: true; rows: Record<string, unknown>[]; monthStart: string; monthEndExclusive: string }
  | { ok: false; error: string; status: 503 }
> {
  if (!(await tableExists('vendor_daily_accrual'))) {
    return {
      ok: false,
      error: 'vendor_daily_accrual not found. Apply migration 732_vendor_daily_accrual.sql.',
      status: 503,
    };
  }

  const monthStart = istMonthStartYmd(year, month);
  const monthEndExclusive = istMonthEndExclusiveYmd(year, month);

  const accrualRes = await query(
    `SELECT a.vendor_id,
            SUM(a.gross_amount)::numeric(14,2) AS gross_amount,
            SUM(a.commission_amount)::numeric(14,2) AS commission_amount,
            SUM(a.net_amount)::numeric(14,2) AS net_amount,
            SUM(a.earnings_line_count)::int AS earnings_line_count,
            SUM(a.missing_earnings_booking_count)::int AS missing_earnings_booking_count,
            SUM(a.delivery_settlement_line_count)::int AS delivery_settlement_line_count,
            SUM(a.missing_delivery_settlement_count)::int AS missing_delivery_settlement_count,
            MAX(a.computed_at) AS computed_at,
            COUNT(DISTINCT a.report_date)::int AS snapshot_day_count,
            MAX(a.currency) AS currency,
            v.business_name, v.owner_name, v.phone AS vendor_phone
     FROM vendor_daily_accrual a
     INNER JOIN vendors v ON v.id = a.vendor_id
     WHERE a.report_date >= $1::date
       AND a.report_date < $2::date
     GROUP BY a.vendor_id, v.business_name, v.owner_name, v.phone
     ORDER BY v.business_name ASC NULLS LAST, v.owner_name ASC NULLS LAST`,
    [monthStart, monthEndExclusive]
  ).catch(() => ({ rows: [] }));

  const rows = await attachBankDetailsToAccrualRows(accrualRes.rows || []);
  return { ok: true, rows, monthStart, monthEndExclusive };
}

function dailyAccrualUpsertSql(): string {
  return `
        WITH bounds AS (
          SELECT
            (to_timestamp($1::text || ' 00:00:00', 'YYYY-MM-DD HH24:MI:SS') AT TIME ZONE 'Asia/Kolkata') AS start_ts,
            (to_timestamp((($1::date + INTERVAL '1 day')::date::text) || ' 00:00:00', 'YYYY-MM-DD HH24:MI:SS') AT TIME ZONE 'Asia/Kolkata') AS end_ts
        ),
        ${sqlPackageAllocatedEarningsAgg()},
        earnings_agg AS (
          SELECT ae.vendor_id,
                 COALESCE(SUM(ae.alloc_gross), 0)::numeric(14,2) AS gross_amount,
                 COALESCE(SUM(
                   CASE
                     WHEN COALESCE(ae.stored_gross, 0) > 0.009
                       THEN ROUND(ae.stored_commission * ae.alloc_gross / ae.stored_gross, 2)
                     ELSE ROUND(ae.alloc_gross * COALESCE(ae.commission_rate, 0) / 100, 2)
                   END
                 ), 0)::numeric(14,2) AS commission_amount,
                 COALESCE(SUM(
                   ae.alloc_gross - CASE
                     WHEN COALESCE(ae.stored_gross, 0) > 0.009
                       THEN ROUND(ae.stored_commission * ae.alloc_gross / ae.stored_gross, 2)
                     ELSE ROUND(ae.alloc_gross * COALESCE(ae.commission_rate, 0) / 100, 2)
                   END
                 ), 0)::numeric(14,2) AS net_amount,
                 COUNT(*)::int AS earnings_line_count
          FROM allocated_earnings ae
          CROSS JOIN bounds b
          WHERE ae.realized_at >= b.start_ts
            AND ae.realized_at < b.end_ts
          GROUP BY ae.vendor_id
        ),
        delivery_agg AS (
          SELECT ds.vendor_id,
                 COALESCE(SUM(${FINITE_ORDER_AMOUNT_SQL}), 0)::numeric(14,2) AS gross_amount,
                 COALESCE(SUM(${FINITE_COMMISSION_AMOUNT_SQL}), 0)::numeric(14,2) AS commission_amount,
                 COALESCE(SUM(${FINITE_NET_PAYOUT_SQL}), 0)::numeric(14,2) AS net_amount,
                 COUNT(*)::int AS delivery_line_count
          FROM delivery_settlements ds
          CROSS JOIN bounds b
          WHERE COALESCE(ds.order_delivered_at, ds.created_at) >= b.start_ts
            AND COALESCE(ds.order_delivered_at, ds.created_at) < b.end_ts
            AND LOWER(COALESCE(ds.status, '')) NOT IN ('failed', 'cancelled')
          GROUP BY ds.vendor_id
        ),
        combined_agg AS (
          SELECT COALESCE(e.vendor_id, d.vendor_id) AS vendor_id,
                 (COALESCE(e.gross_amount, 0) + COALESCE(d.gross_amount, 0))::numeric(14,2) AS gross_amount,
                 (COALESCE(e.commission_amount, 0) + COALESCE(d.commission_amount, 0))::numeric(14,2) AS commission_amount,
                 (COALESCE(e.net_amount, 0) + COALESCE(d.net_amount, 0))::numeric(14,2) AS net_amount,
                 (COALESCE(e.earnings_line_count, 0) + COALESCE(d.delivery_line_count, 0))::int AS earnings_line_count,
                 COALESCE(d.delivery_line_count, 0)::int AS delivery_settlement_line_count
          FROM earnings_agg e
          FULL OUTER JOIN delivery_agg d ON d.vendor_id = e.vendor_id
        ),
        gaps AS (
          SELECT b.vendor_id, COUNT(*)::int AS missing_earnings_booking_count
          FROM bookings b
          CROSS JOIN bounds bnd
          WHERE b.status = 'completed'
            AND b.completed_at >= bnd.start_ts
            AND b.completed_at < bnd.end_ts
            AND NOT EXISTS (SELECT 1 FROM vendor_earnings ve WHERE ve.booking_id = b.id)
          GROUP BY b.vendor_id
        ),
        meal_gaps AS (
          SELECT mo.vendor_id, COUNT(*)::int AS missing_delivery_settlement_count
          FROM meal_orders mo
          CROSS JOIN bounds bnd
          WHERE LOWER(COALESCE(mo.status, '')) = 'delivered'
            AND COALESCE(mo.delivered_at, mo.updated_at) >= bnd.start_ts
            AND COALESCE(mo.delivered_at, mo.updated_at) < bnd.end_ts
            AND NOT EXISTS (SELECT 1 FROM delivery_settlements ds WHERE ds.meal_order_id = mo.id)
          GROUP BY mo.vendor_id
        ),
        all_vendors AS (
          SELECT vendor_id FROM combined_agg
          UNION
          SELECT vendor_id FROM gaps
          UNION
          SELECT vendor_id FROM meal_gaps
        )
        INSERT INTO vendor_daily_accrual (
          report_date, vendor_id, gross_amount, commission_amount, net_amount,
          earnings_line_count, missing_earnings_booking_count,
          delivery_settlement_line_count, missing_delivery_settlement_count,
          computed_at
        )
        SELECT
          $1::date,
          av.vendor_id,
          COALESCE(c.gross_amount, 0)::numeric(14,2),
          COALESCE(c.commission_amount, 0)::numeric(14,2),
          COALESCE(c.net_amount, 0)::numeric(14,2),
          COALESCE(c.earnings_line_count, 0),
          COALESCE(g.missing_earnings_booking_count, 0),
          COALESCE(c.delivery_settlement_line_count, 0),
          COALESCE(mg.missing_delivery_settlement_count, 0),
          NOW()
        FROM all_vendors av
        LEFT JOIN combined_agg c ON c.vendor_id = av.vendor_id
        LEFT JOIN gaps g ON g.vendor_id = av.vendor_id
        LEFT JOIN meal_gaps mg ON mg.vendor_id = av.vendor_id
        ON CONFLICT (report_date, vendor_id) DO UPDATE SET
          gross_amount = EXCLUDED.gross_amount,
          commission_amount = EXCLUDED.commission_amount,
          net_amount = EXCLUDED.net_amount,
          earnings_line_count = EXCLUDED.earnings_line_count,
          missing_earnings_booking_count = EXCLUDED.missing_earnings_booking_count,
          delivery_settlement_line_count = EXCLUDED.delivery_settlement_line_count,
          missing_delivery_settlement_count = EXCLUDED.missing_delivery_settlement_count,
          computed_at = NOW()
        RETURNING vendor_id
      `;
}

async function computeDailyAccrualSnapshot(reportDate: string): Promise<number> {
  const ins = await query(dailyAccrualUpsertSql(), [reportDate]);
  return (ins.rows || []).length;
}

type AccrualMoneyTotals = { gross: number; commission: number; net: number };

type AccrualExportTotals = AccrualMoneyTotals & {
  platformFee: number;
  convenienceFee: number;
  deliveryFee: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstTotal: number;
};

function accrualExportTotals(rows: Record<string, unknown>[]): AccrualExportTotals {
  const money = accrualTotals(rows);
  const fees = sumAccrualFeeBreakdowns(rows);
  return {
    ...money,
    platformFee: fees.platformFee,
    convenienceFee: fees.convenienceFee,
    deliveryFee: fees.deliveryFee,
    cgstAmount: fees.cgstAmount,
    sgstAmount: fees.sgstAmount,
    igstAmount: fees.igstAmount,
    gstTotal: fees.gstTotal,
  };
}

async function enrichAccrualRowsWithFees(
  rows: Record<string, unknown>[],
  periodStartYmd: string,
  periodEndExclusiveYmd: string,
): Promise<Record<string, unknown>[]> {
  const feeByVendor = await fetchVendorAccrualFeeBreakdownForIstRange(
    periodStartYmd,
    periodEndExclusiveYmd,
  );
  return mergeFeeBreakdownIntoAccrualRows(rows, feeByVendor);
}

function accrualTotals(rows: Record<string, unknown>[]): AccrualMoneyTotals {
  return rows.reduce<AccrualMoneyTotals>(
    (acc, row) => {
      acc.gross += parseFloat(String(row.gross_amount || '0')) || 0;
      acc.commission += parseFloat(String(row.commission_amount || '0')) || 0;
      acc.net += parseFloat(String(row.net_amount || '0')) || 0;
      return acc;
    },
    { gross: 0, commission: 0, net: 0 }
  );
}

export function registerAdminVendorDailyAccrualEndpoints(app: Hono) {
  /**
   * POST /admin/finance/vendor-daily-accrual/compute
   * Body: { reportDate?: "YYYY-MM-DD" } — defaults to yesterday (IST).
   */
  app.post('/admin/finance/vendor-daily-accrual/compute', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      let reportDate = assertReportDate(String(body.reportDate || '').trim());
      if (!reportDate) {
        reportDate = await defaultYesterdayIstDate();
      }

      const hasAccrual = await tableExists('vendor_daily_accrual');
      if (!hasAccrual) {
        return c.json(
          {
            success: false,
            error:
              'vendor_daily_accrual table missing. Apply migration 732_vendor_daily_accrual.sql on the database.',
          },
          503
        );
      }

      const hasVe = await tableExists('vendor_earnings');
      if (!hasVe) {
        return c.json({ success: false, error: 'vendor_earnings table not found' }, 503);
      }

      const { recalculatePendingMealDeliverySettlements } = await import(
        '../../../utils/meal-order-settlement'
      );
      const mealSettlementsRecalculated = await recalculatePendingMealDeliverySettlements();

      const rowsUpserted = await computeDailyAccrualSnapshot(reportDate);

      return c.json({
        success: true,
        reportDate,
        timezone: 'Asia/Kolkata',
        anchor:
          'vendor_earnings.realized_at + delivery_settlements.order_delivered_at (gross/commission/net, IST day); booking/meal gap counts in same window',
        mealSettlementsRecalculated,
        rowsUpserted,
      });
    } catch (error: any) {
      console.error('[admin-vendor-daily-accrual] compute:', error);
      return c.json({ success: false, error: error?.message || 'Compute failed' }, 500);
    }
  });

  /**
   * POST /admin/finance/vendor-daily-accrual/monthly/compute
   * Body: { year?: number, month?: number } — defaults to current IST month.
   * Refreshes daily snapshots for each calendar day in the month, then aggregates.
   */
  app.post('/admin/finance/vendor-daily-accrual/monthly/compute', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      let ym = parseYearMonthQuery(String(body.year ?? ''), String(body.month ?? ''));
      if (!ym) {
        const r = await query(
          `SELECT EXTRACT(YEAR FROM timezone('Asia/Kolkata', now()))::int AS y,
                  EXTRACT(MONTH FROM timezone('Asia/Kolkata', now()))::int AS m`
        ).catch(() => ({ rows: [{ y: 0, m: 0 }] }));
        ym = parseYearMonthQuery(String(r.rows?.[0]?.y ?? ''), String(r.rows?.[0]?.m ?? ''));
      }
      if (!ym) {
        return c.json({ success: false, error: 'year and month required (e.g. 2026, 6)' }, 400);
      }

      const hasAccrual = await tableExists('vendor_daily_accrual');
      if (!hasAccrual) {
        return c.json(
          {
            success: false,
            error:
              'vendor_daily_accrual table missing. Apply migration 732_vendor_daily_accrual.sql on the database.',
          },
          503
        );
      }

      const hasVe = await tableExists('vendor_earnings');
      if (!hasVe) {
        return c.json({ success: false, error: 'vendor_earnings table not found' }, 503);
      }

      const { recalculatePendingMealDeliverySettlements } = await import(
        '../../../utils/meal-order-settlement'
      );
      const mealSettlementsRecalculated = await recalculatePendingMealDeliverySettlements();

      const days = listIstMonthDays(ym.year, ym.month);
      let totalRowsUpserted = 0;
      for (const day of days) {
        totalRowsUpserted += await computeDailyAccrualSnapshot(day);
      }

      return c.json({
        success: true,
        year: ym.year,
        month: ym.month,
        timezone: 'Asia/Kolkata',
        monthStart: istMonthStartYmd(ym.year, ym.month),
        monthEndExclusive: istMonthEndExclusiveYmd(ym.year, ym.month),
        daysComputed: days.length,
        totalRowsUpserted,
        mealSettlementsRecalculated,
        anchor:
          'Aggregates daily vendor_daily_accrual snapshots for IST calendar month [1st 00:00, next month 00:00)',
      });
    } catch (error: any) {
      console.error('[admin-vendor-daily-accrual] monthly compute:', error);
      return c.json({ success: false, error: error?.message || 'Monthly compute failed' }, 500);
    }
  });

  /**
   * GET /admin/finance/vendor-daily-accrual/monthly/export.csv?year=2026&month=6
   */
  app.get('/admin/finance/vendor-daily-accrual/monthly/export.csv', async (c) => {
    try {
      const ym = parseYearMonthQuery(c.req.query('year') || '', c.req.query('month') || '');
      if (!ym) {
        return c.text('year and month query params required (e.g. year=2026&month=6)', 400);
      }

      const pack = await fetchMonthlyAccrualRowsWithBanks(ym.year, ym.month);
      if (!pack.ok) {
        return c.text(pack.error, pack.status);
      }

      const rows = await enrichAccrualRowsWithFees(pack.rows, pack.monthStart, pack.monthEndExclusive);

      const ymLabel = `${ym.year}-${String(ym.month).padStart(2, '0')}`;
      const headers = [
        'year',
        'month',
        'month_start',
        'month_end_exclusive',
        'vendor_id',
        'business_name',
        'owner_name',
        'vendor_phone',
        'gross_amount',
        'commission_amount',
        'net_amount',
        ...VENDOR_ACCRUAL_FEE_CSV_HEADERS,
        'currency',
        'earnings_line_count',
        'delivery_settlement_line_count',
        'missing_earnings_booking_count',
        'missing_delivery_settlement_count',
        'snapshot_day_count',
        'bank_name',
        'account_holder_name',
        'account_number',
        'ifsc_code',
        'bank_verified',
        'bank_verification_status',
        'razorpay_fund_account_id',
        'bank_source',
        'computed_at',
      ];
      const lines = [headers.join(',')];
      for (const r of rows as any[]) {
        lines.push(
          [
            csvEscape(ym.year),
            csvEscape(ym.month),
            csvEscape(pack.monthStart),
            csvEscape(pack.monthEndExclusive),
            csvEscape(r.vendor_id),
            csvEscape(r.business_name),
            csvEscape(r.owner_name),
            csvEscape(r.vendor_phone),
            csvEscape(r.gross_amount),
            csvEscape(r.commission_amount),
            csvEscape(r.net_amount),
            ...feeBreakdownCsvCells(r).map(csvEscape),
            csvEscape(r.currency),
            csvEscape(r.earnings_line_count),
            csvEscape(r.delivery_settlement_line_count),
            csvEscape(r.missing_earnings_booking_count),
            csvEscape(r.missing_delivery_settlement_count),
            csvEscape(r.snapshot_day_count),
            csvEscape(r.bankName),
            csvEscape(r.accountHolderName),
            csvEscape(r.accountNumber),
            csvEscape(r.ifscCode),
            csvEscape(r.bankVerified),
            csvEscape(r.bankVerificationStatus),
            csvEscape(r.razorpayFundAccountId),
            csvEscape(r.bankSource),
            csvEscape(r.computed_at),
          ].join(',')
        );
      }
      const csv = lines.join('\r\n');
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="vendor-monthly-accrual-${ymLabel}.csv"`,
        },
      });
    } catch (error: any) {
      console.error('[admin-vendor-daily-accrual] monthly export:', error);
      return c.text(error?.message || 'Monthly export failed', 500);
    }
  });

  /**
   * GET /admin/finance/vendor-daily-accrual/monthly?year=2026&month=6
   */
  app.get('/admin/finance/vendor-daily-accrual/monthly', async (c) => {
    try {
      const ym = parseYearMonthQuery(c.req.query('year') || '', c.req.query('month') || '');
      if (!ym) {
        return c.json({ success: false, error: 'year and month query params required (e.g. year=2026&month=6)' }, 400);
      }

      const pack = await fetchMonthlyAccrualRowsWithBanks(ym.year, ym.month);
      if (!pack.ok) {
        return c.json({ success: false, error: pack.error }, pack.status);
      }

      const rows = await enrichAccrualRowsWithFees(pack.rows, pack.monthStart, pack.monthEndExclusive);
      const totals = accrualExportTotals(rows);
      const fundingTotals = await fetchFundingDiscountTotalsForIstRange(
        pack.monthStart,
        pack.monthEndExclusive,
      );

      return c.json({
        success: true,
        year: ym.year,
        month: ym.month,
        timezone: 'Asia/Kolkata',
        monthStart: pack.monthStart,
        monthEndExclusive: pack.monthEndExclusive,
        totals: {
          grossAmount: totals.gross,
          commissionAmount: totals.commission,
          netAmount: totals.net,
          platformFee: totals.platformFee,
          convenienceFee: totals.convenienceFee,
          deliveryFee: totals.deliveryFee,
          cgstAmount: totals.cgstAmount,
          sgstAmount: totals.sgstAmount,
          igstAmount: totals.igstAmount,
          gstTotal: totals.gstTotal,
          vendorCount: rows.length,
          platformFundedDiscount: fundingTotals.platformFundedTotal,
          vendorFundedDiscount: fundingTotals.vendorFundedTotal,
        },
        rows,
      });
    } catch (error: any) {
      console.error('[admin-vendor-daily-accrual] monthly list:', error);
      return c.json({ success: false, error: error?.message || 'Failed to load monthly accrual' }, 500);
    }
  });

  /**
   * GET /admin/finance/vendor-daily-accrual/export.csv?reportDate=YYYY-MM-DD
   * (Registered before the JSON list route so the static path wins.)
   */
  app.get('/admin/finance/vendor-daily-accrual/export.csv', async (c) => {
    try {
      const reportDate = assertReportDate(c.req.query('reportDate') || '');
      if (!reportDate) {
        return c.text('reportDate query param required (YYYY-MM-DD)', 400);
      }

      const pack = await fetchAccrualRowsWithBanks(reportDate);
      if (!pack.ok) {
        return c.text(pack.error, pack.status);
      }

      const periodEnd = istDayEndExclusiveYmd(reportDate);
      if (!periodEnd) {
        return c.text('Invalid reportDate', 400);
      }
      const rows = await enrichAccrualRowsWithFees(pack.rows, reportDate, periodEnd);

      const headers = [
        'report_date',
        'vendor_id',
        'business_name',
        'owner_name',
        'vendor_phone',
        'gross_amount',
        'commission_amount',
        'net_amount',
        ...VENDOR_ACCRUAL_FEE_CSV_HEADERS,
        'currency',
        'earnings_line_count',
        'delivery_settlement_line_count',
        'missing_earnings_booking_count',
        'missing_delivery_settlement_count',
        'bank_name',
        'account_holder_name',
        'account_number',
        'ifsc_code',
        'bank_verified',
        'bank_verification_status',
        'razorpay_fund_account_id',
        'bank_source',
        'computed_at',
      ];
      const lines = [headers.join(',')];
      for (const r of rows as any[]) {
        lines.push(
          [
            csvEscape(r.report_date),
            csvEscape(r.vendor_id),
            csvEscape(r.business_name),
            csvEscape(r.owner_name),
            csvEscape(r.vendor_phone),
            csvEscape(r.gross_amount),
            csvEscape(r.commission_amount),
            csvEscape(r.net_amount),
            ...feeBreakdownCsvCells(r).map(csvEscape),
            csvEscape(r.currency),
            csvEscape(r.earnings_line_count),
            csvEscape(r.delivery_settlement_line_count),
            csvEscape(r.missing_earnings_booking_count),
            csvEscape(r.missing_delivery_settlement_count),
            csvEscape(r.bankName),
            csvEscape(r.accountHolderName),
            csvEscape(r.accountNumber),
            csvEscape(r.ifscCode),
            csvEscape(r.bankVerified),
            csvEscape(r.bankVerificationStatus),
            csvEscape(r.razorpayFundAccountId),
            csvEscape(r.bankSource),
            csvEscape(r.computed_at),
          ].join(',')
        );
      }
      const csv = lines.join('\r\n');
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="vendor-daily-accrual-${reportDate}.csv"`,
        },
      });
    } catch (error: any) {
      console.error('[admin-vendor-daily-accrual] export:', error);
      return c.text(error?.message || 'Export failed', 500);
    }
  });

  /**
   * GET /admin/finance/vendor-daily-accrual?reportDate=YYYY-MM-DD
   */
  app.get('/admin/finance/vendor-daily-accrual', async (c) => {
    try {
      const reportDate = assertReportDate(c.req.query('reportDate') || '');
      if (!reportDate) {
        return c.json({ success: false, error: 'reportDate query param required (YYYY-MM-DD)' }, 400);
      }

      const pack = await fetchAccrualRowsWithBanks(reportDate);
      if (!pack.ok) {
        return c.json({ success: false, error: pack.error }, pack.status);
      }

      const periodEnd = istDayEndExclusiveYmd(reportDate);
      if (!periodEnd) {
        return c.json({ success: false, error: 'Invalid reportDate' }, 400);
      }
      const rows = await enrichAccrualRowsWithFees(pack.rows, reportDate, periodEnd);
      const totals = accrualExportTotals(rows);
      const fundingTotals = await fetchFundingDiscountTotalsForIstRange(reportDate, periodEnd);

      return c.json({
        success: true,
        reportDate,
        timezone: 'Asia/Kolkata',
        totals: {
          grossAmount: totals.gross,
          commissionAmount: totals.commission,
          netAmount: totals.net,
          platformFee: totals.platformFee,
          convenienceFee: totals.convenienceFee,
          deliveryFee: totals.deliveryFee,
          cgstAmount: totals.cgstAmount,
          sgstAmount: totals.sgstAmount,
          igstAmount: totals.igstAmount,
          gstTotal: totals.gstTotal,
          vendorCount: rows.length,
          platformFundedDiscount: fundingTotals.platformFundedTotal,
          vendorFundedDiscount: fundingTotals.vendorFundedTotal,
        },
        rows,
      });
    } catch (error: any) {
      console.error('[admin-vendor-daily-accrual] list:', error);
      return c.json({ success: false, error: error?.message || 'Failed to load accrual' }, 500);
    }
  });
}
