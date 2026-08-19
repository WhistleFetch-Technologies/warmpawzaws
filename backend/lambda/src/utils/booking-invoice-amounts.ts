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
  platformFee?: unknown;
  convenienceFee?: unknown;
  deliveryFee?: unknown;
  walletAmount?: unknown;
};

export type BookingInvoiceFinancialMeta = {
  cgst?: unknown;
  sgst?: unknown;
  igst?: unknown;
  totalTax?: unknown;
  finalPaid?: unknown;
  taxableAmount?: unknown;
  isInterState?: unknown;
  platformFee?: unknown;
  convenienceFee?: unknown;
  deliveryFee?: unknown;
  walletAmount?: unknown;
};

export type BookingInvoiceAmountInput = {
  basePrice: number;
  bookingTaxAmount: number;
  bookingTotalAmount: number;
  discountAmount?: number;
  financialMeta?: BookingInvoiceFinancialMeta | null;
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
  platformFee: number;
  convenienceFee: number;
  deliveryFee: number;
  explainedTotal: number;
  customerPaid: number;
  unexplainedVariance: number;
  reconciliationNote?: string;
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
 * The invoice total is the captured customer-paid amount. Stored GST/fees
 * explain that total when they can. An unexplained remainder is reported,
 * never reclassified as GST from today's catalogue rate.
 *
 * Never uses current vendor price, current Admin GST card, or catalogGstRate
 * to invent or replace historical GST.
 */
export function resolveBookingInvoiceAmounts(input: BookingInvoiceAmountInput): BookingInvoiceAmounts {
  const discount = num(input.discountAmount);
  const meta = input.financialMeta;
  const pay = input.payment;
  const metaTaxable = num(meta?.taxableAmount);
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

  const platformFee = num(pay?.platformFee) || num(meta?.platformFee);
  const convenienceFee = num(pay?.convenienceFee) || num(meta?.convenienceFee);
  const deliveryFee = num(pay?.deliveryFee) || num(meta?.deliveryFee);
  const explainedTotal = Math.max(
    0,
    Math.round((taxableValue + taxAmount + platformFee + convenienceFee + deliveryFee) * 100) / 100,
  );
  const customerPaid = resolveHistoricalCustomerPaid(input, explainedTotal);
  const rawVariance = customerPaid > 0.009 ? Math.round((customerPaid - explainedTotal) * 100) / 100 : 0;
  const unexplainedVariance = Math.abs(rawVariance) <= 0.05 ? 0 : rawVariance;
  const total = customerPaid > 0.009 ? customerPaid : explainedTotal;
  const reconciliationNote =
    unexplainedVariance !== 0
      ? `Captured payment of ₹${total.toFixed(2)} differs from classified historical components ` +
        `(taxable ₹${taxableValue.toFixed(2)} + GST ₹${taxAmount.toFixed(2)} + fees ₹${(platformFee + convenienceFee + deliveryFee).toFixed(2)}) ` +
        `by ₹${unexplainedVariance.toFixed(2)}. The difference is not treated as GST.`
      : undefined;

  return {
    taxableValue,
    taxAmount,
    cgst,
    sgst,
    igst,
    gstRate,
    platformFee,
    convenienceFee,
    deliveryFee,
    explainedTotal,
    customerPaid,
    unexplainedVariance,
    reconciliationNote,
    total,
  };
}

function resolveHistoricalCustomerPaid(
  input: BookingInvoiceAmountInput,
  explainedTotal: number,
): number {
  const pay = input.payment;
  const meta = input.financialMeta;
  const payTotal = num(pay?.totalAmount);
  if (payTotal > 0.009) return payTotal;
  const payAmount = num(pay?.amount);
  if (payAmount > 0.009) return payAmount;
  const metaPaid = num(meta?.finalPaid);
  const wallet = num(pay?.walletAmount) || num(meta?.walletAmount);
  if (metaPaid > 0.009 && wallet > 0.009) {
    const cashPlusWallet = Math.round((metaPaid + wallet) * 100) / 100;
    if (Math.abs(metaPaid - explainedTotal) <= 0.05) return metaPaid;
    if (Math.abs(cashPlusWallet - explainedTotal) <= 0.05) return cashPlusWallet;
    if (metaPaid + 0.01 < explainedTotal) return cashPlusWallet;
    return metaPaid;
  }
  if (metaPaid > 0.009) return metaPaid;
  return num(input.bookingTotalAmount);
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
  const platformFee = num(booking.payment_platform_fee ?? booking.paymentPlatformFee);
  const convenienceFee = num(booking.payment_convenience_fee ?? booking.paymentConvenienceFee);
  const deliveryFee = num(booking.payment_delivery_fee ?? booking.paymentDeliveryFee);
  const walletAmount = num(booking.payment_wallet_amount ?? booking.paymentWalletAmount);
  if (
    gstAmount <= 0 &&
    totalAmount <= 0 &&
    amount <= 0 &&
    cgstAmount + sgstAmount + igstAmount <= 0 &&
    platformFee + convenienceFee + deliveryFee + walletAmount <= 0
  ) {
    return null;
  }
  return {
    amount,
    totalAmount,
    gstAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    isInterState,
    platformFee,
    convenienceFee,
    deliveryFee,
    walletAmount,
  };
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
    platformFee: meta.platformFee ?? meta.platform_fee,
    convenienceFee: meta.convenienceFee ?? meta.convenience_fee,
    deliveryFee: meta.deliveryFee ?? meta.delivery_fee,
    walletAmount: meta.walletAmount ?? meta.wallet_amount,
  };
}
