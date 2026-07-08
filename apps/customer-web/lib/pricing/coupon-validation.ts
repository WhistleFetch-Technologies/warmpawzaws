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
  serviceCategory?: string;
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

function toFiniteNumber(value: unknown, fallback = 0): number {
  if (value == null || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function calculateDiscountAmount(
  type: 'percentage' | 'fixed',
  value: unknown,
  amount: unknown,
  minAmount?: unknown,
  maxDiscount?: unknown
): number {
  const numericValue = toFiniteNumber(value);
  const numericAmount = toFiniteNumber(amount);
  const numericMin = toFiniteNumber(minAmount);
  const numericMax = toFiniteNumber(maxDiscount);

  if (numericMin > 0 && numericAmount < numericMin) return 0;

  let discount = type === 'percentage' ? (numericAmount * numericValue) / 100 : numericValue;
  if (numericMax > 0 && discount > numericMax) discount = numericMax;
  return Math.max(0, Math.min(discount, numericAmount));
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

  const amount = Math.max(0, toFiniteNumber(params.amount));

  try {
    const promoRes = await apiClient.post<any>('/promotions/validate-code', {
      code,
      vendorId: params.vendorId,
      customerId: params.customerId,
      orderAmount: params.orderType === 'product' ? amount : undefined,
      bookingAmount: params.orderType === 'service' ? amount : undefined,
      orderType: params.orderType,
      serviceCategory: params.serviceCategory,
      ...(params.cartItems?.length ? { items: params.cartItems } : {}),
    });

    if (promoRes?.valid) {
      const discountType =
        promoRes.promotion?.discount_type === 'fixed' ? 'fixed' : 'percentage';
      const discountValue = toFiniteNumber(promoRes.promotion?.discount_value);
      const discountAmount =
        promoRes.discount_amount != null
          ? Math.max(0, Math.min(toFiniteNumber(promoRes.discount_amount), amount))
          :
        calculateDiscountAmount(
          discountType,
          discountValue,
          amount,
          promoRes.promotion?.min_order_value || promoRes.promotion?.min_booking_value,
          promoRes.promotion?.max_discount_amount
        );

      return {
        ok: true,
        coupon: {
          code,
          discountType,
          discountValue,
          discountAmount,
          promotionId: promoRes.promotion?.id,
          promoCategory: promoRes.promo_category,
          label: promoRes.promotion?.name || promoRes.description,
        },
      };
    }

    const legacy = await apiClient.get<any>(`/coupons/validate/${code}?amount=${amount}`);
    if (legacy?.valid && legacy.coupon) {
      const discountType =
        legacy.coupon.discount_type === 'fixed' ? 'fixed' : 'percentage';
      const discountValue = toFiniteNumber(legacy.coupon.discount_value);
      const discountAmount = calculateDiscountAmount(
        discountType,
        discountValue,
        amount,
        legacy.coupon.min_amount,
        legacy.coupon.max_discount
      );

      return {
        ok: true,
        coupon: {
          code,
          discountType,
          discountValue,
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
