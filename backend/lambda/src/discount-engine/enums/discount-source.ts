/**
 * Canonical origin of a discount definition (independent of DB table name).
 */
export enum DiscountSource {
  PLATFORM_PROMOTION = 'PLATFORM_PROMOTION',
  VENDOR_PROMOTION = 'VENDOR_PROMOTION',
  PLATFORM_COUPON = 'PLATFORM_COUPON',
  VENDOR_COUPON = 'VENDOR_COUPON',
  /** Reserved — not loaded in production today */
  LOYALTY = 'LOYALTY',
  REFERRAL = 'REFERRAL',
  MEMBERSHIP = 'MEMBERSHIP',
  GIFT_CARD = 'GIFT_CARD',
}
