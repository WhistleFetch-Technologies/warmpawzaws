import { query } from '../../../database/rds-connection';
import {
  firstSessionPackageBreakdown,
  vendorEarningsAmountsForDisplay,
} from '../../../utils/package-session-earnings-allocation';
import {
  getTemporaryVendorSuppressionParams,
  sqlExcludeSuppressedVendorEarningsRows,
} from '../../../utils/temporary-vendor-ui-suppression';
import { mapWpaySettlementLedgerStatus } from '../../customer/warmpawz-pay/shared/accrue-wpay-settlement';
import { SQL_EXCLUDE_WAPPT_BOOKING_EARNINGS } from '../../warmpawz-appointments/shared/wappt-earnings-policy';
import type { VendorEarningsWindow } from '../../../utils/vendor-earnings-period-sql';

function mapDeliverySettlementLedgerStatus(raw: string | undefined | null): string {
  const k = String(raw || '').toLowerCase();
  if (k === 'transferred') return 'paid_out';
  if (k === 'processing') return 'settled';
  if (k === 'failed') return 'cancelled';
  return 'pending';
}

export function safeMoneyAmount(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export type VendorEarningsLedgerTransaction = {
  id: string;
  bookingId?: string | null;
  paymentId?: string;
  bookingDate?: string | null;
  serviceName: string;
  customerName?: string;
  flowType?: 'pay_bill';
  quotedAmount?: number;
  paidAmount?: number;
  amount: number;
  commission: number;
  totalAmount: number;
  commissionRate: number;
  status: string;
  realizedAt: string | null;
  paidOutAt: string | null;
  settlementId: string | null;
  packageBreakdown?: unknown;
};

export type VendorEarningsLedgerSummary = {
  totalEarnings: number;
  pendingSettlement: number;
  settled: number;
  paidOut: number;
  thisPeriod: number;
  totalCommission: number;
  totalRevenue: number;
};

export type VendorEarningsLedgerResult = {
  earningsRows: Array<Record<string, unknown>>;
  settlementRows: Array<Record<string, unknown>>;
  wpaySettlementRows: Array<Record<string, unknown>>;
  summary: VendorEarningsLedgerSummary;
  transactions: VendorEarningsLedgerTransaction[];
};

function emptySummary(): VendorEarningsLedgerSummary {
  return {
    totalEarnings: 0,
    pendingSettlement: 0,
    settled: 0,
    paidOut: 0,
    thisPeriod: 0,
    totalCommission: 0,
    totalRevenue: 0,
  };
}

function addToSummary(
  summary: VendorEarningsLedgerSummary,
  amount: number,
  commission: number,
  total: number,
  ledgerStatus: string,
  period: string,
  realizedAt: unknown,
): void {
  if (ledgerStatus === 'cancelled') return;
  summary.totalEarnings += amount;
  summary.totalCommission += commission;
  summary.totalRevenue += total;
  if (ledgerStatus === 'pending') summary.pendingSettlement += amount;
  else if (ledgerStatus === 'settled') summary.settled += amount;
  else if (ledgerStatus === 'paid_out') summary.paidOut += amount;
  if (period === 'lifetime') {
    if (realizedAt) summary.thisPeriod += amount;
  } else {
    summary.thisPeriod += amount;
  }
}

/** Same ledger query + payable mapping as GET /vendor/:id/earnings. */
export async function collectVendorEarningsWindow(opts: {
  vendorIds: string[];
  window: VendorEarningsWindow;
}): Promise<VendorEarningsLedgerResult> {
  const { vendorIds, window } = opts;
  const period = window.period;
  const vePeriodSql = window.scoped ? ` AND ${window.periodSql('ve.realized_at')}` : '';
  const dsDeliveredCol = 'COALESCE(ds.order_delivered_at, ds.created_at)';
  const earnSupCtx = getTemporaryVendorSuppressionParams();
  const earnVeFrag = earnSupCtx
    ? ` AND ${sqlExcludeSuppressedVendorEarningsRows('ve', 2, 3)}`
    : '';

  const earningsBookingSelect = `ve.*,
           b.booking_date,
           b.service_id,
           COALESCE(sc.display_name, sc.service_name, s.name, vs.service_name, 'Service') as service_name,
           c.full_name as customer_name,
           COALESCE(b.is_package_session, false) AS is_package_session,
           COALESCE(pp.unlimited_usage, false) AS unlimited_usage,
           COALESCE(
             NULLIF(parent_b.total_amount, 0),
             NULLIF(parent_b.base_price, 0),
             NULLIF(pp.amount, 0),
             NULLIF(pp.package_price, 0),
             0
           ) AS parent_service,
           GREATEST(
             COALESCE(
               NULLIF(pp.total_sessions, 0),
               NULLIF((
                 SELECT COUNT(*)::int FROM package_scheduled_sessions pss
                 WHERE pss.package_purchase_id = b.package_purchase_id
               ), 0),
               1
             ),
             1
           ) AS session_n,
           CASE
             WHEN COALESCE(b.is_package_session, false) AND b.package_purchase_id IS NOT NULL THEN (
               SELECT COUNT(*)::int
               FROM vendor_earnings ve2
               INNER JOIN bookings b2 ON b2.id = ve2.booking_id
               WHERE b2.package_purchase_id = b.package_purchase_id
                 AND COALESCE(b2.is_package_session, false) = true
                 AND ve2.status IS DISTINCT FROM 'cancelled'
                 AND (COALESCE(ve2.realized_at, ve2.created_at), ve2.booking_id)
                   <= (COALESCE(ve.realized_at, ve.created_at), ve.booking_id)
             )
             ELSE NULL
           END AS session_seq`;
  const earningsBookingJoins = `
           LEFT JOIN bookings b ON ve.booking_id = b.id
           LEFT JOIN bookings parent_b ON parent_b.id = b.parent_booking_id
           LEFT JOIN package_purchases pp ON pp.id = b.package_purchase_id
           LEFT JOIN service_catalog sc ON b.service_id = sc.id
           LEFT JOIN services s ON b.service_id = s.id
           LEFT JOIN vendor_services vs ON b.service_id = vs.id
           LEFT JOIN customers c ON b.customer_id = c.id`;
  const earningsQuery = `SELECT ${earningsBookingSelect}
           FROM vendor_earnings ve${earningsBookingJoins}
           WHERE ve.vendor_id = ANY($1::uuid[])
             AND ${SQL_EXCLUDE_WAPPT_BOOKING_EARNINGS}${vePeriodSql}${earnVeFrag}
           ORDER BY ve.realized_at DESC NULLS LAST`;

  const earningsResult = await query(earningsQuery, [
    vendorIds,
    ...(earnSupCtx ? [earnSupCtx.vendorIds, earnSupCtx.cutoffDateIst] : []),
  ]);
  const earnings = (earningsResult.rows || []) as Array<Record<string, any>>;

  const dsPeriodSql = window.scoped ? ` AND ${window.periodSql(dsDeliveredCol)}` : '';
  const settlementsResult = await query(
    `SELECT id, vendor_id, meal_order_id, pharmacy_order_id, order_amount, commission_amount, commission_rate,
                    net_payout, status, order_delivered_at, created_at, actual_payout_date
             FROM delivery_settlements
             WHERE vendor_id = ANY($1::uuid[])${dsPeriodSql}
             ORDER BY COALESCE(order_delivered_at, created_at) DESC`,
    [vendorIds],
  ).catch(() => ({ rows: [] }));
  const settlementRows = (settlementsResult.rows || []) as Array<Record<string, any>>;

  const wpayRealizedCol = 'COALESCE(p.completed_at, s.settlement_date::timestamptz, s.created_at)';
  const wpayPeriodSql = window.scoped ? ` AND ${window.periodSql(wpayRealizedCol)}` : '';
  const wpaySettlementsResult = await query(
    `SELECT s.id,
                    s.vendor_id,
                    s.payment_id,
                    s.total_amount,
                    s.commission_amount,
                    s.net_amount,
                    s.settlement_status,
                    s.settlement_date,
                    s.settlement_breakup,
                    s.created_at,
                    s.completed_at AS settlement_completed_at,
                    p.original_amount,
                    p.amount AS paid_amount,
                    p.completed_at AS payment_completed_at,
                    c.full_name AS customer_name
             FROM settlements s
             INNER JOIN payments p ON p.id = s.payment_id
             LEFT JOIN customers c ON c.id = p.customer_id
             WHERE s.vendor_id = ANY($1::uuid[])
               AND s.order_type = 'warmpawz_pay'
               AND s.payment_id IS NOT NULL${wpayPeriodSql}
             ORDER BY ${wpayRealizedCol} DESC NULLS LAST`,
    [vendorIds],
  ).catch(() => ({ rows: [] }));
  const wpaySettlementRows = (wpaySettlementsResult.rows || []) as Array<Record<string, any>>;

  const summary = emptySummary();

  earnings.forEach((e) => {
    const sliced = vendorEarningsAmountsForDisplay({
      isPackageSession: e.is_package_session,
      unlimited: e.unlimited_usage,
      parentService: e.parent_service,
      sessionCount: e.session_n,
      sessionSeq: e.session_seq,
      storedGross: e.total_amount,
      storedCommission: e.commission_amount,
      storedNet: e.amount,
      commissionRate: e.commission_rate,
    });
    e.amount = sliced.amount;
    e.commission_amount = sliced.commission;
    e.total_amount = sliced.totalAmount;
    addToSummary(
      summary,
      sliced.amount,
      sliced.commission,
      sliced.totalAmount,
      String(e.status || ''),
      period,
      e.realized_at,
    );
  });

  settlementRows.forEach((ds) => {
    const ledgerStatus = mapDeliverySettlementLedgerStatus(ds.status);
    addToSummary(
      summary,
      safeMoneyAmount(ds.net_payout),
      safeMoneyAmount(ds.commission_amount),
      safeMoneyAmount(ds.order_amount),
      ledgerStatus,
      period,
      ds.order_delivered_at || ds.created_at,
    );
  });

  wpaySettlementRows.forEach((ws) => {
    const ledgerStatus = mapWpaySettlementLedgerStatus(ws.settlement_status);
    addToSummary(
      summary,
      safeMoneyAmount(ws.net_amount),
      safeMoneyAmount(ws.commission_amount),
      safeMoneyAmount(ws.total_amount),
      ledgerStatus,
      period,
      ws.payment_completed_at || ws.settlement_date || ws.created_at,
    );
  });

  const bookingTransactions: VendorEarningsLedgerTransaction[] = earnings.map((e) => {
    let meta: Record<string, unknown> = {};
    const rawMeta = e.metadata;
    if (rawMeta && typeof rawMeta === 'object') meta = rawMeta as Record<string, unknown>;
    else if (typeof rawMeta === 'string') {
      try {
        meta = JSON.parse(rawMeta) as Record<string, unknown>;
      } catch {
        meta = {};
      }
    }
    const packageBreakdown =
      firstSessionPackageBreakdown({
        sessionSeq: e.session_seq,
        parentService: e.parent_service,
        sessionCount: e.session_n,
        commissionRate: e.commission_rate,
        thisSession: safeMoneyAmount(e.amount),
      }) ||
      meta.packageBreakdown ||
      meta.package_breakdown ||
      null;
    return {
      id: e.id,
      bookingId: e.booking_id,
      bookingDate: e.booking_date,
      serviceName: e.service_name || 'Service',
      customerName: e.customer_name || 'Customer',
      amount: safeMoneyAmount(e.amount),
      commission: safeMoneyAmount(e.commission_amount),
      totalAmount: safeMoneyAmount(e.total_amount),
      commissionRate: safeMoneyAmount(e.commission_rate),
      status: e.status,
      realizedAt: e.realized_at,
      paidOutAt: e.paid_out_at,
      settlementId: e.settlement_id,
      packageBreakdown,
    };
  });

  const settlementTransactions: VendorEarningsLedgerTransaction[] = settlementRows.map((ds) => ({
      id: ds.id,
      bookingId: ds.meal_order_id || ds.pharmacy_order_id,
      bookingDate: ds.order_delivered_at || ds.created_at,
      serviceName: ds.meal_order_id ? 'Meal delivery' : ds.pharmacy_order_id ? 'Pharmacy delivery' : 'Delivery',
      customerName: 'Customer',
      amount: safeMoneyAmount(ds.net_payout),
      commission: safeMoneyAmount(ds.commission_amount),
      totalAmount: safeMoneyAmount(ds.order_amount),
      commissionRate: safeMoneyAmount(ds.commission_rate),
      status: mapDeliverySettlementLedgerStatus(ds.status),
      realizedAt: ds.order_delivered_at || ds.created_at,
      paidOutAt: ds.actual_payout_date || null,
      settlementId: ds.id,
    }));

  const wpaySettlementTransactions: VendorEarningsLedgerTransaction[] = wpaySettlementRows.map((ws) => {
      const breakup =
        ws.settlement_breakup && typeof ws.settlement_breakup === 'object' ? ws.settlement_breakup : {};
      const quotedAmount = safeMoneyAmount(breakup.quotedAmount ?? ws.original_amount ?? ws.total_amount);
      const realizedAt = ws.payment_completed_at || ws.settlement_date || ws.created_at;
      const withholdPercent = safeMoneyAmount(breakup.platformWithholdPercent);
      return {
        id: ws.id,
        paymentId: ws.payment_id,
        bookingId: null,
        bookingDate: realizedAt,
        serviceName: 'Pay Bill',
        customerName: ws.customer_name || 'Customer',
        flowType: 'pay_bill' as const,
        quotedAmount,
        paidAmount: safeMoneyAmount(ws.paid_amount ?? ws.total_amount),
        amount: safeMoneyAmount(ws.net_amount),
        commission: safeMoneyAmount(ws.commission_amount),
        totalAmount: safeMoneyAmount(ws.total_amount),
        commissionRate: withholdPercent,
        status: mapWpaySettlementLedgerStatus(ws.settlement_status),
        realizedAt,
        paidOutAt: ws.settlement_completed_at || null,
        settlementId: ws.id,
      };
    });

  const transactions = [...bookingTransactions, ...settlementTransactions, ...wpaySettlementTransactions].sort(
    (a, b) => new Date(b.realizedAt || 0).getTime() - new Date(a.realizedAt || 0).getTime(),
  );

  return {
    earningsRows: earnings,
    settlementRows,
    wpaySettlementRows,
    summary,
    transactions,
  };
}
