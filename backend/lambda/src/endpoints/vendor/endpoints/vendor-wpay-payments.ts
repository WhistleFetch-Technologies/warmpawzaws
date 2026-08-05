import type { Hono } from 'hono';
import { query } from '../../../database/rds-connection';
import { resolveVendorId, resolveVendorIdsForLedger } from '../../../utils/vendor-resolve';
import { mapWpaySettlementLedgerStatus } from '../../customer/warmpawz-pay/shared/accrue-wpay-settlement';

const VENDOR_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EARNINGS_PERIOD_TZ = 'Asia/Kolkata';

function safeMoneyAmount(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function normalizeEarningsPeriod(raw: string | undefined): string {
  const p = String(raw || 'month').toLowerCase();
  if (p === 'all') return 'lifetime';
  if (p === 'day' || p === 'week' || p === 'month' || p === 'year' || p === 'lifetime') return p;
  return 'month';
}

function sqlTimestampInEarningsPeriod(period: string, columnExpr: string): string {
  const col = columnExpr;
  switch (period) {
    case 'day':
      return `(${col} IS NOT NULL AND ${col} >= (timezone('${EARNINGS_PERIOD_TZ}', now()))::date::timestamp AT TIME ZONE '${EARNINGS_PERIOD_TZ}' AND ${col} < ((timezone('${EARNINGS_PERIOD_TZ}', now()))::date + interval '1 day')::timestamp AT TIME ZONE '${EARNINGS_PERIOD_TZ}')`;
    case 'week':
      return `(${col} IS NOT NULL AND ${col} >= ((timezone('${EARNINGS_PERIOD_TZ}', now()))::date - interval '6 days')::timestamp AT TIME ZONE '${EARNINGS_PERIOD_TZ}')`;
    case 'month':
      return `(${col} IS NOT NULL AND ${col} >= date_trunc('month', timezone('${EARNINGS_PERIOD_TZ}', now())) AT TIME ZONE '${EARNINGS_PERIOD_TZ}')`;
    case 'year':
      return `(${col} IS NOT NULL AND ${col} >= date_trunc('year', timezone('${EARNINGS_PERIOD_TZ}', now())) AT TIME ZONE '${EARNINGS_PERIOD_TZ}')`;
    default:
      return 'TRUE';
  }
}

function mapPayBillRow(row: Record<string, unknown>) {
  const breakup =
    row.settlement_breakup && typeof row.settlement_breakup === 'object'
      ? (row.settlement_breakup as Record<string, unknown>)
      : {};
  const paidAt =
    row.payment_completed_at || row.settlement_date || row.created_at || null;
  const quotedAmount = safeMoneyAmount(
    breakup.quotedAmount ?? row.original_amount ?? row.total_amount,
  );
  const paidAmount = safeMoneyAmount(row.paid_amount ?? row.total_amount);
  const vendorEarnings = safeMoneyAmount(row.net_amount);
  const platformWithholdAmount = safeMoneyAmount(
    breakup.platformWithholdAmount ?? row.commission_amount,
  );
  const platformWithholdPercent = safeMoneyAmount(
    breakup.platformWithholdPercent ?? 0,
  );

  return {
    id: String(row.id),
    paymentId: row.payment_id ? String(row.payment_id) : null,
    settlementId: String(row.id),
    customerName: String(row.customer_name || 'Customer'),
    paidAt,
    quotedAmount,
    paidAmount,
    vendorEarnings,
    platformWithholdAmount,
    platformWithholdPercent,
    settlementStatus: mapWpaySettlementLedgerStatus(
      row.settlement_status ? String(row.settlement_status) : 'pending',
    ),
    flowType: 'pay_bill' as const,
  };
}

export function registerVendorWpayPaymentsEndpoints(app: Hono): void {
  /**
   * GET /vendor/warmpawz-pay/payments
   * Completed Pay Bill payments for vendor (settlement-centric; no Razorpay/customer fee breakdown).
   */
  app.get('/vendor/warmpawz-pay/payments', async (c) => {
    try {
      const paramVendorId =
        c.req.header('x-vendor-id') || c.req.query('vendorId') || c.req.query('vendor_id');
      if (!paramVendorId) {
        return c.json({ success: false, error: 'vendorId required' }, 400);
      }

      if (paramVendorId === 'test-vendor-id' || !VENDOR_UUID_RE.test(String(paramVendorId))) {
        return c.json({ success: true, payments: [], total: 0, period: normalizeEarningsPeriod(c.req.query('period')) });
      }

      const period = normalizeEarningsPeriod(c.req.query('period'));
      const limitRaw = parseInt(c.req.query('limit') || '50', 10);
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;

      const vendorId = await resolveVendorId(String(paramVendorId));
      let vendorIds = await resolveVendorIdsForLedger(String(paramVendorId));
      if (vendorIds.length === 0) vendorIds = [vendorId];

      const realizedCol = 'COALESCE(p.completed_at, s.settlement_date::timestamptz, s.created_at)';
      const periodSql =
        period !== 'lifetime' ? ` AND ${sqlTimestampInEarningsPeriod(period, realizedCol)}` : '';

      const result = await query(
        `SELECT s.id,
                s.payment_id,
                s.total_amount,
                s.commission_amount,
                s.net_amount,
                s.settlement_status,
                s.settlement_date,
                s.settlement_breakup,
                s.created_at,
                p.original_amount,
                p.amount AS paid_amount,
                p.completed_at AS payment_completed_at,
                c.full_name AS customer_name
         FROM settlements s
         INNER JOIN payments p ON p.id = s.payment_id
         LEFT JOIN customers c ON c.id = p.customer_id
         WHERE s.vendor_id = ANY($1::uuid[])
           AND s.order_type = 'warmpawz_pay'
           AND s.payment_id IS NOT NULL
           AND LOWER(COALESCE(p.payment_status, '')) = 'completed'${periodSql}
         ORDER BY ${realizedCol} DESC NULLS LAST
         LIMIT $2`,
        [vendorIds, limit],
      );

      const payments = (result.rows || []).map((row) => mapPayBillRow(row as Record<string, unknown>));

      return c.json({
        success: true,
        canonicalVendorId: vendorId,
        ledgerVendorIds: vendorIds,
        period,
        payments,
        total: payments.length,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to list Pay Bill payments';
      console.error('[vendor/warmpawz-pay/payments]', error);
      return c.json({ success: false, error: message }, 500);
    }
  });
}
