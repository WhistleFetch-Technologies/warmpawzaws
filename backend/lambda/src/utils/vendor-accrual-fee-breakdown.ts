/**
 * Customer checkout fee + GST totals per vendor for IST accrual windows.
 * Bookings: vendor_earnings.realized_at → per-booking customer-paid breakdown with fallbacks.
 * Meals/pharmacy: delivery_settlements.order_delivered_at + settlement fee columns;
 * pharmacy GST split from payments when linked; meal_orders fallback when settlement zeros.
 */
import { query } from '../database/rds-connection';
import {
  FINITE_COMMISSION_AMOUNT_SQL,
  FINITE_NET_PAYOUT_SQL,
  FINITE_ORDER_AMOUNT_SQL,
  safeMoneyAmount,
} from './delivery-settlement-finance';
import { calculateFinalFees, mapCatalogCategoryToBusinessType } from './feeCalculator';
import { resolveLockedBookingGrossFromNotes } from './booking-financial-gross';
import { resolveServiceBookingTaxItem } from './resolve-service-booking-tax-item';

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

const PAYMENT_PREFERRED = `LOWER(TRIM(COALESCE(payment_status, ''))) IN ('completed', 'paid')`;

export type PaymentAccrualSnapshot = {
  platform_fee?: unknown;
  convenience_fee?: unknown;
  delivery_fee?: unknown;
  cgst_amount?: unknown;
  sgst_amount?: unknown;
  igst_amount?: unknown;
  gst_amount?: unknown;
  total_amount?: unknown;
  amount?: unknown;
  fee_breakdown?: unknown;
};

export type BookingAccrualResolveContext = {
  bookingId: string;
  basePrice?: unknown;
  totalAmount?: unknown;
  earningTotalAmount?: unknown;
  taxAmount?: unknown;
  serviceId?: unknown;
  serviceStyle?: unknown;
  serviceType?: unknown;
  categoryName?: unknown;
  categoryId?: unknown;
  vsCategory?: unknown;
  vendorId?: unknown;
  vendorRoleId?: unknown;
  taxCategoryId?: unknown;
  hsnCodeId?: unknown;
  bookingNotes?: unknown;
  payment?: PaymentAccrualSnapshot | null;
};

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

function gstTotalFromParts(cgst: number, sgst: number, igst: number, gstOther: number): number {
  const splitSum = cgst + sgst + igst;
  return round2(splitSum > 0 ? splitSum : gstOther);
}

/** gst_total stores full GST when CGST/SGST/IGST are not split on the source row. */
function rowToBreakdown(row: Record<string, unknown>): VendorAccrualFeeBreakdown {
  const cgst = safeMoneyAmount(row.cgst_amount);
  const sgst = safeMoneyAmount(row.sgst_amount);
  const igst = safeMoneyAmount(row.igst_amount);
  const gstOther = safeMoneyAmount(row.gst_other ?? row.gst_amount);
  return {
    platformFee: safeMoneyAmount(row.platform_fee),
    convenienceFee: safeMoneyAmount(row.convenience_fee),
    deliveryFee: safeMoneyAmount(row.delivery_fee),
    cgstAmount: round2(cgst),
    sgstAmount: round2(sgst),
    igstAmount: round2(igst),
    gstTotal: gstTotalFromParts(cgst, sgst, igst, gstOther),
  };
}

function pickJsonNumber(obj: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
      const n = safeMoneyAmount(obj[key]);
      if (n !== 0 || obj[key] === 0) return n;
    }
  }
  return 0;
}

/** Primary resolver: payment fee/GST columns. */
export function breakdownFromPaymentColumns(payment: PaymentAccrualSnapshot | null | undefined): VendorAccrualFeeBreakdown {
  if (!payment) return { ...EMPTY_BREAKDOWN };
  return rowToBreakdown(payment as Record<string, unknown>);
}

/** Secondary resolver: payments.fee_breakdown JSONB (camelCase or snake_case). */
export function breakdownFromFeeBreakdownJson(raw: unknown): VendorAccrualFeeBreakdown {
  if (raw == null) return { ...EMPTY_BREAKDOWN };
  let obj: Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { ...EMPTY_BREAKDOWN };
    }
  } else if (typeof raw === 'object') {
    obj = raw as Record<string, unknown>;
  } else {
    return { ...EMPTY_BREAKDOWN };
  }

  const cgst = pickJsonNumber(obj, ['cgstAmount', 'cgst_amount', 'totalCGST', 'total_cgst']);
  const sgst = pickJsonNumber(obj, ['sgstAmount', 'sgst_amount', 'totalSGST', 'total_sgst']);
  const igst = pickJsonNumber(obj, ['igstAmount', 'igst_amount', 'totalIGST', 'total_igst']);
  const gstOther = pickJsonNumber(obj, ['gstAmount', 'gst_amount', 'totalTax', 'total_tax', 'gstTotal', 'gst_total']);

  return {
    platformFee: pickJsonNumber(obj, ['platformFee', 'platform_fee']),
    convenienceFee: pickJsonNumber(obj, ['convenienceFee', 'convenience_fee']),
    deliveryFee: pickJsonNumber(obj, ['deliveryFee', 'delivery_fee']),
    cgstAmount: round2(cgst),
    sgstAmount: round2(sgst),
    igstAmount: round2(igst),
    gstTotal: gstTotalFromParts(cgst, sgst, igst, gstOther),
  };
}

export function hasMeaningfulCustomerPaidBreakdown(b: VendorAccrualFeeBreakdown): boolean {
  return (
    b.platformFee > 0.009 ||
    b.convenienceFee > 0.009 ||
    b.deliveryFee > 0.009 ||
    b.cgstAmount > 0.009 ||
    b.sgstAmount > 0.009 ||
    b.igstAmount > 0.009 ||
    b.gstTotal > 0.009
  );
}

function resolveFeeBaseAmount(ctx: BookingAccrualResolveContext): number {
  const basePrice = safeMoneyAmount(ctx.basePrice);
  if (basePrice > 0) return basePrice;
  const bookingTotal = safeMoneyAmount(ctx.totalAmount);
  if (bookingTotal > 0) return bookingTotal;
  return safeMoneyAmount(ctx.earningTotalAmount);
}

function resolveBusinessServiceType(ctx: BookingAccrualResolveContext): string {
  const categoryHint = String(
    ctx.categoryName || ctx.vsCategory || ctx.serviceType || ctx.categoryId || '',
  ).trim();
  return mapCatalogCategoryToBusinessType(categoryHint);
}

async function resolveGstForAccrual(
  ctx: BookingAccrualResolveContext,
  feeBase: number,
  payment: PaymentAccrualSnapshot | null | undefined,
): Promise<Pick<VendorAccrualFeeBreakdown, 'cgstAmount' | 'sgstAmount' | 'igstAmount' | 'gstTotal'>> {
  const fromPayment = breakdownFromPaymentColumns(payment);
  if (fromPayment.cgstAmount + fromPayment.sgstAmount + fromPayment.igstAmount > 0.009) {
    return {
      cgstAmount: fromPayment.cgstAmount,
      sgstAmount: fromPayment.sgstAmount,
      igstAmount: fromPayment.igstAmount,
      gstTotal: fromPayment.gstTotal,
    };
  }

  if (fromPayment.gstTotal > 0.009) {
    return {
      cgstAmount: fromPayment.cgstAmount,
      sgstAmount: fromPayment.sgstAmount,
      igstAmount: fromPayment.igstAmount,
      gstTotal: fromPayment.gstTotal,
    };
  }

  const lockedGross = ctx.bookingNotes != null ? resolveLockedBookingGrossFromNotes(ctx.bookingNotes) : null;
  if (lockedGross && lockedGross.grossTotal > 0) {
    return {
      cgstAmount: round2(lockedGross.cgst),
      sgstAmount: round2(lockedGross.sgst),
      igstAmount: round2(lockedGross.igst),
      gstTotal: round2(lockedGross.totalTax),
    };
  }

  if (ctx.taxAmount !== undefined && ctx.taxAmount !== null && ctx.taxAmount !== '') {
    const bookingTax = safeMoneyAmount(ctx.taxAmount);
    return { cgstAmount: 0, sgstAmount: 0, igstAmount: 0, gstTotal: round2(bookingTax) };
  }

  if (feeBase <= 0.009) {
    return { cgstAmount: 0, sgstAmount: 0, igstAmount: 0, gstTotal: 0 };
  }

  try {
    const { taxItem } = await resolveServiceBookingTaxItem({
      serviceId: ctx.serviceId ? String(ctx.serviceId) : undefined,
      vendorId: ctx.vendorId ? String(ctx.vendorId) : undefined,
      bookingId: ctx.bookingId,
      vendorRoleId: ctx.vendorRoleId ? String(ctx.vendorRoleId) : undefined,
      amount: feeBase,
      quantity: 1,
      category: String(ctx.categoryName || ctx.vsCategory || ctx.serviceType || '') || undefined,
      serviceStyle: String(ctx.serviceStyle || ctx.serviceType || '') || undefined,
    });

    const { taxCalculationService } = await import('../lib/services/tax-calculation-service');
    const taxResult = await taxCalculationService.calculateTax({
      items: [taxItem],
      vendorId: ctx.vendorId ? String(ctx.vendorId) : undefined,
      serviceType: String(ctx.categoryName || ctx.vsCategory || ctx.serviceType || '') || undefined,
      category: String(ctx.categoryName || ctx.vsCategory || ctx.serviceType || '') || undefined,
    });

    const cgst = round2(Number(taxResult.totalCGST) || 0);
    const sgst = round2(Number(taxResult.totalSGST) || 0);
    const igst = round2(Number(taxResult.totalIGST) || 0);
    const gstTotal = gstTotalFromParts(cgst, sgst, igst, round2(Number(taxResult.totalTax) || 0));
    return { cgstAmount: cgst, sgstAmount: sgst, igstAmount: igst, gstTotal };
  } catch (err) {
    console.warn('[vendor-accrual-fee-breakdown] tax recompute failed:', err);
    return { cgstAmount: 0, sgstAmount: 0, igstAmount: 0, gstTotal: 0 };
  }
}

/** Tertiary resolver: checkout pipeline (calculateFinalFees + GST fallbacks). */
export async function recomputeBookingCustomerPaidFeeBreakdown(
  ctx: BookingAccrualResolveContext,
): Promise<VendorAccrualFeeBreakdown> {
  const feeBase = resolveFeeBaseAmount(ctx);
  const businessServiceType = resolveBusinessServiceType(ctx);
  const serviceStyle = String(ctx.serviceStyle || ctx.serviceType || '');

  let platformFee = 0;
  let convenienceFee = 0;
  let deliveryFee = 0;

  try {
    const fees = await calculateFinalFees({
      amount: feeBase,
      type: 'booking',
      serviceStyle,
      businessServiceType,
    });
    platformFee = fees.platformFee;
    convenienceFee = fees.convenienceFee;
    deliveryFee = fees.deliveryFee;
  } catch (err) {
    console.warn('[vendor-accrual-fee-breakdown] fee recompute failed:', err);
    platformFee = Math.min(Math.round((feeBase * 2) / 100), 200);
  }

  const gst = await resolveGstForAccrual(ctx, feeBase, ctx.payment);

  return {
    platformFee: round2(platformFee),
    convenienceFee: round2(convenienceFee),
    deliveryFee: round2(deliveryFee),
    ...gst,
  };
}

/** Full per-booking fallback chain for accrual fee columns. */
export async function resolveBookingCustomerPaidFeeBreakdown(
  ctx: BookingAccrualResolveContext,
): Promise<VendorAccrualFeeBreakdown> {
  const payment = ctx.payment;

  const fromColumns = breakdownFromPaymentColumns(payment);
  if (hasMeaningfulCustomerPaidBreakdown(fromColumns)) {
    return fromColumns;
  }

  const fromJson = breakdownFromFeeBreakdownJson(payment?.fee_breakdown);
  if (hasMeaningfulCustomerPaidBreakdown(fromJson)) {
    return fromJson;
  }

  return recomputeBookingCustomerPaidFeeBreakdown(ctx);
}

export type CustomerPaidFeeBreakdownSource = 'payment_columns' | 'fee_breakdown_json' | 'recomputed';

export async function resolveBookingCustomerPaidFeeBreakdownWithSource(
  ctx: BookingAccrualResolveContext,
): Promise<{ breakdown: VendorAccrualFeeBreakdown; source: CustomerPaidFeeBreakdownSource }> {
  const payment = ctx.payment;

  const fromColumns = breakdownFromPaymentColumns(payment);
  if (hasMeaningfulCustomerPaidBreakdown(fromColumns)) {
    return { breakdown: fromColumns, source: 'payment_columns' };
  }

  const fromJson = breakdownFromFeeBreakdownJson(payment?.fee_breakdown);
  if (hasMeaningfulCustomerPaidBreakdown(fromJson)) {
    return { breakdown: fromJson, source: 'fee_breakdown_json' };
  }

  const breakdown = await recomputeBookingCustomerPaidFeeBreakdown(ctx);
  return { breakdown, source: 'recomputed' };
}

type BookingAccrualRow = {
  vendor_id: string;
  booking_id: string;
  base_price?: unknown;
  total_amount?: unknown;
  earning_total_amount?: unknown;
  tax_amount?: unknown;
  service_id?: unknown;
  service_style?: unknown;
  service_type?: unknown;
  category_name?: unknown;
  category_id?: unknown;
  vs_category?: unknown;
  vendor_role_id?: unknown;
  tax_category_id?: unknown;
  hsn_code_id?: unknown;
  booking_notes?: unknown;
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
};

function rowToResolveContext(row: BookingAccrualRow): BookingAccrualResolveContext {
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

async function aggregateBookingFeeBreakdownsForIstRange(
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
            ve.booking_id::text AS booking_id,
            b.base_price,
            b.total_amount,
            ve.total_amount AS earning_total_amount,
            b.tax_amount,
            b.service_id::text AS service_id,
            b.service_style,
            b.service_type,
            sc.category_name,
            sc.category_id::text AS category_id,
            vs.category AS vs_category,
            v.role_id::text AS vendor_role_id,
            sc.tax_category_id::text AS tax_category_id,
            sc.hsn_code_id::text AS hsn_code_id,
            b.notes AS booking_notes,
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
     LEFT JOIN vendors v ON v.id = ve.vendor_id
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
       AND (ve.status IS DISTINCT FROM 'cancelled')`,
    [periodStartYmd, periodEndExclusiveYmd],
  ).catch(() => ({ rows: [] }));

  const rows = (bookingRes.rows || []) as BookingAccrualRow[];
  const breakdownByBooking = new Map<string, VendorAccrualFeeBreakdown>();

  for (const row of rows) {
    const bookingId = String(row.booking_id || '');
    if (!bookingId) continue;

    if (!breakdownByBooking.has(bookingId)) {
      breakdownByBooking.set(bookingId, await resolveBookingCustomerPaidFeeBreakdown(rowToResolveContext(row)));
    }

    const vendorId = String(row.vendor_id || '');
    if (!vendorId) continue;

    const piece = breakdownByBooking.get(bookingId)!;
    out.set(vendorId, out.has(vendorId) ? addBreakdown(out.get(vendorId)!, piece) : piece);
  }

  return out;
}

/**
 * @param periodStartYmd IST inclusive calendar date (YYYY-MM-DD)
 * @param periodEndExclusiveYmd IST exclusive end date (next day or next month 1st)
 */
export async function fetchVendorAccrualFeeBreakdownForIstRange(
  periodStartYmd: string,
  periodEndExclusiveYmd: string,
): Promise<Map<string, VendorAccrualFeeBreakdown>> {
  const out = await aggregateBookingFeeBreakdownsForIstRange(periodStartYmd, periodEndExclusiveYmd);

  const deliveryRes = await query(
    `WITH bounds AS (
       SELECT
         (to_timestamp($1::text || ' 00:00:00', 'YYYY-MM-DD HH24:MI:SS') AT TIME ZONE 'Asia/Kolkata') AS start_ts,
         (to_timestamp($2::text || ' 00:00:00', 'YYYY-MM-DD HH24:MI:SS') AT TIME ZONE 'Asia/Kolkata') AS end_ts
     )
     SELECT ds.vendor_id::text AS vendor_id,
            COALESCE(SUM(COALESCE(NULLIF(ds.platform_fee, 0), mo.platform_fee, 0)), 0)::numeric(14,2) AS platform_fee,
            COALESCE(SUM(COALESCE(NULLIF(ds.convenience_fee, 0), 0)), 0)::numeric(14,2) AS convenience_fee,
            COALESCE(SUM(COALESCE(NULLIF(ds.delivery_fee_collected, 0), mo.delivery_fee, 0)), 0)::numeric(14,2) AS delivery_fee,
            COALESCE(SUM(COALESCE(pp.cgst_amount, 0)), 0)::numeric(14,2) AS cgst_amount,
            COALESCE(SUM(COALESCE(pp.sgst_amount, 0)), 0)::numeric(14,2) AS sgst_amount,
            COALESCE(SUM(COALESCE(pp.igst_amount, 0)), 0)::numeric(14,2) AS igst_amount,
            COALESCE(SUM(
              CASE
                WHEN COALESCE(pp.cgst_amount, 0) + COALESCE(pp.sgst_amount, 0) + COALESCE(pp.igst_amount, 0) > 0
                  THEN 0
                ELSE COALESCE(NULLIF(ds.gst_amount, 0), 0) + COALESCE(pp.gst_amount, 0)
              END
            ), 0)::numeric(14,2) AS gst_other
     FROM delivery_settlements ds
     CROSS JOIN bounds b
     LEFT JOIN meal_orders mo ON mo.id = ds.meal_order_id
     LEFT JOIN LATERAL (
       SELECT platform_fee, convenience_fee, delivery_fee,
              cgst_amount, sgst_amount, igst_amount, gst_amount
       FROM payments
       WHERE pharmacy_order_id = ds.pharmacy_order_id
         AND ${PAYMENT_OK}
       ORDER BY CASE WHEN ${PAYMENT_PREFERRED} THEN 0 ELSE 1 END,
                COALESCE(completed_at, created_at) DESC NULLS LAST
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
    String(row.gst_total ?? ''),
  ];
}

/** Re-export finance SQL tokens for tests / docs parity with daily accrual. */
export { FINITE_COMMISSION_AMOUNT_SQL, FINITE_NET_PAYOUT_SQL, FINITE_ORDER_AMOUNT_SQL };
