import { isPricingCurrentlyEffective } from '../../../warmpawz-pay/shared/pricing/pricing-effective';
import type { WpayVendorListDbRow } from '../repos/wpay-vendors-list.repo';

export type WpayDiscountQuoteOptions = {
  maxDiscountAmount?: number | null;
  appointmentFeeCredit?: number;
};

export type WpayDiscountQuote = {
  /** Vendor-quoted gross bill before appointment fee credit. */
  originalAmount: number;
  /** WAPPT appointment fee applied against the quote (0 for walk-in). */
  appointmentFeeCredit: number;
  /** Amount discount % is applied to: originalAmount − appointmentFeeCredit. */
  billBase: number;
  discountPercent: number;
  discountAmount: number;
  payableAmount: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function resolveWpayDiscountPercent(row: WpayVendorListDbRow): number {
  const value = row.pricing_discount_value != null ? Number(row.pricing_discount_value) : 0;
  const effective = isPricingCurrentlyEffective({
    status: String(row.pricing_status ?? 'disabled') as 'active' | 'disabled',
    effectiveFrom: row.pricing_effective_from ? new Date(row.pricing_effective_from) : new Date(0),
    effectiveUntil: row.pricing_effective_until ? new Date(row.pricing_effective_until) : null,
    discountValue: Number.isFinite(value) ? value : 0,
  });
  return effective && Number.isFinite(value) ? round2(value) : 0;
}

export function computeWpayDiscountQuote(
  originalAmount: number,
  discountPercent: number,
  options: WpayDiscountQuoteOptions | null = null,
): WpayDiscountQuote {
  const original = round2(Number(originalAmount));
  if (!Number.isFinite(original) || original <= 0) {
    throw new Error('Invalid bill amount');
  }

  const rawCredit = options?.appointmentFeeCredit ?? 0;
  const appointmentFeeCredit =
    Number.isFinite(rawCredit) && rawCredit > 0 ? round2(Math.min(original, rawCredit)) : 0;

  const billBase = round2(Math.max(0, original - appointmentFeeCredit));

  let discountRaw = (billBase * discountPercent) / 100;
  const maxDiscountAmount = options?.maxDiscountAmount ?? null;
  if (maxDiscountAmount != null && discountRaw > maxDiscountAmount) {
    discountRaw = maxDiscountAmount;
  }
  const discountAmount = round2(discountRaw);
  const payableAmount = Math.max(0.01, round2(billBase - discountAmount));

  return {
    originalAmount: original,
    appointmentFeeCredit,
    billBase,
    discountPercent,
    discountAmount,
    payableAmount,
  };
}
