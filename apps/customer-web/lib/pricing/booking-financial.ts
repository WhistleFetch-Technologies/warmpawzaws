import type { PriceBreakdownLine } from './types';
import { roundMoney } from './format';
import {
  buildCheckoutPriceLines,
  type CheckoutPlatformFees,
  type CheckoutTaxBreakdown,
} from './checkout-price-breakdown';

export type BookingFinancialSnapshot = {
  servicePrice: number;
  vendorDiscount: number;
  platformDiscount: number;
  couponDiscount: number;
  totalSavings: number;
  subtotalAfterDiscounts: number;
  platformFee: number;
  convenienceFee: number;
  deliveryFee: number;
  totalTax: number;
  finalPaid: number;
  /** True when the booking (or its payment row) shows the amount was actually collected. */
  isPaid: boolean;
  walletAmount: number;
  promotionNames: string[];
  couponCode?: string;
  lines: PriceBreakdownLine[];
};

function parseJsonMetaFromNotes(prefix: string, notes: unknown): Record<string, unknown> | null {
  if (!notes || typeof notes !== 'string') return null;
  const marker = `${prefix}:`;
  const idx = notes.indexOf(marker);
  if (idx < 0) return null;
  const slice = notes.slice(idx + marker.length);
  const brace = slice.indexOf('{');
  if (brace < 0) return null;
  let depth = 0;
  for (let i = brace; i < slice.length; i++) {
    if (slice[i] === '{') depth++;
    else if (slice[i] === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(slice.slice(brace, i + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function parsePromoMetaFromNotes(notes: unknown): {
  vendorDiscount?: number;
  platformDiscount?: number;
  vendorPromotionId?: string;
  platformPromotionId?: string;
} {
  if (!notes || typeof notes !== 'string') return {};
  const meta = parseJsonMetaFromNotes('wp_promo_meta', notes);
  if (!meta) return {};
  try {
    return {
      vendorDiscount: Number(meta.vendorDiscount) || 0,
      platformDiscount: Number(meta.platformDiscount) || 0,
      vendorPromotionId: meta.vendorPromotionId ? String(meta.vendorPromotionId) : undefined,
      platformPromotionId: meta.platformPromotionId ? String(meta.platformPromotionId) : undefined,
    };
  } catch {
    return {};
  }
}

function parseFinancialMetaFromNotes(notes: unknown): Record<string, unknown> | null {
  return parseJsonMetaFromNotes('wp_financial_meta', notes);
}

function num(raw: unknown): number {
  if (raw == null || raw === '') return 0;
  const n = parseFloat(String(raw));
  return Number.isFinite(n) ? roundMoney(n) : 0;
}

function parseFeeBreakdown(raw: Record<string, unknown>): CheckoutPlatformFees & {
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
} {
  const nested =
    (raw.customerFeeBreakdown as Record<string, unknown> | undefined) ??
    (raw.fee_breakdown as Record<string, unknown> | undefined) ??
    (raw.feeBreakdown as Record<string, unknown> | undefined);

  const fromNested = (key: string, alt: string) =>
    nested ? num(nested[key] ?? nested[alt]) : 0;

  const platformFee = num(raw.platform_fee ?? raw.platformFee) || fromNested('platformFee', 'platform_fee');
  const convenienceFee =
    num(raw.convenience_fee ?? raw.convenienceFee) || fromNested('convenienceFee', 'convenience_fee');
  const deliveryFee =
    num(raw.delivery_fee ?? raw.deliveryFee) || fromNested('deliveryFee', 'delivery_fee');
  const packagingFee =
    num(raw.packaging_fee ?? raw.packagingFee) || fromNested('packagingFee', 'packaging_fee');

  let cgst = num(raw.cgst_amount ?? raw.cgstAmount) || fromNested('cgstAmount', 'cgst_amount');
  let sgst = num(raw.sgst_amount ?? raw.sgstAmount) || fromNested('sgstAmount', 'sgst_amount');
  let igst = num(raw.igst_amount ?? raw.igstAmount) || fromNested('igstAmount', 'igst_amount');
  const taxAmount = num(raw.tax_amount ?? raw.taxAmount);
  const gstAmount = num(raw.gst_amount ?? raw.gstAmount) || fromNested('gstTotal', 'gst_total');

  let totalTax = cgst + sgst + igst;
  if (totalTax <= 0 && gstAmount > 0) totalTax = gstAmount;
  if (totalTax <= 0 && taxAmount > 0) totalTax = taxAmount;

  if (totalTax > 0 && cgst <= 0 && sgst <= 0 && igst <= 0) {
    cgst = roundMoney(totalTax / 2);
    sgst = roundMoney(totalTax - cgst);
  }

  return {
    platformFee,
    convenienceFee,
    deliveryFee,
    packagingFee,
    cgst,
    sgst,
    igst,
    totalTax: roundMoney(totalTax),
  };
}

function buildTaxBreakdown(fees: ReturnType<typeof parseFeeBreakdown>): CheckoutTaxBreakdown {
  const isInterState = fees.igst > 0 && fees.cgst <= 0 && fees.sgst <= 0;
  const taxRate = isInterState ? 18 : 18;

  return {
    subtotal: 0,
    cgst: fees.cgst,
    sgst: fees.sgst,
    igst: fees.igst,
    totalTax: fees.totalTax,
    taxRate,
    isInterState,
  };
}

/** Build financial snapshot from existing booking API fields — no duplicate pricing logic. */
export function extractBookingFinancial(raw: Record<string, unknown>): BookingFinancialSnapshot {
  const finMeta = parseFinancialMetaFromNotes(raw.notes);
  const paidFromPayment = num(raw.paid_amount ?? raw.paidAmount);

  // Payment-row fields exposed by GET /customer/bookings/:bookingId (best payment row).
  const paymentRowAmount = num(
    raw.payment_amount ??
      raw.paymentAmount ??
      raw.payment_row_amount ??
      raw.paymentRowAmount ??
      raw.payable
  );
  const paymentRowStatus = String(
    raw.payment_row_status ?? raw.paymentRowStatus ?? raw.payment_row_payment_status ?? ''
  )
    .trim()
    .toLowerCase();
  const bookingPaymentStatus = String(raw.payment_status ?? raw.paymentStatus ?? '')
    .trim()
    .toLowerCase();
  const isPaid =
    bookingPaymentStatus === 'paid' ||
    bookingPaymentStatus === 'completed' ||
    paymentRowStatus === 'completed';

  const basePrice = num(raw.base_price ?? raw.basePrice);
  const rowTotal = num(raw.total_amount ?? raw.totalAmount ?? raw.amount ?? raw.price);
  // Without a booking-level snapshot, the payment row carries the enforced payable
  // (base + GST + fees) which can exceed the stale booking total.
  const fallbackPaid = paidFromPayment > 0 ? paidFromPayment : rowTotal;
  const finalPaid =
    finMeta && finMeta.finalPaid != null
      ? num(finMeta.finalPaid)
      : paymentRowAmount > fallbackPaid
        ? paymentRowAmount
        : fallbackPaid;
  const discountFromRow = num(raw.discount_amount ?? raw.discountAmount);
  const couponCode = raw.coupon_code ?? raw.couponCode;
  const couponCodeStr = couponCode ? String(couponCode).trim() : undefined;

  const meta = parsePromoMetaFromNotes(raw.notes);
  let vendorDiscount = roundMoney(
    finMeta ? num(finMeta.vendorDiscount) : num(meta.vendorDiscount ?? 0)
  );
  let platformDiscount = roundMoney(
    finMeta ? num(finMeta.platformDiscount) : num(meta.platformDiscount ?? 0)
  );
  let couponDiscount = roundMoney(finMeta ? num(finMeta.couponDiscount) : 0);

  if (vendorDiscount <= 0 && platformDiscount <= 0 && discountFromRow > 0) {
    if (couponCodeStr) {
      couponDiscount = discountFromRow;
    } else {
      vendorDiscount = discountFromRow;
    }
  }

  const selected = Array.isArray(raw.selectedServices)
    ? raw.selectedServices
    : Array.isArray(raw.selected_services)
      ? raw.selected_services
      : [];
  const servicesSum = selected.reduce((sum: number, s: Record<string, unknown>) => {
    const price = parseFloat(String(s.price ?? 0)) || 0;
    const qty = parseInt(String(s.quantity ?? 1), 10) || 1;
    return sum + price * qty;
  }, 0);

  const servicePrice =
    finMeta && finMeta.servicePrice != null
      ? num(finMeta.servicePrice)
      : basePrice > 0
        ? basePrice
        : servicesSum > 0
          ? roundMoney(servicesSum)
          : roundMoney(finalPaid + discountFromRow);

  const totalSavings = roundMoney(vendorDiscount + platformDiscount + couponDiscount);
  const walletAmount = finMeta
    ? num(finMeta.walletAmount ?? finMeta.wallet_amount)
    : num(raw.wallet_amount_used ?? raw.walletAmountUsed ?? raw.wallet_amount ?? raw.walletAmount);
  // Gap between list price and cash payable is often wallet — not a promo.
  const computedSavings =
    totalSavings > 0 ? totalSavings : Math.max(0, roundMoney(servicePrice - finalPaid));

  let effectiveVendorDiscount = vendorDiscount;
  let effectivePlatformDiscount = platformDiscount;
  let effectiveCouponDiscount = couponDiscount;
  let vendorDiscountLabel = 'Discount';

  if (
    effectiveVendorDiscount + effectivePlatformDiscount + effectiveCouponDiscount <= 0 &&
    computedSavings > 0 &&
    walletAmount <= 0.009
  ) {
    effectiveVendorDiscount = computedSavings;
    vendorDiscountLabel = 'Discount';
  }

  const promoTotal =
    effectiveVendorDiscount + effectivePlatformDiscount + effectiveCouponDiscount;
  const subtotalAfterDiscounts =
    finMeta && finMeta.subtotalAfterDiscounts != null
      ? num(finMeta.subtotalAfterDiscounts)
      : Math.max(0, roundMoney(servicePrice - promoTotal));

  const feeFields = finMeta
    ? {
        platformFee: num(finMeta.platformFee),
        convenienceFee: num(finMeta.convenienceFee),
        deliveryFee: num(finMeta.deliveryFee),
        packagingFee: 0,
        cgst: num(finMeta.cgst),
        sgst: num(finMeta.sgst),
        igst: num(finMeta.igst),
        totalTax: num(finMeta.totalTax),
      }
    : parseFeeBreakdown(raw);
  const taxBreakdown = buildTaxBreakdown(feeFields);
  taxBreakdown.subtotal = subtotalAfterDiscounts;

  const platformFees: CheckoutPlatformFees = {
    platformFee: feeFields.platformFee,
    convenienceFee: feeFields.convenienceFee,
    deliveryFee: feeFields.deliveryFee,
    packagingFee: feeFields.packagingFee,
  };

  const resolvedFinal =
    finalPaid > 0
      ? finalPaid
      : Math.max(
          0,
          roundMoney(
            subtotalAfterDiscounts +
              feeFields.totalTax +
              feeFields.platformFee +
              feeFields.convenienceFee +
              feeFields.deliveryFee +
              feeFields.packagingFee
          )
        );

  const promotionNames: string[] = [];

  // Payment-row fallback (no booking snapshot): fee columns may be zero even though
  // the enforced payable includes fees. Surface the unexplained remainder as one
  // combined fee line so the breakdown sums to the payable.
  const explicitFees = roundMoney(
    feeFields.platformFee + feeFields.convenienceFee + feeFields.deliveryFee + feeFields.packagingFee
  );
  let residualFee = 0;
  if (!finMeta && explicitFees <= 0 && finalPaid > 0) {
    const residual = roundMoney(
      finalPaid - subtotalAfterDiscounts - feeFields.totalTax - walletAmount
    );
    if (residual >= 1) residualFee = residual;
  }

  const lines = buildCheckoutPriceLines({
    subtotalLabel: 'Service price',
    subtotal: servicePrice,
    vendorDiscount: effectiveVendorDiscount,
    vendorDiscountLabel,
    platformDiscount: effectivePlatformDiscount,
    couponDiscount: effectiveCouponDiscount,
    couponCode: couponCodeStr,
    taxBreakdown,
    platformFees,
    includeDeliveryFee: feeFields.deliveryFee > 0,
    walletAmount,
    subtotalAfterDiscounts,
    finalAmount: resolvedFinal,
    collapseAutoPromotions: true,
  }).map((line) => {
    if (line.kind === 'final') {
      return { ...line, label: isPaid ? 'Total paid' : 'Total payable' };
    }
    if (line.kind === 'wallet') {
      return { ...line, label: 'Paid from wallet' };
    }
    return line;
  });

  if (residualFee > 0) {
    const residualLine: PriceBreakdownLine = {
      kind: 'platform_fee',
      label: 'Platform & other fees',
      amount: residualFee,
      emphasis: 'muted',
    };
    const insertAt = lines.findIndex((l) => l.kind === 'wallet' || l.kind === 'final');
    if (insertAt >= 0) lines.splice(insertAt, 0, residualLine);
    else lines.push(residualLine);
  }

  return {
    servicePrice,
    vendorDiscount: effectiveVendorDiscount,
    platformDiscount: effectivePlatformDiscount,
    couponDiscount: effectiveCouponDiscount,
    totalSavings: promoTotal,
    subtotalAfterDiscounts,
    platformFee: feeFields.platformFee,
    convenienceFee: feeFields.convenienceFee,
    deliveryFee: feeFields.deliveryFee,
    totalTax: feeFields.totalTax,
    finalPaid: resolvedFinal,
    isPaid,
    walletAmount,
    promotionNames,
    couponCode: couponCodeStr,
    lines,
  };
}

export type BookingListAmountInput = {
  notes?: unknown;
  specialInstructions?: unknown;
  total_amount?: unknown;
  totalAmount?: unknown;
  paidAmount?: unknown;
  price?: unknown;
  paymentSources?: Array<{ method?: string; amount?: number }>;
};

/**
 * All-in amount for bookings list cards: service after discounts + GST + fees
 * (wallet + Razorpay combined). Prefer write-once wp_financial_meta; never show
 * post-discount service-only as if it were the payable.
 */
export function resolveBookingListAllInAmount(raw: BookingListAmountInput): number {
  const notes = raw.notes ?? raw.specialInstructions;
  const finMeta = parseFinancialMetaFromNotes(notes);
  if (finMeta) {
    const subtotal = num(finMeta.subtotalAfterDiscounts ?? finMeta.subtotal_after_discounts);
    const totalTax = num(finMeta.totalTax ?? finMeta.total_tax);
    const platformFee = num(finMeta.platformFee ?? finMeta.platform_fee);
    const convenienceFee = num(finMeta.convenienceFee ?? finMeta.convenience_fee);
    const deliveryFee = num(finMeta.deliveryFee ?? finMeta.delivery_fee);
    const fromComponents = roundMoney(
      subtotal + totalTax + platformFee + convenienceFee + deliveryFee
    );
    if (fromComponents > 0.009) return fromComponents;

    const finalPaid = num(finMeta.finalPaid ?? finMeta.final_paid);
    const walletAmount = num(finMeta.walletAmount ?? finMeta.wallet_amount);
    // Legacy cash-as-finalPaid snapshots store gross as finalPaid + wallet.
    if (walletAmount > 0.009 && finalPaid >= 0) {
      return roundMoney(finalPaid + walletAmount);
    }
    if (finalPaid > 0.009) return finalPaid;
  }

  const sources = Array.isArray(raw.paymentSources) ? raw.paymentSources : [];
  const sourcesSum = roundMoney(
    sources.reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
  );
  if (sourcesSum > 0.009) return sourcesSum;

  const cash = num(raw.paidAmount ?? raw.total_amount ?? raw.totalAmount ?? raw.price);
  const walletPaid = roundMoney(
    sources
      .filter((s) => String(s.method || '').toLowerCase() === 'wallet')
      .reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
  );
  // Full wallet: list total_amount may be 0 cash remainder.
  if (walletPaid > 0.009 && cash <= 0.009) return walletPaid;
  return cash;
}
