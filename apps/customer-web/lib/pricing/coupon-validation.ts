import { apiClient } from '@/lib/api-client';

export type AppliedCheckoutCoupon = {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  discountAmount: number;
  promotionId?: string;
  promoCategory?: string;
  label?: string;
};

export type CouponValidateOrderType = 'service' | 'product';

export type ValidateCouponCodeParams = {
  code: string;
  vendorId?: string;
  customerId?: string;
  orderType: CouponValidateOrderType;
  /** Taxable subtotal after auto-promotions — used for stack ordering. */
  amount: number;
  /** Product cart lines for vendor product promos. */
  cartItems?: Array<{
    productId: string;
    quantity: number;
    price: number;
    categoryId?: string;
    category?: string;
  }>;
};

function calculateDiscountAmount(
  type: 'percentage' | 'fixed',
  value: number,
  amount: number,
  minAmount?: number,
  maxDiscount?: number
): number {
  if (minAmount && amount < minAmount) return 0;

  let discount = type === 'percentage' ? (amount * value) / 100 : value;
  if (maxDiscount && discount > maxDiscount) discount = maxDiscount;
  return Math.min(discount, amount);
}

/**
 * Unified coupon validation — POST /promotions/validate-code with legacy GET fallback.
 */
export async function validateCouponCode(
  params: ValidateCouponCodeParams
): Promise<{ ok: true; coupon: AppliedCheckoutCoupon } | { ok: false; message: string }> {
  const code = params.code.trim().toUpperCase();
  if (!code) {
    return { ok: false, message: 'Please enter a coupon code' };
  }

  const amount = Math.max(0, params.amount);

  try {
    const promoRes = await apiClient.post<any>('/promotions/validate-code', {
      code,
      vendorId: params.vendorId,
      customerId: params.customerId,
      orderAmount: params.orderType === 'product' ? amount : undefined,
      bookingAmount: params.orderType === 'service' ? amount : undefined,
      orderType: params.orderType,
      ...(params.cartItems?.length ? { items: params.cartItems } : {}),
    });

    if (promoRes?.valid) {
      const discountAmount =
        promoRes.discount_amount ??
        calculateDiscountAmount(
          promoRes.promotion?.discount_type || 'percentage',
          promoRes.promotion?.discount_value || 0,
          amount,
          promoRes.promotion?.min_order_value || promoRes.promotion?.min_booking_value,
          promoRes.promotion?.max_discount_amount
        );

      return {
        ok: true,
        coupon: {
          code,
          discountType: promoRes.promotion?.discount_type || 'percentage',
          discountValue: promoRes.promotion?.discount_value || 0,
          discountAmount,
          promotionId: promoRes.promotion?.id,
          promoCategory: promoRes.promo_category,
          label: promoRes.promotion?.name || promoRes.description,
        },
      };
    }

    const legacy = await apiClient.get<any>(`/coupons/validate/${code}?amount=${amount}`);
    if (legacy?.valid && legacy.coupon) {
      const discountAmount = calculateDiscountAmount(
        legacy.coupon.discount_type,
        legacy.coupon.discount_value,
        amount,
        legacy.coupon.min_amount,
        legacy.coupon.max_discount
      );

      return {
        ok: true,
        coupon: {
          code,
          discountType: legacy.coupon.discount_type,
          discountValue: legacy.coupon.discount_value,
          discountAmount,
          promotionId: legacy.coupon.id,
          promoCategory: 'platform',
          label: legacy.coupon.name,
        },
      };
    }

    return {
      ok: false,
      message: promoRes?.message || legacy?.error || 'Invalid coupon code',
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to validate coupon';
    return { ok: false, message };
  }
}

export function couponValidateOrderTypeForCheckout(
  kind: 'service_booking' | 'product_order' | 'meal'
): CouponValidateOrderType {
  return kind === 'product_order' ? 'product' : 'service';
}
