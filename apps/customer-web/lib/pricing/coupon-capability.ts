export type CouponCheckoutKind = 'service_booking' | 'product_order' | 'meal';

export type CouponAvailabilityResult = {
  available: boolean;
  message?: string;
  /** When unavailable, whether probe completed successfully (vs network error). */
  probed: boolean;
};

export type CheckCouponAvailabilityParams = {
  kind: CouponCheckoutKind;
  vendorId?: string;
  serviceCategory?: string;
  /** When false, coupon UI is hidden (e.g. package purchase API has no coupon field). */
  paymentSupportsCoupon?: boolean;
};

const UNAVAILABLE_MSG = 'Coupons are not available for this booking';

/**
 * Derives whether manual coupon entry should be shown for a checkout domain.
 * Product checkout is always enabled (existing cart flow).
 * Service bookings always show coupon entry; offer listing is loaded separately.
 */
export async function checkCouponAvailability(
  params: CheckCouponAvailabilityParams
): Promise<CouponAvailabilityResult> {
  if (params.paymentSupportsCoupon === false) {
    return { available: false, message: UNAVAILABLE_MSG, probed: true };
  }

  if (params.kind === 'product_order') {
    return { available: true, probed: true };
  }

  return { available: true, probed: true };
}
