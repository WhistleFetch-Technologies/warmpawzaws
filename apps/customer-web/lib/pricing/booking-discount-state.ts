/**
 * Single source of truth for booking discount UI + booking-create payload.
 * All surfaces must derive from the latest UnifiedResolverResponse only —
 * never merge stale promotion metadata with a new winning coupon.
 */
import type { AppliedCheckoutCoupon } from '@/lib/pricing/coupon-validation';
import {
  couponSavingsFromQuote,
  promoSavingsFromQuote,
  totalSavingsFromQuote,
  type UnifiedResolverAppliedOffer,
  type UnifiedResolverResponse,
} from '@/lib/pricing/unified-resolver-response';

export type BookingDiscountUiPromotion = {
  id: string;
  type: 'spotlight' | 'vendor';
  title: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  discountAmount: number;
  applicable: true;
};

export type BookingDiscountDerived = {
  quote: UnifiedResolverResponse;
  /** Auto-promo rows for display — empty when a coupon wins Best Offer. */
  uiPromotions: BookingDiscountUiPromotion[];
  uiAppliedPromotion: BookingDiscountUiPromotion | null;
  appliedCoupon: AppliedCheckoutCoupon | null;
  couponWins: boolean;
  promotionDiscount: number;
  couponDiscount: number;
  totalSavings: number;
  vendorDiscountLine: number;
  platformDiscountLine: number;
  vendorPromotionId?: string;
  platformPromotionId?: string;
  couponCode?: string;
  skippedAutoPromoName?: string;
};

export type DeriveBookingDiscountOptions = {
  /** Known coupon code (required for payload when coupon wins). */
  couponCode?: string | null;
};

function appliedCouponOffer(
  quote: UnifiedResolverResponse
): UnifiedResolverAppliedOffer | undefined {
  return quote.appliedOffers.find((o) => o.source === 'coupon' || o.trigger === 'CODE');
}

function autoOffers(quote: UnifiedResolverResponse): UnifiedResolverAppliedOffer[] {
  return quote.appliedOffers.filter((o) => o.trigger === 'AUTO');
}

function toUiPromotion(offer: UnifiedResolverAppliedOffer): BookingDiscountUiPromotion {
  return {
    id: offer.id,
    type: offer.source === 'platform' ? 'spotlight' : 'vendor',
    title: offer.name,
    description: offer.name,
    discountType: 'percentage',
    discountValue: 0,
    discountAmount: offer.discountAmount,
    applicable: true,
  };
}

/** Promotion ids for booking create — winning offer only; never both auto-promo and coupon. */
function winningPromotionIds(
  quote: UnifiedResolverResponse,
  couponWins: boolean,
  appliedCoupon: UnifiedResolverAppliedOffer | undefined
): { vendorPromotionId?: string; platformPromotionId?: string } {
  if (couponWins && appliedCoupon) {
    const rejectedAutoIds = new Set(
      quote.rejectedOffers.filter((r) => r.trigger === 'AUTO').map((r) => r.id)
    );
    let vendorPromotionId: string | undefined;
    let platformPromotionId: string | undefined;

    if (quote.vendorPromotionId && !rejectedAutoIds.has(quote.vendorPromotionId)) {
      vendorPromotionId = quote.vendorPromotionId;
    }
    if (quote.platformPromotionId && !rejectedAutoIds.has(quote.platformPromotionId)) {
      platformPromotionId = quote.platformPromotionId;
    }

    if (!vendorPromotionId && !platformPromotionId) {
      if (appliedCoupon.source === 'vendor') {
        vendorPromotionId = appliedCoupon.id;
      } else {
        platformPromotionId = appliedCoupon.id;
      }
    }

    return { vendorPromotionId, platformPromotionId };
  }

  const winner = autoOffers(quote)[0] ?? quote.winningPromotion ?? undefined;
  if (!winner || winner.trigger === 'CODE' || winner.source === 'coupon') {
    return {};
  }
  if (winner.source === 'vendor') {
    return { vendorPromotionId: winner.id };
  }
  if (winner.source === 'platform') {
    return { platformPromotionId: winner.id };
  }
  return {};
}

/**
 * Derive all booking discount state from the latest resolver quote.
 * Replaces any previous promotion/coupon metadata — callers must not merge with stale state.
 */
export function deriveBookingDiscountFromQuote(
  quote: UnifiedResolverResponse | null | undefined,
  options?: DeriveBookingDiscountOptions
): BookingDiscountDerived | null {
  if (!quote || quote.success === false) return null;

  const couponOffer = appliedCouponOffer(quote);
  const couponWins = Boolean(couponOffer && couponOffer.discountAmount > 0);
  const promoDiscount = couponWins ? 0 : promoSavingsFromQuote(quote);
  const couponDiscount = couponWins
    ? couponOffer!.discountAmount
    : couponSavingsFromQuote(quote);
  const totalSavings = totalSavingsFromQuote(quote);

  const auto = autoOffers(quote);
  const uiPromotions = couponWins ? [] : auto.map(toUiPromotion);
  const uiAppliedPromotion =
    couponWins || promoDiscount <= 0
      ? null
      : toUiPromotion(auto[0] ?? quote.winningPromotion!);

  const couponCode = couponWins
    ? (options?.couponCode?.trim().toUpperCase() || undefined)
    : undefined;

  const appliedCoupon: AppliedCheckoutCoupon | null =
    couponWins && couponOffer && couponCode
      ? {
          code: couponCode,
          discountType: 'fixed',
          discountValue: couponOffer.discountAmount,
          discountAmount: couponOffer.discountAmount,
          promotionId: couponOffer.id,
          label: couponOffer.name,
        }
      : null;

  const { vendorPromotionId, platformPromotionId } = winningPromotionIds(
    quote,
    couponWins,
    couponOffer
  );

  const skippedAutoPromoName = couponWins
    ? quote.rejectedOffers.find((r) => r.trigger === 'AUTO')?.name
    : undefined;

  return {
    quote,
    uiPromotions,
    uiAppliedPromotion,
    appliedCoupon,
    couponWins,
    promotionDiscount: promoDiscount,
    couponDiscount: couponWins ? couponDiscount : 0,
    totalSavings,
    vendorDiscountLine: couponWins ? 0 : quote.savings.vendorDiscountAmount,
    platformDiscountLine: couponWins ? 0 : Math.max(0, quote.savings.platformDiscountAmount),
    vendorPromotionId,
    platformPromotionId,
    couponCode,
    skippedAutoPromoName,
  };
}

export type BookingCreateDiscountPayload = {
  discountAmount: number;
  couponDiscount?: number;
  couponCode?: string;
  vendorPromotionId?: string;
  platformPromotionId?: string;
};

/** Fields for POST /bookings/create — derived only from the latest quote. */
export function buildBookingCreateDiscountPayload(
  quote: UnifiedResolverResponse | null | undefined,
  couponCode?: string | null
): BookingCreateDiscountPayload | null {
  const derived = deriveBookingDiscountFromQuote(quote, { couponCode });
  if (!derived || derived.totalSavings <= 0) return null;

  const payload: BookingCreateDiscountPayload = {
    discountAmount: derived.promotionDiscount,
  };
  if (derived.couponDiscount > 0) {
    payload.couponDiscount = derived.couponDiscount;
  }
  if (derived.couponCode) {
    payload.couponCode = derived.couponCode;
  }
  if (derived.vendorPromotionId) {
    payload.vendorPromotionId = derived.vendorPromotionId;
  }
  if (derived.platformPromotionId) {
    payload.platformPromotionId = derived.platformPromotionId;
  }
  return payload;
}

/** Replace all booking discount React state from one resolver quote. */
export function syncBookingDiscountStateFromQuote(
  quote: UnifiedResolverResponse | null | undefined,
  options: DeriveBookingDiscountOptions & {
    setQuote: (q: UnifiedResolverResponse | null) => void;
    setPromotions: (p: BookingDiscountUiPromotion[]) => void;
    setAppliedPromotion: (p: BookingDiscountUiPromotion | null) => void;
    setAppliedCoupon: (c: AppliedCheckoutCoupon | null) => void;
  }
): BookingDiscountDerived | null {
  options.setQuote(quote ?? null);
  if (!quote) {
    options.setPromotions([]);
    options.setAppliedPromotion(null);
    options.setAppliedCoupon(null);
    return null;
  }

  const derived = deriveBookingDiscountFromQuote(quote, options);
  if (!derived) {
    options.setPromotions([]);
    options.setAppliedPromotion(null);
    options.setAppliedCoupon(null);
    return null;
  }

  options.setPromotions(derived.uiPromotions);
  options.setAppliedPromotion(derived.uiAppliedPromotion);
  options.setAppliedCoupon(derived.appliedCoupon);
  return derived;
}
