import { parseJsonMetaFromNotes } from './booking-notes-meta';
import { parseStoredInterstate, reconstructGstSplit } from './gst-split';

function num(raw: unknown): number {
  const n = parseFloat(String(raw ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export type BookingInvoicePaymentTax = {
  amount?: unknown;
  totalAmount?: unknown;
  gstAmount?: unknown;
  cgstAmount?: unknown;
  sgstAmount?: unknown;
  igstAmount?: unknown;
  isInterState?: unknown;
};

export type BookingInvoiceAmountInput = {
  basePrice: number;
  bookingTaxAmount: number;
  bookingTotalAmount: number;
  discountAmount?: number;
  financialMeta?: {
    cgst?: unknown;
    sgst?: unknown;
    igst?: unknown;
    totalTax?: unknown;
    finalPaid?: unknown;
    taxableAmount?: unknown;
    isInterState?: unknown;
  } | null;
  payment?: BookingInvoicePaymentTax | null;
  isInterState?: boolean | null;
  /**
   * Ignored for historical invoices. Current Admin/catalogue GST must never
   * rewrite a stored GST amount or rate (including explicit 0).
   */
  catalogGstRate?: number;
};

export type BookingInvoiceAmounts = {
  taxableValue: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  gstRate: number;
  total: number;
};

/**
 * Historical invoice GST — stored snapshot only.
 *
 * Priority for a positive stored GST total:
 *   1. Stored payment GST split / gst_amount
 *   2. wp_financial_meta GST values
 *   3. bookings.tax_amount
 *   4. Reconstruct CGST/SGST/IGST only when a stored total exists and
 *      stored jurisdiction is a known boolean
 *
 * When every stored GST total is 0 or absent, the invoice stays 0%.
 * That explicit 0 is not "missing" and is never replaced by catalogGstRate.
 *
 * Never uses current vendor price, current Admin GST card, or catalogGstRate
 * to invent or replace historical GST.
 */
export function resolveBookingInvoiceAmounts(input: BookingInvoiceAmountInput): BookingInvoiceAmounts {
  const discount = num(input.discountAmount);
  const meta = input.financialMeta;
  const pay = input.payment;
  const metaTaxable = num((meta as { taxableAmount?: unknown } | null | undefined)?.taxableAmount);
  const taxableValue =
    metaTaxable > 0.009 ? metaTaxable : Math.max(0, num(input.basePrice) - discount);

  const metaSplit = num(meta?.cgst) + num(meta?.sgst) + num(meta?.igst);
  const metaTax = num(meta?.totalTax) || metaSplit;
  const paySplit = num(pay?.cgstAmount) + num(pay?.sgstAmount) + num(pay?.igstAmount);
  const payTax = num(pay?.gstAmount) || paySplit;

  // Positive stored totals only — explicit 0 is exact 0%, never inferred.
  // Priority matches Admin reports: payment → wp_financial_meta → bookings.tax_amount.
  let taxAmount = payTax;
  if (taxAmount <= 0.009) taxAmount = metaTax;
  if (taxAmount <= 0.009) taxAmount = num(input.bookingTaxAmount);

  let cgst = num(pay?.cgstAmount) || num(meta?.cgst);
  let sgst = num(pay?.sgstAmount) || num(meta?.sgst);
  let igst = num(pay?.igstAmount) || num(meta?.igst);

  const storedJurisdiction = resolveStoredInvoiceInterstate({
    isInterState: input.isInterState,
    financialMeta: meta,
    payment: pay,
    cgst,
    sgst,
    igst,
  });

  if (taxAmount > 0.009 && cgst + sgst + igst <= 0.009) {
    const split = reconstructGstSplit({
      gstTotal: taxAmount,
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: igst,
      isInterState: storedJurisdiction,
    });
    cgst = split.cgstAmount;
    sgst = split.sgstAmount;
    igst = split.igstAmount;
  }

  const gstRate =
    taxAmount > 0.009 && taxableValue > 0.009
      ? Math.round((taxAmount / taxableValue) * 10000) / 100
      : 0;

  const reconstructed = Math.max(0, Math.round((taxableValue + taxAmount - discount) * 100) / 100);
  const payTotal = num(pay?.totalAmount);
  const bookingTotal = num(input.bookingTotalAmount);
  const metaPaid = num(meta?.finalPaid);

  let total = reconstructed;
  if (payTotal > 0.009 && Math.abs(payTotal - reconstructed) <= 0.05) {
    total = payTotal;
  } else if (metaPaid > 0.009 && Math.abs(metaPaid - reconstructed) <= 0.05) {
    total = metaPaid;
  } else if (taxAmount <= 0.009 && bookingTotal > 0.009) {
    total = bookingTotal;
  }

  return { taxableValue, taxAmount, cgst, sgst, igst, gstRate, total };
}

/**
 * Stored interstate flag only. Live customer/vendor state is not a GST source.
 * Split components can imply jurisdiction when they already exist.
 */
export function resolveStoredInvoiceInterstate(input: {
  isInterState?: boolean | null;
  financialMeta?: { isInterState?: unknown } | null;
  payment?: BookingInvoicePaymentTax | null;
  cgst?: number;
  sgst?: number;
  igst?: number;
}): boolean | undefined {
  if (typeof input.isInterState === 'boolean') return input.isInterState;
  const fromMeta = parseStoredInterstate(input.financialMeta?.isInterState);
  if (fromMeta !== undefined) return fromMeta;
  const fromPay = parseStoredInterstate(input.payment?.isInterState);
  if (fromPay !== undefined) return fromPay;
  const cgst = num(input.cgst);
  const sgst = num(input.sgst);
  const igst = num(input.igst);
  if (igst > 0.009 && cgst + sgst <= 0.009) return true;
  if (cgst + sgst > 0.009 && igst <= 0.009) return false;
  return undefined;
}

export function paymentTaxFromBookingRow(booking: Record<string, unknown>): BookingInvoicePaymentTax | null {
  const gstAmount = num(booking.payment_gst_amount ?? booking.paymentGstAmount);
  const totalAmount = num(booking.payment_total_amount ?? booking.paymentTotalAmount);
  const amount = num(booking.payment_amount ?? booking.paymentAmount);
  const cgstAmount = num(booking.payment_cgst_amount ?? booking.paymentCgstAmount);
  const sgstAmount = num(booking.payment_sgst_amount ?? booking.paymentSgstAmount);
  const igstAmount = num(booking.payment_igst_amount ?? booking.paymentIgstAmount);
  const isInterState = booking.payment_is_inter_state ?? booking.paymentIsInterState;
  if (gstAmount <= 0 && totalAmount <= 0 && amount <= 0 && cgstAmount + sgstAmount + igstAmount <= 0) {
    return null;
  }
  return { amount, totalAmount, gstAmount, cgstAmount, sgstAmount, igstAmount, isInterState };
}

export function financialMetaFromBookingNotes(notes: unknown): BookingInvoiceAmountInput['financialMeta'] {
  const meta = parseJsonMetaFromNotes(notes, 'wp_financial_meta');
  if (!meta) return null;
  return {
    cgst: meta.cgst,
    sgst: meta.sgst,
    igst: meta.igst,
    totalTax: meta.totalTax ?? meta.total_tax,
    finalPaid: meta.finalPaid ?? meta.final_paid,
    taxableAmount: meta.taxableAmount ?? meta.taxable_amount,
    isInterState: meta.isInterState ?? meta.is_inter_state,
  };
}
