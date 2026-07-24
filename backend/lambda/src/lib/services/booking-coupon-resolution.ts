/**
 * Resolve a booking coupon/promo code for calculate-booking — mirrors validate-code order:
 * vendor service promo → platform coded promotion → platform coupons table.
 */
import { query } from '../../database/rds-connection';
import { DiscountDomain } from '../../discount-engine/enums/discount-domain';
import { normalizeDbRow } from '../../utils/entity-extractor';
import { normalizeServicePromotionRow } from '../../utils/service-promotion-engine';
import {
  evaluatePlatformCodeViaProductionMode,
  evaluateServiceCodeViaProductionMode,
} from './promotion-code-validation-service';
import { validateCouponForAmount } from './platform-coupon-service';

export type BookingCouponDiscountResult = {
  valid: true;
  discountAmount: number;
  id: string;
  name: string;
  offerType: 'VENDOR_COUPON' | 'PLATFORM_PROMOTION' | 'PLATFORM_COUPON';
  source: 'vendor' | 'platform';
};

export async function resolveBookingCouponDiscount(params: {
  vendorId: string;
  customerId?: string;
  serviceIds?: string[];
  serviceCategory?: string;
  couponCode: string;
  amount: number;
  excludeBookingId?: string;
}): Promise<BookingCouponDiscountResult | null> {
  const code = params.couponCode.trim().toUpperCase();
  if (!code || params.amount <= 0) return null;

  const now = new Date().toISOString();

  const servicePromoRes = await query(
    `
      SELECT * FROM vendor_service_promotions
      WHERE code = $1
        AND vendor_id = $2::uuid
        AND is_active = true
        AND start_date <= $3::timestamptz
        AND end_date >= $3::timestamptz
      LIMIT 1
    `,
    [code, params.vendorId, now]
  );
  const serviceRows = Array.isArray(servicePromoRes)
    ? servicePromoRes
    : (servicePromoRes as { rows?: Record<string, unknown>[] }).rows ?? [];

  if (serviceRows.length > 0) {
    const promo = normalizeServicePromotionRow(normalizeDbRow(serviceRows[0]) as Record<string, unknown>);
    if (promo.min_booking_value != null && params.amount < promo.min_booking_value) {
      return null;
    }
    const { discountAmount } = await evaluateServiceCodeViaProductionMode(promo, params.amount, {
      vendorId: params.vendorId,
      customerId: params.customerId,
      serviceIds: params.serviceIds,
    });
    if (discountAmount > 0) {
      return {
        valid: true,
        discountAmount,
        id: promo.id,
        name: promo.name ?? code,
        offerType: 'VENDOR_COUPON',
        source: 'vendor',
      };
    }
  }

  const platformPromoRes = await query(
    `
      SELECT * FROM promotions
      WHERE code = $1
        AND is_active = true
        AND start_date <= $2::timestamptz
        AND (end_date IS NULL OR end_date >= $2::timestamptz)
        AND published = true
        AND (usage_limit IS NULL OR usage_count < usage_limit)
        AND (max_uses IS NULL OR usage_count < max_uses)
      LIMIT 1
    `,
    [code, now]
  );
  const platformRows = Array.isArray(platformPromoRes)
    ? platformPromoRes
    : (platformPromoRes as { rows?: Record<string, unknown>[] }).rows ?? [];

  if (platformRows.length > 0) {
    const promo = normalizeDbRow(platformRows[0]);
    const minOrder = promo.min_order_amount != null ? parseFloat(String(promo.min_order_amount)) : 0;
    if (minOrder > 0 && params.amount < minOrder) {
      return null;
    }
    const { discountAmount } = await evaluatePlatformCodeViaProductionMode(
      promo as Record<string, unknown>,
      params.amount,
      DiscountDomain.SERVICE,
      { vendorId: params.vendorId, customerId: params.customerId }
    );
    if (discountAmount > 0) {
      return {
        valid: true,
        discountAmount,
        id: String(promo.id),
        name: String(promo.name ?? code),
        offerType: 'PLATFORM_PROMOTION',
        source: 'platform',
      };
    }
  }

  const platformCoupon = await validateCouponForAmount(code, params.amount, DiscountDomain.SERVICE, {
    serviceCategory: params.serviceCategory,
    customerId: params.customerId,
    couponCode: code,
    excludeBookingId: params.excludeBookingId,
    vendorId: params.vendorId,
    serviceIds: params.serviceIds,
  });
  if (platformCoupon.valid && platformCoupon.discountAmount && platformCoupon.discountAmount > 0) {
    return {
      valid: true,
      discountAmount: platformCoupon.discountAmount,
      id: String(platformCoupon.couponId ?? code),
      name: String(platformCoupon.couponName ?? code),
      offerType: 'PLATFORM_COUPON',
      source: 'platform',
    };
  }

  return null;
}
