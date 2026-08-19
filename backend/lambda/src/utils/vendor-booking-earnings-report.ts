/**
 * Per-booking vendor earnings ledger for admin (IST day or month).
 * Combines vendor_earnings ledger rows with customer-paid checkout breakdown.
 * Finance S2: vendorGross/commission/vendorNet prefer vendor_earnings columns (ledger SoT).
 */
import { query } from '../database/rds-connection';
import { safeMoneyAmount } from './delivery-settlement-finance';
import {
  breakdownFromPaymentColumns,
  hasMeaningfulCustomerPaidBreakdown,
  resolveBookingCustomerPaidFeeBreakdownWithSource,
  shouldAttributeCustomerPaidBreakdown,
  SQL_ACCRUAL_PARENT_AWARE_PAYMENT_LATERAL,
  type BookingAccrualResolveContext,
  type CustomerPaidFeeBreakdownSource,
  type PaymentAccrualSnapshot,
  type VendorAccrualFeeBreakdown,
} from './vendor-accrual-fee-breakdown';
import { parseStoredInterstate } from './gst-split';
import { allocatedEarningsFromStored } from './package-session-earnings-allocation';
import {
  istDayEndExclusiveYmd,
  istMonthEndExclusiveYmd,
  istMonthStartYmd,
} from './vendor-accrual-ist';
import {
  resolveSettlementBreakdownForReport,
  type SettlementBreakdownForReport,
} from './resolve-settlement-breakdown-for-report';
import {
  correctLedgerFromFundingSnapshot,
  resolveStoredGstPercent,
} from './funding-aware-ledger-correction';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type VendorBookingEarningsLine = {
  bookingId: string;
  vendorId: string;
  bookingDate: string | null;
  bookingStatus: string | null;
  serviceName: string | null;
  customerName: string | null;
  couponCode: string | null;
  customerPaidTotal: number;
  serviceBase: number;
  discountAmount: number;
  gstTotal: number;
  gstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  platformFee: number;
  convenienceFee: number;
  deliveryFee: number;
  vendorGross: number;
  commissionRate: number | null;
  commissionAmount: number;
  vendorNet: number;
  feeSource: CustomerPaidFeeBreakdownSource;
  realizedAt: string | null;
  businessName?: string | null;
  settlementBreakdown: SettlementBreakdownForReport;
};

export type { SettlementBreakdownForReport };

export type VendorBookingEarningsDaySummary = {
  vendorId: string;
  businessName: string | null;
  ownerName: string | null;
  bookingCount: number;
  customerPaidTotal: number;
  serviceBaseTotal: number;
  discountTotal: number;
  gstTotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  platformFeeTotal: number;
  convenienceFeeTotal: number;
  deliveryFeeTotal: number;
  vendorGross: number;
  commissionTotal: number;
  vendorNet: number;
};

export type VendorBookingEarningsDayTotals = Omit<
  VendorBookingEarningsDaySummary,
  'vendorId' | 'businessName' | 'ownerName'
> & { vendorCount: number };

type RawEarningsRow = {
  vendor_id: string;
  booking_id: string;
  business_name?: string | null;
  owner_name?: string | null;
  base_price?: unknown;
  total_amount?: unknown;
  discount_amount?: unknown;
  coupon_code?: unknown;
  tax_amount?: unknown;
  booking_date?: unknown;
  booking_status?: unknown;
  service_name?: unknown;
  customer_name?: unknown;
  earning_total_amount?: unknown;
  earning_commission_amount?: unknown;
  earning_net_amount?: unknown;
  commission_rate?: unknown;
  realized_at?: unknown;
  service_id?: unknown;
  service_style?: unknown;
  service_type?: unknown;
  category_name?: unknown;
  category_id?: unknown;
  vs_category?: unknown;
  vendor_role_id?: unknown;
  tax_category_id?: unknown;
  hsn_code_id?: unknown;
  platform_fee?: unknown;
  convenience_fee?: unknown;
  delivery_fee?: unknown;
  cgst_amount?: unknown;
  sgst_amount?: unknown;
  igst_amount?: unknown;
  gst_amount?: unknown;
  gst_rate?: unknown;
  is_inter_state?: unknown;
  payment_total_amount?: unknown;
  payment_amount?: unknown;
  payment_wallet_amount_used?: unknown;
  fee_breakdown?: unknown;
  earnings_metadata?: unknown;
  settlement_id?: unknown;
  payout_id?: unknown;
  settlement_status?: unknown;
  payout_status?: unknown;
  booking_notes?: unknown;
  booking_financial_meta?: unknown;
  payment_id?: unknown;
  parent_booking_id?: unknown;
  gst_identity?: unknown;
  gst_attribute_booking_id?: unknown;
  is_package_session?: unknown;
  package_purchase_id?: unknown;
  parent_service?: unknown;
  session_n?: unknown;
  session_seq?: unknown;
  unlimited_usage?: unknown;
};

function rowToResolveContext(row: RawEarningsRow): BookingAccrualResolveContext {
  return {
    bookingId: String(row.booking_id),
    basePrice: row.base_price,
    totalAmount: row.total_amount,
    discountAmount: row.discount_amount,
    earningTotalAmount: row.earning_total_amount,
    taxAmount: row.tax_amount,
    serviceId: row.service_id,
    serviceStyle: row.service_style,
    serviceType: row.service_type,
    categoryName: row.category_name,
    categoryId: row.category_id,
    vsCategory: row.vs_category,
    vendorId: row.vendor_id,
    vendorRoleId: row.vendor_role_id,
    taxCategoryId: row.tax_category_id,
    hsnCodeId: row.hsn_code_id,
    bookingNotes: row.booking_notes,
    parentBookingId: row.parent_booking_id,
    isInterState: parseStoredInterstate(row.is_inter_state),
    gstIdentity: row.gst_identity != null ? String(row.gst_identity) : undefined,
    gstAttributeBookingId:
      row.gst_attribute_booking_id != null ? String(row.gst_attribute_booking_id) : undefined,
    payment: {
      id: row.payment_id,
      platform_fee: row.platform_fee,
      convenience_fee: row.convenience_fee,
      delivery_fee: row.delivery_fee,
      cgst_amount: row.cgst_amount,
      sgst_amount: row.sgst_amount,
      igst_amount: row.igst_amount,
      gst_amount: row.gst_amount,
      is_inter_state: row.is_inter_state,
      total_amount: row.payment_total_amount,
      amount: row.payment_amount,
      wallet_amount_used: row.payment_wallet_amount_used,
      fee_breakdown: row.fee_breakdown,
    },
  };
}

export function resolveServiceBase(row: RawEarningsRow): number {
  const base = safeMoneyAmount(row.base_price);
  if (base > 0) return round2(base);
  const bookingTotal = safeMoneyAmount(row.total_amount);
  if (bookingTotal > 0) return round2(bookingTotal);
  return round2(safeMoneyAmount(row.earning_total_amount));
}

export function resolveDiscountAmount(row: RawEarningsRow): number {
  return round2(Math.max(0, safeMoneyAmount(row.discount_amount)));
}

export type CustomerPaidOptions = {
  bookingTotal?: number;
  refundedAmount?: number;
  packageSessionUnattributed?: boolean;
};

/**
 * Admin Booking Earnings "Customer Paid" is captured customer money.
 * Never reconstruct as serviceBase + inferred GST + fees.
 * Never use vendor net, commission, or today's Admin GST card.
 */
export function computeCustomerPaidTotal(
  _serviceBase: number,
  _discountAmount: number,
  _fees: VendorAccrualFeeBreakdown,
  payment?: PaymentAccrualSnapshot | null,
  options?: CustomerPaidOptions,
): number {
  if (options?.packageSessionUnattributed) return 0;

  const refunded = round2(Math.max(0, safeMoneyAmount(options?.refundedAmount)));
  const captured = safeMoneyAmount(payment?.amount);
  const storedTotal = safeMoneyAmount(payment?.total_amount);
  const wallet = safeMoneyAmount(payment?.wallet_amount_used ?? payment?.wallet_amount);

  if (captured > 0.009) {
    return round2(Math.max(0, captured + wallet - refunded));
  }
  if (storedTotal > 0.009) {
    return round2(Math.max(0, storedTotal - refunded));
  }
  const bookingTotal = safeMoneyAmount(options?.bookingTotal);
  if (bookingTotal > 0.009) {
    return round2(Math.max(0, bookingTotal - refunded));
  }
  return 0;
}

function emptyDayTotals(): VendorBookingEarningsDayTotals {
  return {
    vendorCount: 0,
    bookingCount: 0,
    customerPaidTotal: 0,
    serviceBaseTotal: 0,
    discountTotal: 0,
    gstTotal: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    platformFeeTotal: 0,
    convenienceFeeTotal: 0,
    deliveryFeeTotal: 0,
    vendorGross: 0,
    commissionTotal: 0,
    vendorNet: 0,
  };
}

function addToDaySummary(
  acc: VendorBookingEarningsDaySummary,
  line: VendorBookingEarningsLine,
): VendorBookingEarningsDaySummary {
  return {
    ...acc,
    bookingCount: acc.bookingCount + 1,
    customerPaidTotal: round2(acc.customerPaidTotal + line.customerPaidTotal),
    serviceBaseTotal: round2(acc.serviceBaseTotal + line.serviceBase),
    discountTotal: round2(acc.discountTotal + line.discountAmount),
    gstTotal: round2(acc.gstTotal + line.gstTotal),
    cgstAmount: round2(acc.cgstAmount + line.cgstAmount),
    sgstAmount: round2(acc.sgstAmount + line.sgstAmount),
    igstAmount: round2(acc.igstAmount + line.igstAmount),
    platformFeeTotal: round2(acc.platformFeeTotal + line.platformFee),
    convenienceFeeTotal: round2(acc.convenienceFeeTotal + line.convenienceFee),
    deliveryFeeTotal: round2(acc.deliveryFeeTotal + line.deliveryFee),
    vendorGross: round2(acc.vendorGross + line.vendorGross),
    commissionTotal: round2(acc.commissionTotal + line.commissionAmount),
    vendorNet: round2(acc.vendorNet + line.vendorNet),
  };
}

function summaryFromLines(
  vendorId: string,
  businessName: string | null,
  ownerName: string | null,
  lines: VendorBookingEarningsLine[],
): VendorBookingEarningsDaySummary {
  const base: VendorBookingEarningsDaySummary = {
    vendorId,
    businessName,
    ownerName,
    bookingCount: 0,
    customerPaidTotal: 0,
    serviceBaseTotal: 0,
    discountTotal: 0,
    gstTotal: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    platformFeeTotal: 0,
    convenienceFeeTotal: 0,
    deliveryFeeTotal: 0,
    vendorGross: 0,
    commissionTotal: 0,
    vendorNet: 0,
  };
  return lines.reduce(addToDaySummary, base);
}

function totalsFromSummaries(vendors: VendorBookingEarningsDaySummary[]): VendorBookingEarningsDayTotals {
  const totals = emptyDayTotals();
  totals.vendorCount = vendors.length;
  for (const v of vendors) {
    totals.bookingCount += v.bookingCount;
    totals.customerPaidTotal = round2(totals.customerPaidTotal + v.customerPaidTotal);
    totals.serviceBaseTotal = round2(totals.serviceBaseTotal + v.serviceBaseTotal);
    totals.discountTotal = round2(totals.discountTotal + v.discountTotal);
    totals.gstTotal = round2(totals.gstTotal + v.gstTotal);
    totals.cgstAmount = round2(totals.cgstAmount + v.cgstAmount);
    totals.sgstAmount = round2(totals.sgstAmount + v.sgstAmount);
    totals.igstAmount = round2(totals.igstAmount + v.igstAmount);
    totals.platformFeeTotal = round2(totals.platformFeeTotal + v.platformFeeTotal);
    totals.convenienceFeeTotal = round2(totals.convenienceFeeTotal + v.convenienceFeeTotal);
    totals.deliveryFeeTotal = round2(totals.deliveryFeeTotal + v.deliveryFeeTotal);
    totals.vendorGross = round2(totals.vendorGross + v.vendorGross);
    totals.commissionTotal = round2(totals.commissionTotal + v.commissionTotal);
    totals.vendorNet = round2(totals.vendorNet + v.vendorNet);
  }
  return totals;
}

async function fetchRawEarningsRowsForIstRange(
  periodStartYmd: string,
  periodEndExclusiveYmd: string,
  vendorId?: string,
): Promise<RawEarningsRow[]> {
  const params: string[] = [periodStartYmd, periodEndExclusiveYmd];
  let vendorFilter = '';
  if (vendorId) {
    params.push(vendorId);
    vendorFilter = 'AND ve.vendor_id = $3::uuid';
  }

  const res = await query(
    `WITH bounds AS (
       SELECT
         (to_timestamp($1::text || ' 00:00:00', 'YYYY-MM-DD HH24:MI:SS') AT TIME ZONE 'Asia/Kolkata') AS start_ts,
         (to_timestamp($2::text || ' 00:00:00', 'YYYY-MM-DD HH24:MI:SS') AT TIME ZONE 'Asia/Kolkata') AS end_ts
     ),
     in_window AS (
       SELECT ve.vendor_id::text AS vendor_id,
            ve.booking_id::text AS booking_id,
            v.business_name,
            v.owner_name,
            b.base_price,
            b.total_amount,
            b.discount_amount,
            b.coupon_code,
            CASE
              WHEN COALESCE(b.is_package_session, false) THEN COALESCE(parent_b.tax_amount, b.tax_amount)
              ELSE b.tax_amount
            END AS tax_amount,
            b.booking_date::text AS booking_date,
            b.status AS booking_status,
            COALESCE(vs.service_name, sc.service_name) AS service_name,
            COALESCE(c.full_name, c.name, c.phone) AS customer_name,
            ve.total_amount AS earning_total_amount,
            ve.commission_amount AS earning_commission_amount,
            ve.amount AS earning_net_amount,
            ve.commission_rate,
            ve.realized_at::text AS realized_at,
            ve.realized_at AS realized_at_ts,
            ve.metadata AS earnings_metadata,
            ve.settlement_id::text AS settlement_id,
            ve.payout_id::text AS payout_id,
            s.settlement_status,
            po.payout_status,
            CASE
              WHEN COALESCE(b.is_package_session, false) THEN COALESCE(parent_b.notes, b.notes)
              ELSE b.notes
            END AS booking_notes,
            b.service_id::text AS service_id,
            b.service_style,
            b.service_type,
            sc.category_name,
            sc.category_id::text AS category_id,
            vs.category AS vs_category,
            v.role_id::text AS vendor_role_id,
            sc.tax_category_id::text AS tax_category_id,
            sc.hsn_code_id::text AS hsn_code_id,
            p.id::text AS payment_id,
            b.parent_booking_id::text AS parent_booking_id,
            COALESCE(b.is_package_session, false) AS is_package_session,
            b.package_purchase_id::text AS package_purchase_id,
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
            p.platform_fee,
            p.convenience_fee,
            p.delivery_fee,
            p.cgst_amount,
            p.sgst_amount,
            p.igst_amount,
            p.gst_amount,
            p.gst_rate,
            p.is_inter_state,
            p.total_amount AS payment_total_amount,
            p.amount AS payment_amount,
            p.wallet_amount_used AS payment_wallet_amount_used,
            p.fee_breakdown,
            COALESCE(p.id::text, b.parent_booking_id::text, ve.booking_id::text) AS gst_identity
     FROM vendor_earnings ve
     CROSS JOIN bounds bnd
     INNER JOIN bookings b ON b.id = ve.booking_id
     INNER JOIN vendors v ON v.id = ve.vendor_id
     LEFT JOIN settlements s ON s.id = ve.settlement_id
     LEFT JOIN payouts po ON po.id = ve.payout_id
     LEFT JOIN customers c ON c.id = b.customer_id
     LEFT JOIN vendor_services vs ON vs.id = b.service_id
     LEFT JOIN service_catalog sc ON sc.id = vs.service_id
     LEFT JOIN package_purchases pp ON pp.id = b.package_purchase_id
     ${SQL_ACCRUAL_PARENT_AWARE_PAYMENT_LATERAL}
     WHERE ve.realized_at >= bnd.start_ts
       AND ve.realized_at < bnd.end_ts
       AND (ve.status IS DISTINCT FROM 'cancelled')
       ${vendorFilter}
     ),
     session_seq AS (
       SELECT ve.booking_id::text AS booking_id,
              ROW_NUMBER() OVER (
                PARTITION BY b.package_purchase_id
                ORDER BY ve.realized_at, ve.booking_id
              ) AS session_seq
       FROM vendor_earnings ve
       INNER JOIN bookings b ON b.id = ve.booking_id
       WHERE COALESCE(b.is_package_session, false) = true
         AND b.package_purchase_id IS NOT NULL
         AND (ve.status IS DISTINCT FROM 'cancelled')
         AND b.package_purchase_id::text IN (
           SELECT package_purchase_id FROM in_window WHERE package_purchase_id IS NOT NULL
         )
     ),
     first_attr AS (
       SELECT DISTINCT ON (COALESCE(p.id::text, b.parent_booking_id::text, ve.booking_id::text))
              COALESCE(p.id::text, b.parent_booking_id::text, ve.booking_id::text) AS gst_identity,
              ve.booking_id::text AS gst_attribute_booking_id
       FROM vendor_earnings ve
       INNER JOIN bookings b ON b.id = ve.booking_id
       ${SQL_ACCRUAL_PARENT_AWARE_PAYMENT_LATERAL}
       WHERE (ve.status IS DISTINCT FROM 'cancelled')
         AND COALESCE(p.id::text, b.parent_booking_id::text, ve.booking_id::text) IN (
           SELECT gst_identity FROM in_window
         )
       ORDER BY COALESCE(p.id::text, b.parent_booking_id::text, ve.booking_id::text),
                ve.realized_at,
                ve.booking_id
     )
     SELECT iw.*, ss.session_seq, fa.gst_attribute_booking_id
     FROM in_window iw
     LEFT JOIN session_seq ss ON ss.booking_id = iw.booking_id
     LEFT JOIN first_attr fa ON fa.gst_identity = iw.gst_identity
     ORDER BY iw.business_name ASC NULLS LAST, iw.realized_at_ts ASC NULLS LAST`,
    params,
  ).catch((err) => {
    console.error('[vendor-booking-earnings-report] fetchRawEarningsRowsForIstRange failed:', err);
    return { rows: [] };
  });

  return (res.rows || []) as RawEarningsRow[];
}

export async function buildVendorBookingEarningsLine(
  row: RawEarningsRow,
): Promise<VendorBookingEarningsLine> {
  const ctx = rowToResolveContext(row);
  const attributed = shouldAttributeCustomerPaidBreakdown(
    String(row.booking_id),
    ctx.gstAttributeBookingId,
  );
  const { breakdown: resolvedBreakdown, source } = await resolveBookingCustomerPaidFeeBreakdownWithSource(ctx);
  const emptyFees: VendorAccrualFeeBreakdown = {
    platformFee: 0,
    convenienceFee: 0,
    deliveryFee: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    gstTotal: 0,
  };
  const breakdown = attributed ? resolvedBreakdown : emptyFees;
  const isPackageSession = row.is_package_session === true || row.is_package_session === 't';
  const allocated = allocatedEarningsFromStored({
    isPackageSession,
    unlimited: row.unlimited_usage === true || row.unlimited_usage === 't',
    parentService: safeMoneyAmount(row.parent_service),
    sessionCount: Number(row.session_n || 0),
    sessionSeq: row.session_seq == null ? null : Number(row.session_seq),
    storedGross: safeMoneyAmount(row.earning_total_amount),
    storedCommission: safeMoneyAmount(row.earning_commission_amount),
    storedNet: safeMoneyAmount(row.earning_net_amount),
    commissionRate: safeMoneyAmount(row.commission_rate) || null,
  });
  const serviceBase = allocated.gross > 0.009 && isPackageSession
    ? allocated.gross
    : resolveServiceBase(row);
  const discountAmount = resolveDiscountAmount(row);
  const payment = attributed ? ctx.payment : null;

  const customerPaidTotal = computeCustomerPaidTotal(serviceBase, discountAmount, breakdown, payment, {
    bookingTotal: safeMoneyAmount(row.total_amount),
    packageSessionUnattributed: isPackageSession && !attributed,
  });
  const settlementBreakdown = resolveSettlementBreakdownForReport({
    earningsMetadata: row.earnings_metadata,
    bookingNotes: row.booking_notes,
    bookingFinancialMeta: row.booking_financial_meta,
    settlementId: row.settlement_id != null ? String(row.settlement_id) : null,
    settlementStatus: row.settlement_status != null ? String(row.settlement_status) : null,
    payoutId: row.payout_id != null ? String(row.payout_id) : null,
    payoutStatus: row.payout_status != null ? String(row.payout_status) : null,
  });
  const corrected = correctLedgerFromFundingSnapshot(
    { gross: allocated.gross, commission: allocated.commission, net: allocated.net },
    settlementBreakdown,
    customerPaidTotal,
  );
  const vendorGross = corrected.gross;
  const commissionAmount = corrected.commission;
  const vendorNet = corrected.net;
  const commissionRateRaw =
    safeMoneyAmount(row.commission_rate) || settlementBreakdown.commissionRate || 0;
  const commissionRate = commissionRateRaw > 0 ? commissionRateRaw : null;
  const gstRate = resolveStoredGstPercent({
    gstRate: row.gst_rate,
    gstTotal: breakdown.gstTotal,
    taxableValue: Math.max(0, serviceBase - discountAmount),
  });

  return {
    bookingId: String(row.booking_id),
    vendorId: String(row.vendor_id),
    businessName: row.business_name != null ? String(row.business_name) : null,
    bookingDate: row.booking_date != null ? String(row.booking_date) : null,
    bookingStatus: row.booking_status != null ? String(row.booking_status) : null,
    serviceName: row.service_name != null ? String(row.service_name) : null,
    customerName: row.customer_name != null ? String(row.customer_name) : null,
    couponCode: row.coupon_code != null ? String(row.coupon_code) : null,
    customerPaidTotal,
    serviceBase,
    discountAmount,
    gstTotal: breakdown.gstTotal,
    gstRate,
    cgstAmount: breakdown.cgstAmount,
    sgstAmount: breakdown.sgstAmount,
    igstAmount: breakdown.igstAmount,
    platformFee: breakdown.platformFee,
    convenienceFee: breakdown.convenienceFee,
    deliveryFee: breakdown.deliveryFee,
    vendorGross,
    commissionRate,
    commissionAmount,
    vendorNet,
    feeSource: source,
    realizedAt: row.realized_at != null ? String(row.realized_at) : null,
    settlementBreakdown,
  };
}

/** All booking lines for a period (audit export / reconciliation pack). */
export async function fetchAllVendorBookingEarningsLinesForIstRange(
  periodStartYmd: string,
  periodEndExclusiveYmd: string,
): Promise<VendorBookingEarningsLine[]> {
  const rawRows = await fetchRawEarningsRowsForIstRange(periodStartYmd, periodEndExclusiveYmd);
  const lineByBooking = new Map<string, VendorBookingEarningsLine>();
  const linesInOrder: VendorBookingEarningsLine[] = [];

  for (const row of rawRows) {
    const bookingId = String(row.booking_id || '');
    if (!bookingId || lineByBooking.has(bookingId)) continue;
    const line = await buildVendorBookingEarningsLine(row);
    lineByBooking.set(bookingId, line);
    linesInOrder.push(line);
  }

  return linesInOrder;
}

export type VendorBookingEarningsReportPayload = {
  periodType: 'day' | 'month';
  reportDate?: string;
  year?: number;
  month?: number;
  periodStart: string;
  periodEndExclusive: string;
  periodTotals: VendorBookingEarningsDayTotals;
  /** @deprecated use periodTotals */
  dayTotals: VendorBookingEarningsDayTotals;
  vendors: VendorBookingEarningsDaySummary[];
  bookings: VendorBookingEarningsLine[];
};

export async function fetchVendorBookingEarningsForIstRange(
  periodStartYmd: string,
  periodEndExclusiveYmd: string,
  vendorId: string | undefined,
  meta: { periodType: 'day' | 'month'; reportDate?: string; year?: number; month?: number },
): Promise<VendorBookingEarningsReportPayload> {
  const rawRows = await fetchRawEarningsRowsForIstRange(periodStartYmd, periodEndExclusiveYmd, vendorId);
  const lineByBooking = new Map<string, VendorBookingEarningsLine>();
  const linesInOrder: VendorBookingEarningsLine[] = [];

  for (const row of rawRows) {
    const bookingId = String(row.booking_id || '');
    if (!bookingId || lineByBooking.has(bookingId)) continue;
    const line = await buildVendorBookingEarningsLine(row);
    lineByBooking.set(bookingId, line);
    linesInOrder.push(line);
  }

  const byVendor = new Map<string, VendorBookingEarningsLine[]>();
  for (const line of linesInOrder) {
    const list = byVendor.get(line.vendorId) || [];
    list.push(line);
    byVendor.set(line.vendorId, list);
  }

  const vendorMeta = new Map<string, { businessName: string | null; ownerName: string | null }>();
  for (const row of rawRows) {
    const id = String(row.vendor_id);
    if (!vendorMeta.has(id)) {
      vendorMeta.set(id, {
        businessName: row.business_name != null ? String(row.business_name) : null,
        ownerName: row.owner_name != null ? String(row.owner_name) : null,
      });
    }
  }

  const vendors: VendorBookingEarningsDaySummary[] = [];
  for (const [id, vendorLines] of byVendor.entries()) {
    const vmeta = vendorMeta.get(id);
    vendors.push(
      summaryFromLines(id, vmeta?.businessName ?? null, vmeta?.ownerName ?? null, vendorLines),
    );
  }

  vendors.sort((a, b) =>
    String(a.businessName || '').localeCompare(String(b.businessName || ''), 'en', {
      sensitivity: 'base',
    }),
  );

  const bookings = vendorId ? linesInOrder.filter((l) => l.vendorId === vendorId) : [];
  const periodTotals = totalsFromSummaries(vendors);

  return {
    periodType: meta.periodType,
    reportDate: meta.reportDate,
    year: meta.year,
    month: meta.month,
    periodStart: periodStartYmd,
    periodEndExclusive: periodEndExclusiveYmd,
    periodTotals,
    dayTotals: periodTotals,
    vendors,
    bookings,
  };
}

export async function fetchVendorBookingEarningsForIstDay(
  reportDateYmd: string,
  vendorId?: string,
): Promise<VendorBookingEarningsReportPayload> {
  const periodEndExclusive = istDayEndExclusiveYmd(reportDateYmd);
  if (!periodEndExclusive) {
    throw new Error('Invalid reportDate');
  }
  return fetchVendorBookingEarningsForIstRange(reportDateYmd, periodEndExclusive, vendorId, {
    periodType: 'day',
    reportDate: reportDateYmd,
  });
}

export async function fetchVendorBookingEarningsForIstMonth(
  year: number,
  month: number,
  vendorId?: string,
): Promise<VendorBookingEarningsReportPayload> {
  const periodStart = istMonthStartYmd(year, month);
  const periodEndExclusive = istMonthEndExclusiveYmd(year, month);
  return fetchVendorBookingEarningsForIstRange(periodStart, periodEndExclusive, vendorId, {
    periodType: 'month',
    year,
    month,
  });
}

/** Used in tests to detect whether payment row alone explains checkout fees. */
export function feeSourceFromPaymentOnly(payment: PaymentAccrualSnapshot | null | undefined): CustomerPaidFeeBreakdownSource | null {
  const fromColumns = breakdownFromPaymentColumns(payment);
  if (hasMeaningfulCustomerPaidBreakdown(fromColumns)) return 'payment_columns';
  return null;
}
