/** Shared pricing model — UI-only; mirrors API fields without changing backend. */

export type PricingDomain = 'service' | 'package' | 'meal' | 'product';

export type SavingsBadgeVariant =
  | 'save_amount'
  | 'auto_applied'
  | 'coupon_applied'
  | 'platform_offer'
  | 'vendor_offer';

export type PriceBreakdownLineKind =
  | 'base'
  | 'vendor_discount'
  | 'platform_discount'
  | 'coupon'
  | 'tax'
  | 'platform_fee'
  | 'convenience_fee'
  | 'delivery_fee'
  | 'packaging_fee'
  | 'wallet'
  | 'other_discount'
  | 'subtotal'
  | 'savings'
  | 'final';

export type PriceBreakdownLine = {
  id?: string;
  kind: PriceBreakdownLineKind;
  label: string;
  amount: number;
  /** Negative amounts render as discounts */
  emphasis?: 'default' | 'discount' | 'total' | 'muted';
  indent?: boolean;
};

export type PricingSnapshot = {
  domain: PricingDomain;
  originalPrice: number;
  currentPrice: number;
  totalSavings: number;
  finalPaid: number;
  discountPercent?: number;
  promotionLabels?: string[];
  couponCode?: string;
  autoApplied?: boolean;
  offerAvailable?: boolean;
  loading?: boolean;
  footnote?: string;
};

export type AppliedPromotionOffer = {
  id: string;
  name: string;
  source?: 'vendor' | 'platform' | 'coupon';
  discountAmount?: number;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  promotionType?: string;
  code?: string;
  autoApply?: boolean;
  description?: string;
};
