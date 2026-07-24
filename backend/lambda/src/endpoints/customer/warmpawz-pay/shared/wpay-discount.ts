import { isPricingCurrentlyEffective } from '../../../warmpawz-pay/shared/pricing/pricing-effective';
import type { WpayVendorListDbRow } from '../repos/wpay-vendors-list.repo';

export type WpayDiscountQuote = {
  originalAmount: number;
  discountPercent: number;
  discountAmount: number;
  payableAmount: number;
};

export function resolveWpayDiscountPercent(row: WpayVendorListDbRow): number {
  const value = row.pricing_discount_value != null ? Number(row.pricing_discount_value) : 0;
  const effective = isPricingCurrentlyEffective({
    status: String(row.pricing_status ?? 'disabled') as 'active' | 'disabled',
    effectiveFrom: row.pricing_effective_from ? new Date(row.pricing_effective_from) : new Date(0),
    effectiveUntil: row.pricing_effective_until ? new Date(row.pricing_effective_until) : null,
    discountValue: Number.isFinite(value) ? value : 0,
  });
  return effective && Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

export function computeWpayDiscountQuote(
  originalAmount: number,
  discountPercent: number,
  maxDiscountAmount: number | null = null,
): WpayDiscountQuote {
  const original = Math.round(Number(originalAmount) * 100) / 100;
  if (!Number.isFinite(original) || original <= 0) {
    throw new Error('Invalid bill amount');
  }

  let discountRaw = (original * discountPercent) / 100;
  if (maxDiscountAmount != null && discountRaw > maxDiscountAmount) {
    discountRaw = maxDiscountAmount;
  }
  const discountAmount = Math.round(discountRaw * 100) / 100;
  const payableAmount = Math.max(0.01, Math.round((original - discountAmount) * 100) / 100);

  return {
    originalAmount: original,
    discountPercent,
    discountAmount,
    payableAmount,
  };
}
