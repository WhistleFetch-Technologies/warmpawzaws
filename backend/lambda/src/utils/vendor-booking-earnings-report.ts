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
  type BookingAccrualResolveContext,
  type CustomerPaidFeeBreakdownSource,
  type PaymentAccrualSnapshot,
  type VendorAccrualFeeBreakdown,
} from './vendor-accrual-fee-breakdown';
import {
  istDayEndExclusiveYmd,
  istMonthEndExclusiveYmd,
  istMonthStartYmd,
} from './vendor-accrual-ist';
import {
  resolveSettlementBreakdownForReport,
  type SettlementBreakdownForReport,
} from './resolve-settlement-breakdown-for-report';

const PAYMENT_OK = `LOWER(TRIM(COALESCE(payment_status, ''))) IN ('completed', 'success', 'paid', 'partially_refunded')`;
const PAYMENT_PREFERRED = `LOWER(TRIM(COALESCE(payment_status, ''))) IN ('completed', 'paid')`;

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
  payment_total_amount?: unknown;
  payment_amount?: unknown;
  fee_breakdown?: unknown;
  earnings_metadata?: unknown;
  settlement_id?: unknown;
  payout_id?: unknown;
  settlement_status?: unknown;
  payout_status?: unknown;
  booking_notes?: unknown;
  booking_financial_meta?: unknown;
};

function rowToResolveContext(row: RawEarningsRow): BookingAccrualResolveContext {
  return {
    bookingId: String(row.booking_id),
    basePrice: row.base_price,
    totalAmount: row.total_amount,
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
    payment: {
      platform_fee: row.platform_fee,
      convenience_fee: row.convenience_fee,
      delivery_fee: row.delivery_fee,
      cgst_amount: row.cgst_amount,
      sgst_amount: row.sgst_amount,
      igst_amount: row.igst_amount,
      gst_amount: row.gst_amount,
      total_amount: row.payment_total_amount,
      amount: row.payment_amount,
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

export function computeCustomerPaidTotal(
  serviceBase: number,
  discountAmount: number,
  fees: VendorAccrualFeeBreakdown,
  payment?: PaymentAccrualSnapshot | null,
): number {
  const payTotal = safeMoneyAmount(payment?.total_amount);
  if (payTotal > 0) return round2(payTotal);

  const payAmount = safeMoneyAmount(payment?.amount);
  const taxableBase = round2(Math.max(0, serviceBase - discountAmount));
  const computed = round2(
    taxableBase + fees.gstTotal + fees.platformFee + fees.convenienceFee + fees.deliveryFee,
  );

  if (payAmount > computed + 0.01) return round2(payAmount);
  if (computed > 0) return computed;
  return round2(payAmount);
}

function emptyDayTotals(): VendorBookingEarningsDayTotals {
  return {
    vendorCount: 0,
    bookingCount: 0,
    customerPaidTotal: 0,
    serviceBaseTotal: 0,
    discountTotal: 0,
    gstTotal: 0,
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
     )
     SELECT ve.vendor_id::text AS vendor_id,
            ve.booking_id::text AS booking_id,
            v.business_name,
            v.owner_name,
            b.base_price,
            b.total_amount,
            b.discount_amount,
            b.coupon_code,
            b.tax_amount,
            b.booking_date::text AS booking_date,
            b.status AS booking_status,
            COALESCE(vs.service_name, sc.service_name) AS service_name,
            COALESCE(c.full_name, c.name, c.phone) AS customer_name,
            ve.total_amount AS earning_total_amount,
            ve.commission_amount AS earning_commission_amount,
            ve.amount AS earning_net_amount,
            ve.commission_rate,
            ve.realized_at::text AS realized_at,
            ve.metadata AS earnings_metadata,
            ve.settlement_id::text AS settlement_id,
            ve.payout_id::text AS payout_id,
            s.settlement_status,
            po.payout_status,
            b.notes AS booking_notes,
            b.service_id::text AS service_id,
            b.service_style,
            b.service_type,
            sc.category_name,
            sc.category_id::text AS category_id,
            vs.category AS vs_category,
            v.role_id::text AS vendor_role_id,
            sc.tax_category_id::text AS tax_category_id,
            sc.hsn_code_id::text AS hsn_code_id,
            p.platform_fee,
            p.convenience_fee,
            p.delivery_fee,
            p.cgst_amount,
            p.sgst_amount,
            p.igst_amount,
            p.gst_amount,
            p.total_amount AS payment_total_amount,
            p.amount AS payment_amount,
            p.fee_breakdown
     FROM vendor_earnings ve
     CROSS JOIN bounds bnd
     INNER JOIN bookings b ON b.id = ve.booking_id
     INNER JOIN vendors v ON v.id = ve.vendor_id
     LEFT JOIN settlements s ON s.id = ve.settlement_id
     LEFT JOIN payouts po ON po.id = ve.payout_id
     LEFT JOIN customers c ON c.id = b.customer_id
     LEFT JOIN vendor_services vs ON vs.id = b.service_id
     LEFT JOIN service_catalog sc ON sc.id = vs.service_id
     LEFT JOIN LATERAL (
       SELECT platform_fee, convenience_fee, delivery_fee,
              cgst_amount, sgst_amount, igst_amount, gst_amount,
              total_amount, amount, fee_breakdown, payment_status
       FROM payments
       WHERE booking_id = ve.booking_id
         AND ${PAYMENT_OK}
       ORDER BY CASE WHEN ${PAYMENT_PREFERRED} THEN 0 ELSE 1 END,
                COALESCE(completed_at, created_at) DESC NULLS LAST
       LIMIT 1
     ) p ON true
     WHERE ve.realized_at >= bnd.start_ts
       AND ve.realized_at < bnd.end_ts
       AND (ve.status IS DISTINCT FROM 'cancelled')
       ${vendorFilter}
     ORDER BY v.business_name ASC NULLS LAST, ve.realized_at ASC NULLS LAST`,
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
  const { breakdown, source } = await resolveBookingCustomerPaidFeeBreakdownWithSource(ctx);
  const serviceBase = resolveServiceBase(row);
  const discountAmount = resolveDiscountAmount(row);
  const payment = ctx.payment;

  const customerPaidTotal = computeCustomerPaidTotal(serviceBase, discountAmount, breakdown, payment);
  const vendorGross = round2(safeMoneyAmount(row.earning_total_amount));
  const commissionAmount = round2(safeMoneyAmount(row.earning_commission_amount));
  const vendorNet = round2(safeMoneyAmount(row.earning_net_amount));
  const commissionRateRaw = safeMoneyAmount(row.commission_rate);
  const commissionRate = commissionRateRaw > 0 ? commissionRateRaw : null;

  const settlementBreakdown = resolveSettlementBreakdownForReport({
    earningsMetadata: row.earnings_metadata,
    bookingNotes: row.booking_notes,
    bookingFinancialMeta: row.booking_financial_meta,
    settlementId: row.settlement_id != null ? String(row.settlement_id) : null,
    settlementStatus: row.settlement_status != null ? String(row.settlement_status) : null,
    payoutId: row.payout_id != null ? String(row.payout_id) : null,
    payoutStatus: row.payout_status != null ? String(row.payout_status) : null,
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
