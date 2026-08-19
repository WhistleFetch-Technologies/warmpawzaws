import { parseJsonMetaFromNotes } from './booking-notes-meta';

const round2 = (n: number) => Math.round(n * 100) / 100;

export function resolveBookingFinancialDiscountBuckets(params: {
  winningPromotionType?: string;
  resolvedTotalSavings?: number;
  resolvedVendorDiscount?: number;
  resolvedPlatformDiscount?: number;
  clientVendorDiscount?: unknown;
  clientPlatformDiscount?: unknown;
  clientCouponDiscount?: unknown;
}): { vendorDiscount: number; platformDiscount: number; couponDiscount: number } {
  if (params.winningPromotionType === 'coupon') {
    return {
      vendorDiscount: 0,
      platformDiscount: 0,
      couponDiscount: round2(Math.max(0, params.resolvedTotalSavings ?? 0)),
    };
  }
  const money = (client: unknown, resolved = 0) => {
    const clientAmount = parseFloat(String(client ?? 0));
    return round2(Math.max(0, clientAmount || resolved || 0));
  };
  return {
    vendorDiscount: money(params.clientVendorDiscount, params.resolvedVendorDiscount),
    platformDiscount: money(params.clientPlatformDiscount, params.resolvedPlatformDiscount),
    couponDiscount: money(params.clientCouponDiscount),
  };
}

export interface LockedBookingGross {
  grossTotal: number;
  subtotalAfterDiscounts: number;
  totalTax: number;
  cgst: number;
  sgst: number;
  igst: number;
  platformFee: number;
  convenienceFee: number;
  deliveryFee: number;
  walletAmount: number;
  finalPaid: number;
  source: 'components' | 'finalPaid_plus_wallet' | 'finalPaid_only';
  /** From wp_financial_meta.gstAuthority — 'backend' means booking-create GST is authoritative. */
  gstAuthority: string | null;
  isInterState?: boolean;
}

function num(meta: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    if (meta[key] != null && meta[key] !== '') {
      const parsed = parseFloat(String(meta[key]));
      if (Number.isFinite(parsed)) return round2(parsed);
    }
  }
  return 0;
}

/** Resolve locked all-in gross from wp_financial_meta embedded in booking notes. */
export function resolveLockedBookingGrossFromNotes(notes: unknown): LockedBookingGross | null {
  const finMeta = parseJsonMetaFromNotes(notes, 'wp_financial_meta');
  if (!finMeta) return null;

  const subtotalAfterDiscounts = num(
    finMeta,
    'subtotalAfterDiscounts',
    'subtotal_after_discounts'
  );
  const totalTax = num(finMeta, 'totalTax', 'total_tax');
  const cgst = num(finMeta, 'cgst');
  const sgst = num(finMeta, 'sgst');
  const igst = num(finMeta, 'igst');
  const platformFee = num(finMeta, 'platformFee', 'platform_fee');
  const convenienceFee = num(finMeta, 'convenienceFee', 'convenience_fee');
  const deliveryFee = num(finMeta, 'deliveryFee', 'delivery_fee');
  const walletAmount = num(finMeta, 'walletAmount', 'wallet_amount');
  const finalPaid = num(finMeta, 'finalPaid', 'final_paid');

  const gstAuthorityRaw = finMeta.gstAuthority ?? finMeta.gst_authority;
  const gstAuthority =
    gstAuthorityRaw != null && String(gstAuthorityRaw).trim() !== ''
      ? String(gstAuthorityRaw).trim().toLowerCase()
      : null;
  const interRaw = finMeta.isInterState ?? finMeta.is_inter_state;
  const isInterState =
    interRaw === true || interRaw === 't' || interRaw === 'true'
      ? true
      : interRaw === false || interRaw === 'f' || interRaw === 'false'
        ? false
        : undefined;

  const servicePrice = num(finMeta, 'servicePrice', 'service_price');
  let vendorDiscount = num(finMeta, 'vendorDiscount', 'vendor_discount');
  let platformDiscount = num(finMeta, 'platformDiscount', 'platform_discount');
  const couponDiscount = num(finMeta, 'couponDiscount', 'coupon_discount');
  // Legacy create could persist the same coupon in both platformDiscount and couponDiscount
  // (settlement attach copied funding cost into the discount bucket). Vendor-funded coupons
  // duplicated into vendorDiscount the same way.
  if (
    couponDiscount > 0 &&
    platformDiscount > 0 &&
    Math.abs(couponDiscount - platformDiscount) < 0.011
  ) {
    platformDiscount = 0;
  }
  if (
    couponDiscount > 0 &&
    vendorDiscount > 0 &&
    platformDiscount <= 0 &&
    Math.abs(couponDiscount - vendorDiscount) < 0.011
  ) {
    vendorDiscount = 0;
  }
  // Rebuild taxable subtotal from list price − discounts when servicePrice is known.
  // Do not trust a positive client subtotalAfterDiscounts that disagrees with discounts
  // (prod COLLABCODE: subtotal 1999 + coupon 1999 + finalPaid 40 → Razorpay 2039).
  const rebuiltSubtotal =
    servicePrice > 0
      ? round2(Math.max(0, servicePrice - vendorDiscount - platformDiscount - couponDiscount))
      : 0;
  const derivedSubtotal =
    servicePrice > 0
      ? rebuiltSubtotal
      : subtotalAfterDiscounts > 0
        ? subtotalAfterDiscounts
        : 0;
  const componentGross = round2(
    derivedSubtotal + totalTax + platformFee + convenienceFee + deliveryFee
  );

  const base = {
    subtotalAfterDiscounts: derivedSubtotal,
    totalTax,
    cgst,
    sgst,
    igst,
    platformFee,
    convenienceFee,
    deliveryFee,
    walletAmount,
    finalPaid,
    gstAuthority,
    ...(isInterState === true || isInterState === false ? { isInterState } : {}),
  };

  // Components must agree with finalPaid (within ₹0.02). Never treat componentGross >> finalPaid
  // as valid — that raised discounted payables to full list + fees at Razorpay create-order.
  const componentsAgreeWithFinalPaid =
    finalPaid <= 0 || Math.abs(componentGross - finalPaid) < 0.02;
  const componentsLookComplete =
    componentGross > 0 &&
    componentsAgreeWithFinalPaid &&
    (derivedSubtotal > 0 || (derivedSubtotal <= 0 && totalTax + platformFee + convenienceFee + deliveryFee > 0));

  if (componentsLookComplete) {
    return { ...base, grossTotal: componentGross, source: 'components' };
  }

  if (walletAmount > 0 && finalPaid > 0) {
    // Modern clients store all-in in finalPaid; legacy stored cash-after-wallet.
    const looksAllIn =
      finalPaid + 0.01 >= walletAmount + totalTax ||
      (derivedSubtotal > 0 && finalPaid + 0.01 >= componentGross) ||
      (totalTax > 0 && Math.abs(finalPaid - totalTax) > 0.05 && finalPaid > walletAmount);
    if (looksAllIn) {
      return { ...base, grossTotal: finalPaid, source: 'finalPaid_only' };
    }
    return {
      ...base,
      grossTotal: round2(finalPaid + walletAmount),
      source: 'finalPaid_plus_wallet',
    };
  }

  if (finalPaid > 0) {
    return { ...base, grossTotal: finalPaid, source: 'finalPaid_only' };
  }

  return null;
}

export interface WalletBookingSplitResult {
  walletApplied: number;
  cashRemainder: number;
  fullyWallet: boolean;
  /** Max wallet can cover (gross − GST). GST must be collected via Razorpay when wallet is used. */
  walletEligible: number;
}

/**
 * Compute wallet debit and Razorpay remainder against a locked gross total.
 * When gstAmount > 0, wallet may only cover gross − GST; cash remainder is always ≥ GST.
 */
export function computeWalletBookingSplit(params: {
  grossTotal: number;
  walletIntent: number;
  walletBalance: number;
  /** GST portion of gross — excluded from wallet eligibility (services / packages / meals). */
  gstAmount?: number;
}): WalletBookingSplitResult {
  const gross = round2(Math.max(0, params.grossTotal));
  const gst = round2(Math.max(0, Math.min(params.gstAmount ?? 0, gross)));
  const walletEligible = round2(Math.max(0, gross - gst));
  const intent = round2(Math.max(0, params.walletIntent));
  const balance = round2(Math.max(0, params.walletBalance));
  const walletApplied = round2(Math.min(intent, balance, walletEligible));
  const cashRemainder = round2(Math.max(0, gross - walletApplied));
  return {
    walletApplied,
    cashRemainder,
    walletEligible,
    // Fully wallet only when there is no GST left for Razorpay.
    fullyWallet: walletApplied > 0 && cashRemainder < 0.01 && gst < 0.01,
  };
}
