import type { PriceBreakdownLine } from './types';
import { roundMoney } from './format';

export type BookingFinancialSnapshot = {
  servicePrice: number;
  vendorDiscount: number;
  platformDiscount: number;
  couponDiscount: number;
  totalSavings: number;
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

/** Build financial snapshot from existing booking API fields — no new endpoints. */
export function extractBookingFinancial(raw: Record<string, unknown>): BookingFinancialSnapshot {
  const basePrice = roundMoney(
    parseFloat(String(raw.base_price ?? raw.basePrice ?? 0)) || 0
  );
  const finalPaid = roundMoney(
    parseFloat(String(raw.total_amount ?? raw.totalAmount ?? raw.amount ?? raw.price ?? 0)) || 0
  );
  const discountFromRow = roundMoney(
    parseFloat(String(raw.discount_amount ?? raw.discountAmount ?? 0)) || 0
  );
  const couponCode = raw.coupon_code ?? raw.couponCode;
  const couponCodeStr = couponCode ? String(couponCode).trim() : undefined;

  const meta = parsePromoMetaFromNotes(raw.notes);
  let vendorDiscount = meta.vendorDiscount ?? 0;
  let platformDiscount = meta.platformDiscount ?? 0;
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

  const promotionNames: string[] = [];
  if (vendorDiscount > 0) promotionNames.push('Vendor promotion');
  if (platformDiscount > 0) promotionNames.push('Platform offer');

  const lines: PriceBreakdownLine[] = [
    { kind: 'base', label: 'Service price', amount: servicePrice, emphasis: 'default' },
  ];

  if (vendorDiscount > 0) {
    lines.push({
      kind: 'vendor_discount',
      label: 'Vendor promotion',
      amount: -vendorDiscount,
      emphasis: 'discount',
    });
  }
  if (platformDiscount > 0) {
    lines.push({
      kind: 'platform_discount',
      label: 'Platform offer',
      amount: -platformDiscount,
      emphasis: 'discount',
    });
  }
  if (couponCodeStr && couponDiscount > 0) {
    lines.push({
      kind: 'coupon',
      label: `Coupon (${couponCodeStr})`,
      amount: -couponDiscount,
      emphasis: 'discount',
    });
  } else if (computedSavings > 0 && vendorDiscount <= 0 && platformDiscount <= 0 && !couponCodeStr) {
    lines.push({
      kind: 'other_discount',
      label: 'Promotion',
      amount: -computedSavings,
      emphasis: 'discount',
    });
  }

  if (computedSavings > 0) {
    lines.push({
      kind: 'savings',
      label: 'Total savings',
      amount: -computedSavings,
      emphasis: 'discount',
    });
  }

  lines.push({
    kind: 'final',
    label: 'Final paid',
    amount: finalPaid > 0 ? finalPaid : Math.max(0, servicePrice - computedSavings),
    emphasis: 'total',
  });

  return {
    servicePrice,
    vendorDiscount,
    platformDiscount,
    couponDiscount,
    totalSavings: computedSavings,
    finalPaid: finalPaid > 0 ? finalPaid : Math.max(0, servicePrice - computedSavings),
    promotionNames,
    couponCode: couponCodeStr,
    lines,
  };
}
