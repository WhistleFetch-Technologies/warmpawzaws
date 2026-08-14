import { parseJsonMetaFromNotes } from './booking-notes-meta';
import { inferExclusiveGstFromChargedDelta, splitGstAmount } from './gst-split';

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
  } | null;
  payment?: BookingInvoicePaymentTax | null;
  isInterState: boolean;
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
 * GST for booking invoices.
 * Bookings often store a tax-exclusive `total_amount` / `tax_amount=0` while the
 * completed payment row holds `gst_amount` and the all-in `total_amount` (ed864719).
 */
export function resolveBookingInvoiceAmounts(input: BookingInvoiceAmountInput): BookingInvoiceAmounts {
  const taxableValue = Math.max(0, num(input.basePrice));
  const discount = num(input.discountAmount);
  const meta = input.financialMeta;
  const pay = input.payment;

  const metaSplit = num(meta?.cgst) + num(meta?.sgst) + num(meta?.igst);
  const metaTax = num(meta?.totalTax) || metaSplit;
  const paySplit = num(pay?.cgstAmount) + num(pay?.sgstAmount) + num(pay?.igstAmount);
  const payTax = num(pay?.gstAmount) || paySplit;

  let taxAmount = num(input.bookingTaxAmount);
  if (taxAmount <= 0.009) taxAmount = metaTax;
  if (taxAmount <= 0.009) taxAmount = payTax;

  let cgst = num(meta?.cgst) || num(pay?.cgstAmount);
  let sgst = num(meta?.sgst) || num(pay?.sgstAmount);
  let igst = num(meta?.igst) || num(pay?.igstAmount);

  if (taxAmount <= 0.009) {
    const taxableAfterDiscount = Math.max(0, num(taxableValue - discount));
    const charged = num(pay?.totalAmount) || num(pay?.amount) || num(input.bookingTotalAmount);
    const inferred = inferExclusiveGstFromChargedDelta({
      taxableValue: taxableAfterDiscount,
      chargedTotal: charged,
      catalogGstRate: input.catalogGstRate,
      isInterState: input.isInterState,
    });
    if (inferred.gstTotal > 0.009) {
      taxAmount = inferred.gstTotal;
      cgst = inferred.cgstAmount;
      sgst = inferred.sgstAmount;
      igst = inferred.igstAmount;
    }
  }

  if (taxAmount > 0.009 && cgst + sgst + igst <= 0.009) {
    const split = splitGstAmount(taxAmount, input.isInterState);
    cgst = split.cgst;
    sgst = split.sgst;
    igst = split.igst;
  }

  const gstRate =
    taxAmount > 0.009 && taxableValue > 0.009
      ? Math.round((taxAmount / taxableValue) * 10000) / 100
      : num(input.catalogGstRate);

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

export function paymentTaxFromBookingRow(booking: Record<string, unknown>): BookingInvoicePaymentTax | null {
  const gstAmount = num(booking.payment_gst_amount ?? booking.paymentGstAmount);
  const totalAmount = num(booking.payment_total_amount ?? booking.paymentTotalAmount);
  const amount = num(booking.payment_amount ?? booking.paymentAmount);
  const cgstAmount = num(booking.payment_cgst_amount ?? booking.paymentCgstAmount);
  const sgstAmount = num(booking.payment_sgst_amount ?? booking.paymentSgstAmount);
  const igstAmount = num(booking.payment_igst_amount ?? booking.paymentIgstAmount);
  if (gstAmount <= 0 && totalAmount <= 0 && amount <= 0 && cgstAmount + sgstAmount + igstAmount <= 0) {
    return null;
  }
  return { amount, totalAmount, gstAmount, cgstAmount, sgstAmount, igstAmount };
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
  };
}
