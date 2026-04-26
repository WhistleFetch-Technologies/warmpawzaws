/**
 * Admin: vendor daily accrual (IST calendar day) from vendor_earnings.realized_at.
 * POST compute materializes vendor_daily_accrual; GET / export.csv list with bank resolution.
 */

import { Hono } from 'hono';
import { query } from '../../../database/rds-connection';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertReportDate(s: string): string | null {
  if (!s || !DATE_RE.test(s)) return null;
  return s;
}

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
} | { ok: false; error: string; status: number }> {
  if (!(await tableExists('vendor_daily_accrual'))) {
    return {
      ok: false,
      error: 'vendor_daily_accrual not found. Apply migration 732_vendor_daily_accrual.sql.',
      status: 503,
    };
  }

  const accrualRes = await query(
    `SELECT a.id, a.report_date, a.vendor_id, a.gross_amount, a.commission_amount, a.net_amount,
            a.earnings_line_count, a.missing_earnings_booking_count, a.currency, a.computed_at,
            v.business_name, v.owner_name, v.phone AS vendor_phone
     FROM vendor_daily_accrual a
     INNER JOIN vendors v ON v.id = a.vendor_id
     WHERE a.report_date = $1::date
     ORDER BY v.business_name ASC NULLS LAST, v.owner_name ASC NULLS LAST`,
    [reportDate]
  ).catch(() => ({ rows: [] }));

  const accrualRows = accrualRes.rows || [];
  const vendorIds: string[] = accrualRows.map((r: { vendor_id: string }) => r.vendor_id);
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

  const rows = accrualRows.map((r: Record<string, unknown>) => {
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

  return { ok: true, rows };
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

      const upsertSql = `
        WITH bounds AS (
          SELECT
            (to_timestamp($1::text || ' 00:00:00', 'YYYY-MM-DD HH24:MI:SS') AT TIME ZONE 'Asia/Kolkata') AS start_ts,
            (to_timestamp((($1::date + INTERVAL '1 day')::date::text) || ' 00:00:00', 'YYYY-MM-DD HH24:MI:SS') AT TIME ZONE 'Asia/Kolkata') AS end_ts
        ),
        earnings_agg AS (
          SELECT ve.vendor_id,
                 COALESCE(SUM(ve.total_amount), 0)::numeric(14,2) AS gross_amount,
                 COALESCE(SUM(ve.commission_amount), 0)::numeric(14,2) AS commission_amount,
                 COALESCE(SUM(ve.amount), 0)::numeric(14,2) AS net_amount,
                 COUNT(*)::int AS earnings_line_count
          FROM vendor_earnings ve
          CROSS JOIN bounds b
          WHERE ve.realized_at >= b.start_ts
            AND ve.realized_at < b.end_ts
            AND (ve.status IS DISTINCT FROM 'cancelled')
          GROUP BY ve.vendor_id
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
        all_vendors AS (
          SELECT vendor_id FROM earnings_agg
          UNION
          SELECT vendor_id FROM gaps
        )
        INSERT INTO vendor_daily_accrual (
          report_date, vendor_id, gross_amount, commission_amount, net_amount,
          earnings_line_count, missing_earnings_booking_count, computed_at
        )
        SELECT
          $1::date,
          av.vendor_id,
          COALESCE(e.gross_amount, 0)::numeric(14,2),
          COALESCE(e.commission_amount, 0)::numeric(14,2),
          COALESCE(e.net_amount, 0)::numeric(14,2),
          COALESCE(e.earnings_line_count, 0),
          COALESCE(g.missing_earnings_booking_count, 0),
          NOW()
        FROM all_vendors av
        LEFT JOIN earnings_agg e ON e.vendor_id = av.vendor_id
        LEFT JOIN gaps g ON g.vendor_id = av.vendor_id
        ON CONFLICT (report_date, vendor_id) DO UPDATE SET
          gross_amount = EXCLUDED.gross_amount,
          commission_amount = EXCLUDED.commission_amount,
          net_amount = EXCLUDED.net_amount,
          earnings_line_count = EXCLUDED.earnings_line_count,
          missing_earnings_booking_count = EXCLUDED.missing_earnings_booking_count,
          computed_at = NOW()
        RETURNING vendor_id
      `;

      const ins = await query(upsertSql, [reportDate]).catch((e: Error) => {
        throw e;
      });
      const vendorIds = (ins.rows || []).map((r: { vendor_id: string }) => r.vendor_id);

      return c.json({
        success: true,
        reportDate,
        timezone: 'Asia/Kolkata',
        anchor:
          'vendor_earnings.realized_at (gross/commission/net); gaps use bookings.completed_at in same IST window',
        rowsUpserted: vendorIds.length,
      });
    } catch (error: any) {
      console.error('[admin-vendor-daily-accrual] compute:', error);
      return c.json({ success: false, error: error?.message || 'Compute failed' }, 500);
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

      const headers = [
        'report_date',
        'vendor_id',
        'business_name',
        'owner_name',
        'vendor_phone',
        'gross_amount',
        'commission_amount',
        'net_amount',
        'currency',
        'earnings_line_count',
        'missing_earnings_booking_count',
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
      for (const r of pack.rows as any[]) {
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
            csvEscape(r.currency),
            csvEscape(r.earnings_line_count),
            csvEscape(r.missing_earnings_booking_count),
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

      const rows = pack.rows;
      const totals = rows.reduce(
        (acc, row: any) => {
          acc.gross += parseFloat(row.gross_amount || '0') || 0;
          acc.commission += parseFloat(row.commission_amount || '0') || 0;
          acc.net += parseFloat(row.net_amount || '0') || 0;
          return acc;
        },
        { gross: 0, commission: 0, net: 0 }
      );

      return c.json({
        success: true,
        reportDate,
        timezone: 'Asia/Kolkata',
        totals: {
          grossAmount: totals.gross,
          commissionAmount: totals.commission,
          netAmount: totals.net,
          vendorCount: rows.length,
        },
        rows,
      });
    } catch (error: any) {
      console.error('[admin-vendor-daily-accrual] list:', error);
      return c.json({ success: false, error: error?.message || 'Failed to load accrual' }, 500);
    }
  });
}
