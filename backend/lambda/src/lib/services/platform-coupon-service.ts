/**
 * Platform coupon validation — shared by promotions HTTP handlers and booking legacy fallback (S5/E6).
 */
import { query, select } from '../../database/rds-connection';
import { computeCouponDiscountAmount } from '../../discount-engine/benefits/adapters/coupon-benefit.adapter';
import { couponValidateToDiscountContext } from '../../discount-engine/adapters/context-mappers';
import { DiscountDomain } from '../../discount-engine/enums/discount-domain';
import { shadowCouponEligibility } from '../../discount-engine/rules/adapters/shadow-adapters';
import {
  invokeResolverAlongsideLegacy,
  resolveWithProductionMode,
} from '../../discount-engine/resolver/production-bridge';
import { mapResolverResultToCouponValidation } from '../../discount-engine/resolver/resolver-result-mappers';
import { couponRowMatchesService } from '../../utils/coupon-targeting';

export type CouponValidationResult = {
  success: boolean;
  valid: boolean;
  coupon?: {
    id: string;
    code: string;
    name: string;
    discountType: string;
    discountValue: string;
  };
  discountAmount?: number;
  couponId?: string;
  couponName?: string;
  error?: string;
};

export type CouponValidationOptions = {
  serviceCategory?: string;
};

/**
 * @deprecated Inline validation path — retained for OFF/fallback; V2 authoritative via resolveWithProductionMode.
 */
async function validateCouponLegacy(
  couponCode: string,
  amount: number,
  domain: DiscountDomain,
  options?: CouponValidationOptions
): Promise<CouponValidationResult> {
  try {
    const coupons = await select('coupons', { code: couponCode.toUpperCase(), is_active: true });
    if (coupons.length === 0) {
      return { success: false, valid: false, error: 'Invalid coupon code' };
    }

    const coupon = coupons[0];

    if (
      domain === DiscountDomain.SERVICE &&
      options?.serviceCategory &&
      !couponRowMatchesService(coupon as Record<string, unknown>, options.serviceCategory)
    ) {
      return {
        success: false,
        valid: false,
        error: 'This coupon is not valid for this service category',
      };
    }
    const now = new Date();
    const startDate = new Date(coupon.start_date);
    const endDate = coupon.end_date ? new Date(coupon.end_date) : null;

    if (now < startDate || (endDate && now > endDate)) {
      shadowCouponEligibility(coupon, amount, 0, false, 'Coupon has expired');
      return { success: false, valid: false, error: 'Coupon has expired' };
    }

    if (coupon.min_order_amount && amount < parseFloat(coupon.min_order_amount)) {
      shadowCouponEligibility(
        coupon,
        amount,
        0,
        false,
        `Minimum order amount of ₹${coupon.min_order_amount} required`
      );
      return {
        success: false,
        valid: false,
        error: `Minimum order amount of ₹${coupon.min_order_amount} required`,
      };
    }

    let usageCount = 0;
    if (coupon.max_uses) {
      const usageCountResult = await query(
        'SELECT COUNT(*) as count FROM coupon_usages WHERE coupon_id = $1',
        [coupon.id]
      ).catch(() => ({ rows: [{ count: '0' }] }));
      usageCount = parseInt(usageCountResult.rows[0]?.count || '0', 10);
      if (usageCount >= coupon.max_uses) {
        shadowCouponEligibility(coupon, amount, usageCount, false, 'Coupon usage limit reached');
        return { success: false, valid: false, error: 'Coupon usage limit reached' };
      }
    }

    shadowCouponEligibility(coupon, amount, usageCount, true);

    let legacyDiscountAmount = 0;
    if (coupon.discount_type === 'percentage') {
      legacyDiscountAmount = (amount * parseFloat(coupon.discount_value || '0')) / 100;
      if (coupon.max_discount_amount) {
        legacyDiscountAmount = Math.min(
          legacyDiscountAmount,
          parseFloat(coupon.max_discount_amount)
        );
      }
    } else if (coupon.discount_type === 'fixed') {
      legacyDiscountAmount = parseFloat(coupon.discount_value || '0');
    }

    const discountAmount = computeCouponDiscountAmount({
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
      amount,
      maxDiscountAmount: coupon.max_discount_amount,
      legacyAmount: legacyDiscountAmount,
    });

    invokeResolverAlongsideLegacy(
      domain === DiscountDomain.SERVICE
        ? 'validateCouponInternal-service'
        : 'validateCouponInternal-ecommerce',
      couponValidateToDiscountContext(coupon, amount, { domain, usageCount })
    );

    return {
      success: true,
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        discountType: coupon.discount_type,
        discountValue: coupon.discount_value,
      },
      discountAmount,
      couponId: String(coupon.id),
      couponName: String(coupon.name ?? coupon.code),
    };
  } catch (error: unknown) {
    return {
      success: false,
      valid: false,
      error: error instanceof Error ? error.message : 'Coupon validation failed',
    };
  }
}

/** Validate platform coupon with production resolver mode (S5/E6). */
export async function validateCouponForAmount(
  couponCode: string,
  amount: number,
  domain: DiscountDomain = DiscountDomain.ECOMMERCE,
  options?: CouponValidationOptions
): Promise<CouponValidationResult> {
  const code = couponCode.trim().toUpperCase();
  if (!code) {
    return { success: false, valid: false, error: 'Coupon code required' };
  }

  const coupons = await select('coupons', { code, is_active: true }).catch(() => []);
  const coupon = coupons[0];
  if (!coupon) {
    return validateCouponLegacy(code, amount, domain, options);
  }

  if (
    domain === DiscountDomain.SERVICE &&
    options?.serviceCategory &&
    !couponRowMatchesService(coupon as Record<string, unknown>, options.serviceCategory)
  ) {
    return {
      success: false,
      valid: false,
      error: 'This coupon is not valid for this service category',
    };
  }

  let usageCount = 0;
  if (coupon.max_uses) {
    const usageCountResult = await query(
      'SELECT COUNT(*) as count FROM coupon_usages WHERE coupon_id = $1',
      [coupon.id]
    ).catch(() => ({ rows: [{ count: '0' }] }));
    usageCount = parseInt(usageCountResult.rows[0]?.count || '0', 10);
  }

  const context = couponValidateToDiscountContext(coupon, amount, { domain, usageCount });

  const { value } = await resolveWithProductionMode({
    label: `validateCoupon-${domain}`,
    context,
    legacy: () => validateCouponLegacy(code, amount, domain, options),
    mapResolverToLegacy: (result) => {
      const mapped = mapResolverResultToCouponValidation(result);
      if (!mapped.valid) {
        return { success: false, valid: false, error: 'Coupon not applicable' };
      }
      return {
        success: true,
        valid: true,
        coupon: {
          id: mapped.couponId ?? coupon.id,
          code: coupon.code,
          name: coupon.name,
          discountType: coupon.discount_type,
          discountValue: coupon.discount_value,
        },
        discountAmount: mapped.discountAmount,
        couponId: mapped.couponId ?? String(coupon.id),
        couponName: String(coupon.name ?? coupon.code),
      };
    },
  });

  return value;
}

/** @deprecated Use validateCouponForAmount — alias for promotions.ts internal helper */
export async function validateCouponInternal(
  couponCode: string,
  amount: number
): Promise<CouponValidationResult> {
  return validateCouponForAmount(couponCode, amount, DiscountDomain.ECOMMERCE);
}
