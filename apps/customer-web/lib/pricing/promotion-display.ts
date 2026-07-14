import type { SavingsBadgeVariant } from './types';

export type OfferSource = 'platform' | 'vendor';

/** Human-readable promotion type from API slug. */
export function formatPromotionTypeName(type?: string | null): string {
  if (!type?.trim()) return 'Promotion';
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function offerSourceToBadgeVariant(source?: OfferSource | string | null): SavingsBadgeVariant {
  if (source === 'platform') return 'platform_offer';
  if (source === 'vendor') return 'vendor_offer';
  return 'auto_applied';
}

export function offerSourceLabel(source?: OfferSource | string | null): string {
  if (source === 'platform') return 'Platform promotion';
  if (source === 'vendor') return 'Promotion';
  return 'Promotion';
}

/** Customer-facing discount line — never expose vendor/platform sourcing on shop surfaces. */
export function customerDiscountLabel(name?: string | null): string {
  const trimmed = name?.trim();
  return trimmed || 'Discount';
}

/** Build short promotion detail lines for confirmation / invoice surfaces. */
export function buildPromotionDetailLines(input: {
  name?: string;
  promotionType?: string;
  offerSource?: OfferSource | string;
  discountType?: 'percentage' | 'fixed' | string;
  discountValue?: number;
  couponCode?: string;
}): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [];
  if (input.name?.trim()) {
    lines.push({ label: 'Offer', value: input.name.trim() });
  }
  if (input.promotionType) {
    lines.push({ label: 'Type', value: formatPromotionTypeName(input.promotionType) });
  }
  if (input.offerSource) {
    lines.push({ label: 'Provided by', value: offerSourceLabel(input.offerSource) });
  }
  if (input.discountType === 'percentage' && input.discountValue != null) {
    lines.push({ label: 'Discount', value: `${input.discountValue}% OFF` });
  } else if (input.discountValue != null && input.discountValue > 0) {
    lines.push({ label: 'Discount', value: `₹${input.discountValue} OFF` });
  }
  if (input.couponCode?.trim()) {
    lines.push({ label: 'Coupon code', value: input.couponCode.trim().toUpperCase() });
  }
  return lines;
}
