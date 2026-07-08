import type { UnifiedResolverResponse } from '@/lib/pricing/unified-resolver-response';

export function couponRejectionMessageFromQuote(
  quote: UnifiedResolverResponse | null,
  couponCode?: string
): string {
  if (!quote) {
    return 'Unable to validate coupon right now. Please try again.';
  }

  const warning = quote.displayMessages.find((m) => m.type === 'warning' || m.type === 'error');
  if (warning?.message) return warning.message;

  const rejected = quote.rejectedOffers.find(
    (r) =>
      r.trigger === 'CODE' ||
      r.offerType?.includes('COUPON') ||
      (couponCode && r.name?.toUpperCase() === couponCode.toUpperCase())
  );
  if (rejected?.reason && !rejected.reason.includes('BEST_OFFER_ONLY_NOT_WINNER')) {
    return rejected.reason;
  }

  const winner = quote.appliedOffers.find((o) => o.trigger === 'AUTO') ?? quote.winningPromotion;
  const rejectedCoupon = quote.rejectedOffers.find(
    (r) => r.trigger === 'CODE' || r.offerType?.includes('COUPON')
  );
  if (
    winner &&
    couponCode &&
    rejectedCoupon &&
    (rejectedCoupon.reasonCode === 'BEST_OFFER_ONLY_NOT_WINNER' ||
      rejectedCoupon.reason?.includes('BEST_OFFER_ONLY'))
  ) {
    return `${couponCode} was not applied because ${winner.name} saves more under the Best Offer policy.`;
  }

  if (winner && couponCode) {
    return 'This coupon is not valid for this booking or vendor.';
  }

  return 'This coupon is not applicable with your current offers.';
}
