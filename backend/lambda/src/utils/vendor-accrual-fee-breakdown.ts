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
import {
  gstFinancialIdentity,
  inferExclusiveGstFromChargedDelta,
  inferInclusiveGstFromListedPrice,
  isZeroRatedHealthcareHint,
  reconstructGstSplit,
} from './gst-split';

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
  id?: unknown;
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
  discountAmount?: unknown;
  earningTotalAmount?: unknown;
  taxAmount?: unknown;
  catalogGstRate?: unknown;
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
  parentBookingId?: unknown;
  isInterState?: boolean;
  gstIdentity?: string;
  gstAttributeBookingId?: string;
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
function rowToBreakdown(row: Record<string, unknown>, isInterState = false): VendorAccrualFeeBreakdown {
  const cgst = safeMoneyAmount(row.cgst_amount);
  const sgst = safeMoneyAmount(row.sgst_amount);
  const igst = safeMoneyAmount(row.igst_amount);
  const gstOther = safeMoneyAmount(row.gst_other ?? row.gst_amount);
  const split = reconstructGstSplit({
    cgstAmount: cgst,
    sgstAmount: sgst,
    igstAmount: igst,
    gstTotal: gstTotalFromParts(cgst, sgst, igst, gstOther),
    isInterState,
  });
  return {
    platformFee: safeMoneyAmount(row.platform_fee),
    convenienceFee: safeMoneyAmount(row.convenience_fee),
    deliveryFee: safeMoneyAmount(row.delivery_fee),
    cgstAmount: split.cgstAmount,
    sgstAmount: split.sgstAmount,
    igstAmount: split.igstAmount,
    gstTotal: split.gstTotal,
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

/** Primary resolver: payment fee/GST columns. Reconstructs CGST/SGST when only gst_amount is stored. */
export function breakdownFromPaymentColumns(
  payment: PaymentAccrualSnapshot | null | undefined,
  isInterState = false,
): VendorAccrualFeeBreakdown {
  if (!payment) return { ...EMPTY_BREAKDOWN };
  return rowToBreakdown(payment as Record<string, unknown>, isInterState);
}

/** Secondary resolver: payments.fee_breakdown JSONB (camelCase or snake_case). */
export function breakdownFromFeeBreakdownJson(raw: unknown, isInterState = false): VendorAccrualFeeBreakdown {
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
  const split = reconstructGstSplit({
    cgstAmount: cgst,
    sgstAmount: sgst,
    igstAmount: igst,
    gstTotal: gstTotalFromParts(cgst, sgst, igst, gstOther),
    isInterState,
  });

  return {
    platformFee: pickJsonNumber(obj, ['platformFee', 'platform_fee']),
    convenienceFee: pickJsonNumber(obj, ['convenienceFee', 'convenience_fee']),
    deliveryFee: pickJsonNumber(obj, ['deliveryFee', 'delivery_fee']),
    cgstAmount: split.cgstAmount,
    sgstAmount: split.sgstAmount,
    igstAmount: split.igstAmount,
    gstTotal: split.gstTotal,
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

function resolveTaxableValue(ctx: BookingAccrualResolveContext): number {
  const base = safeMoneyAmount(ctx.basePrice);
  const discount = safeMoneyAmount(ctx.discountAmount);
  return round2(Math.max(0, base - discount));
}

function resolveChargedCustomerTotal(ctx: BookingAccrualResolveContext): number {
  const payTotal = safeMoneyAmount(ctx.payment?.total_amount);
  if (payTotal > 0.009) return payTotal;
  const payAmount = safeMoneyAmount(ctx.payment?.amount);
  if (payAmount > 0.009) return payAmount;
  return safeMoneyAmount(ctx.totalAmount);
}

function paymentKnownFees(payment: PaymentAccrualSnapshot | null | undefined): number {
  if (!payment) return 0;
  return round2(
    safeMoneyAmount(payment.platform_fee) +
      safeMoneyAmount(payment.convenience_fee) +
      safeMoneyAmount(payment.delivery_fee),
  );
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
  const isInterState = Boolean(ctx.isInterState);
  const fromPayment = breakdownFromPaymentColumns(payment, isInterState);
  if (fromPayment.gstTotal > 0.009) {
    return {
      cgstAmount: fromPayment.cgstAmount,
      sgstAmount: fromPayment.sgstAmount,
      igstAmount: fromPayment.igstAmount,
      gstTotal: fromPayment.gstTotal,
    };
  }

  const lockedGross = ctx.bookingNotes != null ? resolveLockedBookingGrossFromNotes(ctx.bookingNotes) : null;
  if (lockedGross && lockedGross.grossTotal > 0 && lockedGross.totalTax > 0.009) {
    return reconstructGstSplit({
      cgstAmount: lockedGross.cgst,
      sgstAmount: lockedGross.sgst,
      igstAmount: lockedGross.igst,
      gstTotal: lockedGross.totalTax,
      isInterState,
    });
  }

  const taxAmountPresent = ctx.taxAmount !== undefined && ctx.taxAmount !== null && ctx.taxAmount !== '';
  const bookingTax = taxAmountPresent ? safeMoneyAmount(ctx.taxAmount) : 0;
  if (taxAmountPresent && bookingTax > 0.009) {
    return reconstructGstSplit({ gstTotal: bookingTax, isInterState });
  }

  const lockedZeroTax = Boolean(lockedGross && lockedGross.grossTotal > 0 && lockedGross.totalTax <= 0.009);
  if (!lockedZeroTax) {
    const inferred = inferExclusiveGstFromChargedDelta({
      taxableValue: resolveTaxableValue(ctx),
      chargedTotal: resolveChargedCustomerTotal(ctx),
      knownFees: paymentKnownFees(payment),
      catalogGstRate: safeMoneyAmount(ctx.catalogGstRate),
      isInterState,
    });
    if (inferred.gstTotal > 0.009) {
      return inferred;
    }
  }

  const zeroRated = isZeroRatedHealthcareHint({
    catalogGstRate: ctx.catalogGstRate,
    categoryName: ctx.categoryName,
    vsCategory: ctx.vsCategory,
    serviceType: ctx.serviceType,
  });
  if (!lockedZeroTax && !zeroRated) {
    const inclusive = inferInclusiveGstFromListedPrice({
      taxableValue: resolveTaxableValue(ctx),
      chargedTotal: resolveChargedCustomerTotal(ctx),
      vendorGross: safeMoneyAmount(ctx.earningTotalAmount),
      catalogGstRate: ctx.catalogGstRate != null && ctx.catalogGstRate !== ''
        ? safeMoneyAmount(ctx.catalogGstRate)
        : undefined,
      isInterState,
      zeroRated,
    });
    if (inclusive.gstTotal > 0.009) {
      return inclusive;
    }
  }

  if (lockedGross && lockedGross.grossTotal > 0) {
    return { cgstAmount: 0, sgstAmount: 0, igstAmount: 0, gstTotal: 0 };
  }

  if (taxAmountPresent) {
    return { cgstAmount: 0, sgstAmount: 0, igstAmount: 0, gstTotal: 0 };
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
function dropInventedFeesWhenChargedIsTaxablePlusGst(
  ctx: BookingAccrualResolveContext,
  storedFees: VendorAccrualFeeBreakdown,
  recomputed: VendorAccrualFeeBreakdown,
): VendorAccrualFeeBreakdown {
  const charged = resolveChargedCustomerTotal(ctx);
  const taxable = resolveTaxableValue(ctx);
  if (charged <= 0.009) return recomputed;
  const expected = round2(taxable + recomputed.gstTotal);
  if (Math.abs(charged - expected) > 0.05) return recomputed;
  return {
    platformFee: storedFees.platformFee,
    convenienceFee: storedFees.convenienceFee,
    deliveryFee: storedFees.deliveryFee,
    cgstAmount: recomputed.cgstAmount,
    sgstAmount: recomputed.sgstAmount,
    igstAmount: recomputed.igstAmount,
    gstTotal: recomputed.gstTotal,
  };
}

export async function resolveBookingCustomerPaidFeeBreakdown(
  ctx: BookingAccrualResolveContext,
): Promise<VendorAccrualFeeBreakdown> {
  const payment = ctx.payment;

  const fromColumns = breakdownFromPaymentColumns(payment, Boolean(ctx.isInterState));
  if (hasMeaningfulCustomerPaidBreakdown(fromColumns)) {
    return fromColumns;
  }

  const fromJson = breakdownFromFeeBreakdownJson(payment?.fee_breakdown, Boolean(ctx.isInterState));
  if (hasMeaningfulCustomerPaidBreakdown(fromJson)) {
    return fromJson;
  }

  const recomputed = await recomputeBookingCustomerPaidFeeBreakdown(ctx);
  return dropInventedFeesWhenChargedIsTaxablePlusGst(ctx, fromColumns, recomputed);
}

export type CustomerPaidFeeBreakdownSource = 'payment_columns' | 'fee_breakdown_json' | 'recomputed';

export async function resolveBookingCustomerPaidFeeBreakdownWithSource(
  ctx: BookingAccrualResolveContext,
): Promise<{ breakdown: VendorAccrualFeeBreakdown; source: CustomerPaidFeeBreakdownSource }> {
  const payment = ctx.payment;

  const fromColumns = breakdownFromPaymentColumns(payment, Boolean(ctx.isInterState));
  if (hasMeaningfulCustomerPaidBreakdown(fromColumns)) {
    return { breakdown: fromColumns, source: 'payment_columns' };
  }

  const fromJson = breakdownFromFeeBreakdownJson(payment?.fee_breakdown, Boolean(ctx.isInterState));
  if (hasMeaningfulCustomerPaidBreakdown(fromJson)) {
    return { breakdown: fromJson, source: 'fee_breakdown_json' };
  }

  const recomputed = await recomputeBookingCustomerPaidFeeBreakdown(ctx);
  return {
    breakdown: dropInventedFeesWhenChargedIsTaxablePlusGst(ctx, fromColumns, recomputed),
    source: 'recomputed',
  };
}

type BookingAccrualRow = {
  vendor_id: string;
  booking_id: string;
  base_price?: unknown;
  total_amount?: unknown;
  discount_amount?: unknown;
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
  payment_id?: unknown;
  parent_booking_id?: unknown;
  gst_identity?: unknown;
  gst_attribute_booking_id?: unknown;
  is_inter_state?: unknown;
};

/** Payment row for the booking, or the package parent when this row is a session child. */
export const SQL_ACCRUAL_PARENT_AWARE_PAYMENT_LATERAL = `
     LEFT JOIN bookings parent_b ON parent_b.id = b.parent_booking_id
     LEFT JOIN LATERAL (
       SELECT p.id, p.platform_fee, p.convenience_fee, p.delivery_fee,
              p.cgst_amount, p.sgst_amount, p.igst_amount, p.gst_amount,
              p.total_amount, p.amount, p.fee_breakdown, p.payment_status
       FROM payments p
       WHERE p.booking_id = COALESCE(
               CASE WHEN COALESCE(b.is_package_session, false) THEN parent_b.id END,
               b.id
             )
         AND ${PAYMENT_OK}
       ORDER BY CASE WHEN ${PAYMENT_PREFERRED} THEN 0 ELSE 1 END,
                COALESCE(p.completed_at, p.created_at) DESC NULLS LAST
       LIMIT 1
     ) p ON true
`.trim();

export function shouldAttributeCustomerPaidBreakdown(
  bookingId: string,
  gstAttributeBookingId?: string | null,
): boolean {
  if (!gstAttributeBookingId) return true;
  return String(bookingId) === String(gstAttributeBookingId);
}

function rowToResolveContext(row: BookingAccrualRow): BookingAccrualResolveContext {
  const bookingId = String(row.booking_id);
  const parentBookingId = row.parent_booking_id != null ? String(row.parent_booking_id) : undefined;
  return {
    bookingId,
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
    parentBookingId,
    isInterState: row.is_inter_state === true || row.is_inter_state === 't' || row.is_inter_state === 'true',
    gstIdentity:
      String(row.gst_identity || '') ||
      gstFinancialIdentity({
        paymentId: row.payment_id,
        parentBookingId,
        bookingId,
      }),
    gstAttributeBookingId: row.gst_attribute_booking_id != null ? String(row.gst_attribute_booking_id) : undefined,
    payment: {
      id: row.payment_id,
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

export async function foldBookingFeeBreakdownsByVendor(
  rows: BookingAccrualRow[],
): Promise<Map<string, VendorAccrualFeeBreakdown>> {
  const out = new Map<string, VendorAccrualFeeBreakdown>();
  const breakdownByBooking = new Map<string, VendorAccrualFeeBreakdown>();
  const attributedIdentity = new Set<string>();

  for (const row of rows) {
    const bookingId = String(row.booking_id || '');
    if (!bookingId) continue;

    const ctx = rowToResolveContext(row);
    const identity = ctx.gstIdentity || gstFinancialIdentity({
      paymentId: row.payment_id,
      parentBookingId: row.parent_booking_id,
      bookingId,
    });
    const attributeHere = shouldAttributeCustomerPaidBreakdown(bookingId, ctx.gstAttributeBookingId);

    let piece: VendorAccrualFeeBreakdown;
    if (!attributeHere || attributedIdentity.has(identity)) {
      piece = { ...EMPTY_BREAKDOWN };
    } else if (breakdownByBooking.has(bookingId)) {
      piece = breakdownByBooking.get(bookingId)!;
      attributedIdentity.add(identity);
    } else {
      piece = await resolveBookingCustomerPaidFeeBreakdown(ctx);
      breakdownByBooking.set(bookingId, piece);
      attributedIdentity.add(identity);
    }

    const vendorId = String(row.vendor_id || '');
    if (!vendorId) continue;
    out.set(vendorId, out.has(vendorId) ? addBreakdown(out.get(vendorId)!, piece) : piece);
  }

  return out;
}

async function aggregateBookingFeeBreakdownsForIstRange(
  periodStartYmd: string,
  periodEndExclusiveYmd: string,
): Promise<Map<string, VendorAccrualFeeBreakdown>> {
  const bookingRes = await query(
    `WITH bounds AS (
       SELECT
         (to_timestamp($1::text || ' 00:00:00', 'YYYY-MM-DD HH24:MI:SS') AT TIME ZONE 'Asia/Kolkata') AS start_ts,
         (to_timestamp($2::text || ' 00:00:00', 'YYYY-MM-DD HH24:MI:SS') AT TIME ZONE 'Asia/Kolkata') AS end_ts
     ),
     in_window AS (
       SELECT ve.vendor_id::text AS vendor_id,
              ve.booking_id::text AS booking_id,
              ve.realized_at,
              CASE
                WHEN COALESCE(b.is_package_session, false) THEN COALESCE(parent_b.base_price, b.base_price)
                ELSE b.base_price
              END AS base_price,
              CASE
                WHEN COALESCE(b.is_package_session, false) THEN COALESCE(parent_b.total_amount, b.total_amount)
                ELSE b.total_amount
              END AS total_amount,
              CASE
                WHEN COALESCE(b.is_package_session, false) THEN COALESCE(parent_b.discount_amount, b.discount_amount)
                ELSE b.discount_amount
              END AS discount_amount,
              ve.total_amount AS earning_total_amount,
              CASE
                WHEN COALESCE(b.is_package_session, false) THEN COALESCE(parent_b.tax_amount, b.tax_amount)
                ELSE b.tax_amount
              END AS tax_amount,
              b.service_id::text AS service_id,
              b.service_style,
              b.service_type,
              sc.category_name,
              sc.category_id::text AS category_id,
              vs.category AS vs_category,
              v.role_id::text AS vendor_role_id,
              sc.tax_category_id::text AS tax_category_id,
              sc.hsn_code_id::text AS hsn_code_id,
              CASE
                WHEN COALESCE(b.is_package_session, false) THEN COALESCE(parent_b.notes, b.notes)
                ELSE b.notes
              END AS booking_notes,
              p.id::text AS payment_id,
              b.parent_booking_id::text AS parent_booking_id,
              p.platform_fee,
              p.convenience_fee,
              p.delivery_fee,
              p.cgst_amount,
              p.sgst_amount,
              p.igst_amount,
              p.gst_amount,
              p.total_amount AS payment_total_amount,
              p.amount AS payment_amount,
              p.fee_breakdown,
              COALESCE(p.id::text, b.parent_booking_id::text, ve.booking_id::text) AS gst_identity
       FROM vendor_earnings ve
       CROSS JOIN bounds bnd
       INNER JOIN bookings b ON b.id = ve.booking_id
       LEFT JOIN vendors v ON v.id = ve.vendor_id
       LEFT JOIN vendor_services vs ON vs.id = b.service_id
       LEFT JOIN service_catalog sc ON sc.id = vs.service_id
       ${SQL_ACCRUAL_PARENT_AWARE_PAYMENT_LATERAL}
       WHERE ve.realized_at >= bnd.start_ts
         AND ve.realized_at < bnd.end_ts
         AND (ve.status IS DISTINCT FROM 'cancelled')
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
     SELECT iw.*, fa.gst_attribute_booking_id
     FROM in_window iw
     LEFT JOIN first_attr fa ON fa.gst_identity = iw.gst_identity`,
    [periodStartYmd, periodEndExclusiveYmd],
  ).catch(() => ({ rows: [] }));

  return foldBookingFeeBreakdownsByVendor((bookingRes.rows || []) as BookingAccrualRow[]);
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
