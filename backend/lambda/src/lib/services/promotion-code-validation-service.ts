/**
 * S3 — validate-code via Unified Resolver with legacy fallback.
 */
import { DiscountDomain } from '../../discount-engine/enums/discount-domain';
import { DiscountTrigger } from '../../discount-engine/enums/discount-trigger';
import {
  cartLinesToDiscountContextItems,
  platformPromotionCodeToDiscountContext,
  vendorServiceCodeToDiscountContext,
  vendorPromoEvaluateToDiscountContext,
} from '../../discount-engine/adapters/context-mappers';
import { resolveWithProductionMode } from '../../discount-engine/resolver/production-bridge';
import { mapResolverResultToValidateCodeResponse } from '../../discount-engine/resolver/resolver-result-mappers';
import type { CartLineItem } from '../../utils/vendor-promotion-engine';
import {
  evaluatePromotionDiscount,
  normalizePromotionRow,
} from '../../utils/vendor-promotion-engine';
import {
  evaluateServicePromotionDiscount,
  normalizeServicePromotionRow,
  type ServicePromotionRow,
} from '../../utils/service-promotion-engine';
import { validateCouponForAmount } from './platform-coupon-service';

export type ValidateCodeRequest = {
  code: string;
  vendorId?: string;
  orderAmount?: number;
  bookingAmount?: number;
  orderType?: string;
  customerId?: string;
  items?: Record<string, unknown>[];
};

export type ValidateCodeLegacyResult =
  | { handled: false }
  | { handled: true; status: number; body: Record<string, unknown> };

function lineSubtotal(req: ValidateCodeRequest, cartLines: CartLineItem[]): number {
  if (cartLines.length) {
    return cartLines.reduce((s, i) => s + i.price * i.quantity, 0);
  }
  return req.orderAmount || req.bookingAmount || 0;
}

/**
 * Attempt validate-code through production resolver mode.
 * Returns handled:false when legacy handler should continue (OFF mode uses legacy-only via resolveWithProductionMode internal legacy).
 */
export async function validatePromotionCodeWithProductionMode(
  req: ValidateCodeRequest,
  legacyHandler: () => Promise<ValidateCodeLegacyResult>
): Promise<ValidateCodeLegacyResult> {
  const code = String(req.code || '').trim();
  if (!code) {
    return { handled: true, status: 400, body: { valid: false, message: 'Coupon code is required' } };
  }

  const cartLines: CartLineItem[] = Array.isArray(req.items)
    ? req.items.map((item) => ({
        productId: String(item.productId || item.product_id || item.id || ''),
        quantity: parseInt(String(item.quantity ?? 1), 10) || 1,
        price: parseFloat(String(item.price ?? item.unitPrice ?? 0)) || 0,
        category: item.categoryId || item.category ? String(item.categoryId || item.category) : undefined,
        categoryId: item.categoryId || item.category ? String(item.categoryId || item.category) : undefined,
      }))
    : [];

  const amount = lineSubtotal(req, cartLines);
  const domain =
    req.orderType === 'service' ? DiscountDomain.SERVICE : DiscountDomain.ECOMMERCE;

  const { value } = await resolveWithProductionMode({
    label: 'validate-code',
    context: {
      domain,
      trigger: DiscountTrigger.CODE,
      vendorId: req.vendorId ? String(req.vendorId) : undefined,
      customerId: req.customerId ? String(req.customerId) : undefined,
      amount,
      couponCode: code.toUpperCase(),
      items: cartLinesToDiscountContextItems(cartLines),
    },
    legacy: async () => {
      const legacy = await legacyHandler();
      if (legacy.handled) return legacy.body;
      return { valid: false, message: 'Promotion code not found' };
    },
    mapResolverToLegacy: (result) => {
      const mapped = mapResolverResultToValidateCodeResponse(result);
      if (!mapped.valid) {
        return { valid: false, message: 'Promotion code not applicable' };
      }
      return {
        valid: true,
        discount_amount: mapped.discount_amount,
        final_amount: mapped.final_amount,
        promo_category: mapped.promo_category,
        promotion_id: mapped.promotion_id,
      };
    },
  });

  if (value && (value as { valid?: boolean }).valid === false && (value as { message?: string }).message === 'Promotion code not found') {
    return { handled: false };
  }

  return { handled: true, status: 200, body: value as Record<string, unknown> };
}

/** S3 — service vendor coded promo via resolver (used inside legacy handler branches). */
export async function evaluateServiceCodeViaProductionMode(
  promo: ServicePromotionRow,
  amount: number,
  options: { vendorId?: string; customerId?: string; serviceIds?: string[] }
): Promise<{ discountAmount: number; finalAmount: number }> {
  const legacyDiscount = () => {
    const evaluation = evaluateServicePromotionDiscount(promo, {
      vendorId: options.vendorId,
      customerId: options.customerId,
      serviceIds: options.serviceIds ?? [],
      bookingAmount: amount,
    });
    const discountAmount = evaluation?.discountAmount ?? 0;
    return {
      discountAmount,
      finalAmount: Math.max(0, amount - discountAmount),
    };
  };

  const { value } = await resolveWithProductionMode({
    label: 'validate-code-service-vendor',
    context: vendorServiceCodeToDiscountContext(promo, amount, options),
    legacy: legacyDiscount,
    mapResolverToLegacy: (result) => ({
      discountAmount: result.totalSavings,
      finalAmount: result.finalAmount,
    }),
  });

  return value;
}

/** E6 — platform coupon on ecommerce order/cart when vendor promo not matched. */
export async function resolveEcommercePlatformCoupon(
  couponCode: string,
  amount: number
): Promise<{ discountAmount: number; couponId?: string } | null> {
  const validation = await validateCouponForAmount(
    couponCode,
    amount,
    DiscountDomain.ECOMMERCE
  );
  if (!validation.valid || !validation.discountAmount) return null;
  return {
    discountAmount: validation.discountAmount,
    couponId: validation.couponId,
  };
}

/** Product vendor code evaluation via resolver. */
export async function evaluateProductCodeViaProductionMode(
  promo: ReturnType<typeof normalizePromotionRow>,
  cartLines: CartLineItem[],
  ctx: Parameters<typeof evaluatePromotionDiscount>[2]
): Promise<ReturnType<typeof evaluatePromotionDiscount>> {
  const legacy = () => evaluatePromotionDiscount(promo, cartLines, ctx);

  const { value } = await resolveWithProductionMode({
    label: 'validate-code-product-vendor',
    context: vendorPromoEvaluateToDiscountContext(promo, cartLines, {
      ...ctx,
      manualCode: promo.code ?? undefined,
    }),
    legacy,
    mapResolverToLegacy: (result) => {
      if (result.totalSavings <= 0) return null;
      const applied = result.applied[0];
      if (!applied) return null;
      return {
        discountAmount: result.totalSavings,
        promotionId: applied.id,
        promotionType: applied.benefitType ?? promo.promotion_type,
        label: applied.name,
        description: applied.name,
        affectedProductIds: [],
        autoApplyEligible: false,
        promotion: promo,
      };
    },
  });

  return value;
}

/** Platform promotion code via resolver. */
export async function evaluatePlatformCodeViaProductionMode(
  promo: Record<string, unknown>,
  amount: number,
  domain: DiscountDomain,
  options?: { vendorId?: string; customerId?: string }
): Promise<{ discountAmount: number; finalAmount: number }> {
  const legacyDiscount = () => {
    let discountAmount = 0;
    const discountType = String(promo.discount_type ?? 'percentage');
    const discountValue = parseFloat(String(promo.discount_value ?? 0));
    if (discountType === 'percentage') {
      discountAmount = (amount * discountValue) / 100;
      if (promo.max_discount_amount) {
        discountAmount = Math.min(discountAmount, parseFloat(String(promo.max_discount_amount)));
      }
    } else {
      discountAmount = discountValue;
    }
    return { discountAmount, finalAmount: Math.max(0, amount - discountAmount) };
  };

  const { value } = await resolveWithProductionMode({
    label: 'validate-code-platform',
    context: platformPromotionCodeToDiscountContext(promo, amount, {
      domain,
      vendorId: options?.vendorId,
      customerId: options?.customerId,
    }),
    legacy: legacyDiscount,
    mapResolverToLegacy: (result) => ({
      discountAmount: result.totalSavings,
      finalAmount: result.finalAmount,
    }),
  });

  return value;
}

export { normalizeServicePromotionRow };
