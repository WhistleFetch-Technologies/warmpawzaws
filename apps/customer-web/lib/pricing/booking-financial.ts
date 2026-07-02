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
  promotionNames: string[];
  couponCode?: string;
  lines: PriceBreakdownLine[];
};

function parsePromoMetaFromNotes(notes: unknown): {
  vendorDiscount?: number;
  platformDiscount?: number;
  vendorPromotionId?: string;
  platformPromotionId?: string;
} {
  if (!notes || typeof notes !== 'string') return {};
  const match = notes.match(/wp_promo_meta:(\{[^}]+\})/);
  if (!match) return {};
  try {
    const meta = JSON.parse(match[1]) as Record<string, unknown>;
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
  const basePrice = num(raw.base_price ?? raw.basePrice);
  const finalPaid = num(raw.total_amount ?? raw.totalAmount ?? raw.amount ?? raw.price);
  const discountFromRow = num(raw.discount_amount ?? raw.discountAmount);
  const couponCode = raw.coupon_code ?? raw.couponCode;
  const couponCodeStr = couponCode ? String(couponCode).trim() : undefined;

  const meta = parsePromoMetaFromNotes(raw.notes);
  let vendorDiscount = roundMoney(meta.vendorDiscount ?? 0);
  let platformDiscount = roundMoney(meta.platformDiscount ?? 0);
  let couponDiscount = 0;

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
    basePrice > 0 ? basePrice : servicesSum > 0 ? roundMoney(servicesSum) : roundMoney(finalPaid + discountFromRow);

  const totalSavings = roundMoney(vendorDiscount + platformDiscount + couponDiscount);
  const computedSavings =
    totalSavings > 0 ? totalSavings : Math.max(0, roundMoney(servicePrice - finalPaid));

  let effectiveVendorDiscount = vendorDiscount;
  let effectivePlatformDiscount = platformDiscount;
  let effectiveCouponDiscount = couponDiscount;
  let vendorDiscountLabel = 'Vendor promotion';

  if (
    effectiveVendorDiscount + effectivePlatformDiscount + effectiveCouponDiscount <= 0 &&
    computedSavings > 0
  ) {
    effectiveVendorDiscount = computedSavings;
    vendorDiscountLabel = 'Promotion';
  }

  const promoTotal =
    effectiveVendorDiscount + effectivePlatformDiscount + effectiveCouponDiscount;
  const subtotalAfterDiscounts = Math.max(0, roundMoney(servicePrice - promoTotal));

  const feeFields = parseFeeBreakdown(raw);
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
  if (vendorDiscount > 0) promotionNames.push('Vendor promotion');
  if (platformDiscount > 0) promotionNames.push('Platform offer');

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
    subtotalAfterDiscounts,
    finalAmount: resolvedFinal,
  }).map((line) =>
    line.kind === 'final' ? { ...line, label: 'Final paid' } : line
  );

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
    promotionNames,
    couponCode: couponCodeStr,
    lines,
  };
}
