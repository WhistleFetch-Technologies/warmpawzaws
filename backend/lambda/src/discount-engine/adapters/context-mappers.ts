import type { ResolveBookingPromotionsParams } from '../../lib/services/booking-promotion-service';
import type { CartLineItem, EvaluateContext, PromotionRow } from '../../utils/vendor-promotion-engine';
import type { ServiceEvaluateContext, ServicePromotionRow } from '../../utils/service-promotion-engine';
import { DiscountDomain } from '../enums/discount-domain';
import type { DiscountContext, DiscountContextItem } from '../models/discount-context';
import type { AppliedDiscount, DiscountEngineResult } from '../models/discount-result';
import { DiscountOwner } from '../enums/discount-owner';
import { DiscountTrigger } from '../enums/discount-trigger';
import type { DiscountResult as LegacyServiceDiscountResult } from '../../lib/services/discount-calculation-service';
import {
  METADATA_COUPON_USAGE_COUNT,
  METADATA_EVALUATION_MODE,
  METADATA_PRELOADED_ROWS,
  METADATA_PRIOR_VENDOR_BOOKING_COUNT,
} from '../resolver/context-runtime';

export const METADATA_PROMOTION_ROWS = 'promotionRows';
/** Precomputed audience count — same responsibility as ads-recommendations before calculate. */
export const METADATA_PRIOR_VENDOR_ORDER_COUNT = 'priorVendorOrderCount';

/**
 * Normalized booking calculate request (POST /promotions/calculate-booking body shape).
 * Snake_case aliases are accepted at parse time only.
 */
export type LegacyBookingCalculateRequest = {
  vendorId: string;
  amount: number;
  serviceIds: string[];
  customerId?: string;
  serviceCategory?: string;
  serviceStyle?: string;
  bookingId?: string;
};

export function parseLegacyBookingCalculateRequest(
  body: Record<string, unknown>
): LegacyBookingCalculateRequest {
  const vendorId = String(body.vendorId || body.vendor_id || '').trim();
  const amount = parseFloat(String(body.amount ?? body.bookingAmount ?? 0)) || 0;
  const serviceStyle = body.serviceStyle ?? body.service_style;
  const customerId = body.customerId ?? body.customer_id;
  const serviceCategory =
    body.serviceCategory ?? body.service_category ?? body.category;
  const serviceIdsRaw = body.serviceIds ?? body.service_ids ?? body.selectedServiceIds;
  const serviceIds = Array.isArray(serviceIdsRaw)
    ? serviceIdsRaw.map((x) => String(x)).filter(Boolean)
    : body.serviceId || body.service_id
      ? [String(body.serviceId || body.service_id)]
      : [];
  const bookingId = body.bookingId ?? body.booking_id;

  return {
    vendorId,
    amount,
    serviceIds,
    customerId: customerId != null ? String(customerId) : undefined,
    serviceCategory: serviceCategory != null ? String(serviceCategory) : undefined,
    serviceStyle: serviceStyle != null ? String(serviceStyle) : undefined,
    bookingId: bookingId != null ? String(bookingId) : undefined,
  };
}

export function bookingCalculateRequestToDiscountContext(
  request: LegacyBookingCalculateRequest,
  options?: { trigger?: DiscountTrigger; couponCode?: string }
): DiscountContext {
  return {
    domain: DiscountDomain.SERVICE,
    trigger: options?.trigger ?? DiscountTrigger.AUTO,
    vendorId: request.vendorId,
    customerId: request.customerId,
    amount: request.amount,
    couponCode: options?.couponCode,
    booking: {
      bookingId: request.bookingId,
      serviceIds: request.serviceIds,
      serviceCategory: request.serviceCategory,
      serviceStyle: request.serviceStyle,
    },
  };
}

export function resolveBookingParamsToDiscountContext(
  params: ResolveBookingPromotionsParams,
  options?: {
    trigger?: DiscountTrigger;
    couponCode?: string;
    bookingId?: string;
    owner?: DiscountOwner;
    metadata?: Record<string, unknown>;
  }
): DiscountContext {
  const ctx = bookingCalculateRequestToDiscountContext(
    {
      vendorId: params.vendorId,
      amount: params.amount,
      serviceIds: params.serviceIds,
      customerId: params.customerId,
      serviceCategory: params.serviceCategory,
      serviceStyle: params.serviceStyle,
      bookingId: options?.bookingId,
    },
    { trigger: options?.trigger, couponCode: options?.couponCode }
  );
  return {
    ...ctx,
    owner: options?.owner,
    metadata: { ...ctx.metadata, ...options?.metadata },
  };
}

export function discountContextToResolveBookingParams(
  context: DiscountContext
): ResolveBookingPromotionsParams {
  const serviceIds =
    context.booking?.serviceIds ??
    context.items?.map((i) => i.serviceId).filter((id): id is string => Boolean(id)) ??
    [];

  return {
    vendorId: context.vendorId ?? '',
    serviceIds,
    amount: context.amount,
    customerId: context.customerId,
    serviceCategory: context.booking?.serviceCategory,
    serviceStyle: context.booking?.serviceStyle,
  };
}

export function cartLinesToDiscountContextItems(items: CartLineItem[]): DiscountContextItem[] {
  return items.map((item) => ({
    id: item.productId,
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.price,
    categoryId: item.categoryId ?? item.category,
  }));
}

export function vendorPromoEvaluateToDiscountContext(
  promo: PromotionRow,
  items: CartLineItem[],
  ctx: EvaluateContext = {}
): DiscountContext {
  const trigger =
    ctx.manualCode || promo.code ? DiscountTrigger.CODE : DiscountTrigger.AUTO;
  return {
    domain: DiscountDomain.ECOMMERCE,
    trigger,
    vendorId: ctx.vendorId ?? promo.vendor_id,
    customerId: ctx.customerId,
    amount: items.reduce((s, i) => s + i.price * i.quantity, 0),
    couponCode: ctx.manualCode ?? promo.code ?? undefined,
    items: cartLinesToDiscountContextItems(items),
    metadata: {
      [METADATA_PRIOR_VENDOR_ORDER_COUNT]: ctx.priorVendorOrderCount,
      [METADATA_EVALUATION_MODE]: 'full',
      [METADATA_PRELOADED_ROWS]: [promo],
    },
  };
}

export function vendorCartPromotionsToDiscountContext(
  promotions: PromotionRow[],
  items: CartLineItem[],
  ctx: EvaluateContext = {}
): DiscountContext {
  const originalTotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  return {
    domain: DiscountDomain.ECOMMERCE,
    trigger: ctx.manualCode ? DiscountTrigger.CODE : DiscountTrigger.AUTO,
    vendorId: ctx.vendorId,
    customerId: ctx.customerId,
    amount: originalTotal,
    couponCode: ctx.manualCode,
    items: cartLinesToDiscountContextItems(items),
    metadata: {
      [METADATA_PRIOR_VENDOR_ORDER_COUNT]: ctx.priorVendorOrderCount,
      [METADATA_EVALUATION_MODE]: 'full',
      [METADATA_PRELOADED_ROWS]: promotions,
    },
  };
}

export function servicePromotionEvaluateToDiscountContext(
  promo: ServicePromotionRow,
  ctx: ServiceEvaluateContext
): DiscountContext {
  return {
    domain: DiscountDomain.SERVICE,
    trigger: promo.code ? DiscountTrigger.CODE : DiscountTrigger.AUTO,
    vendorId: ctx.vendorId ?? promo.vendor_id,
    customerId: ctx.customerId,
    amount: ctx.bookingAmount,
    couponCode: promo.code ?? undefined,
    booking: {
      serviceIds: ctx.serviceIds,
      serviceStyle: ctx.serviceStyle,
    },
    metadata: {
      [METADATA_PRIOR_VENDOR_BOOKING_COUNT]: ctx.priorVendorBookingCount,
      [METADATA_EVALUATION_MODE]: 'full',
      [METADATA_PRELOADED_ROWS]: [promo],
    },
  };
}

export function couponValidateToDiscountContext(
  coupon: Record<string, unknown>,
  amount: number,
  options?: { domain?: DiscountDomain; usageCount?: number }
): DiscountContext {
  return {
    domain: options?.domain ?? DiscountDomain.ECOMMERCE,
    trigger: DiscountTrigger.CODE,
    owner: DiscountOwner.PLATFORM,
    amount,
    couponCode: String(coupon.code ?? ''),
    metadata: {
      [METADATA_COUPON_USAGE_COUNT]: options?.usageCount,
      [METADATA_PRELOADED_ROWS]: [coupon],
    },
  };
}

export function platformPromotionCodeToDiscountContext(
  promo: Record<string, unknown>,
  amount: number,
  options?: { domain?: DiscountDomain; vendorId?: string; customerId?: string }
): DiscountContext {
  return {
    domain: options?.domain ?? DiscountDomain.ECOMMERCE,
    trigger: DiscountTrigger.CODE,
    owner: DiscountOwner.PLATFORM,
    vendorId: options?.vendorId,
    customerId: options?.customerId,
    amount,
    couponCode: String(promo.code ?? ''),
    metadata: {
      [METADATA_PRELOADED_ROWS]: [promo],
    },
  };
}

export function vendorServiceCodeToDiscountContext(
  promo: ServicePromotionRow,
  amount: number,
  options?: { vendorId?: string; customerId?: string; serviceIds?: string[] }
): DiscountContext {
  return {
    domain: DiscountDomain.SERVICE,
    trigger: DiscountTrigger.CODE,
    owner: DiscountOwner.VENDOR,
    vendorId: options?.vendorId ?? promo.vendor_id,
    customerId: options?.customerId,
    amount,
    couponCode: promo.code ?? undefined,
    booking: {
      serviceIds: options?.serviceIds ?? [],
    },
    metadata: {
      [METADATA_PRELOADED_ROWS]: [promo],
    },
  };
}

export function contextItemsToCartLines(items: DiscountContextItem[]): CartLineItem[] {
  return items.map((item) => ({
    productId: item.productId ?? item.id,
    quantity: item.quantity,
    price: item.unitPrice,
    categoryId: item.categoryId ?? item.category,
  }));
}

export function serviceContextToLegacyParams(context: DiscountContext) {
  const booking = discountContextToResolveBookingParams(context);

  return {
    vendorId: booking.vendorId,
    serviceIds: booking.serviceIds,
    originalAmount: booking.amount,
    customerId: booking.customerId,
    couponCode: context.couponCode,
    serviceCategory: booking.serviceCategory,
    serviceStyle: booking.serviceStyle,
  };
}

export function ecommerceContextToLegacyEvaluateContext(
  context: DiscountContext
): EvaluateContext {
  const priorRaw = context.metadata?.[METADATA_PRIOR_VENDOR_ORDER_COUNT];
  const priorVendorOrderCount =
    typeof priorRaw === 'number' && Number.isFinite(priorRaw) ? priorRaw : undefined;

  return {
    vendorId: context.vendorId,
    customerId: context.customerId,
    priorVendorOrderCount,
    now: context.evaluatedAt,
    manualCode:
      context.trigger === DiscountTrigger.CODE ? context.couponCode : undefined,
  };
}

export function mapLegacyServiceResult(
  legacy: LegacyServiceDiscountResult,
  context: DiscountContext
): DiscountEngineResult {
  const applied: AppliedDiscount[] = legacy.appliedDiscounts.map((d) => ({
    id: d.id,
    name: d.name,
    owner: d.type === 'vendor' ? DiscountOwner.VENDOR : DiscountOwner.PLATFORM,
    trigger: d.type === 'coupon' ? DiscountTrigger.CODE : DiscountTrigger.AUTO,
    discountAmount: d.discountAmount,
    benefitType: d.discountType,
    order: d.order,
    legacySource: d.type,
    metadata: { discountValue: d.discountValue },
  }));

  const benefits = applied.map((a) => ({
    type: a.benefitType ?? 'unknown',
    amount: a.discountAmount,
    description: a.name,
  }));

  return {
    originalAmount: legacy.originalAmount,
    totalSavings: legacy.totalDiscountAmount,
    finalAmount: legacy.finalAmount,
    applied,
    benefits,
    messages: [],
    warnings: [],
    metadata: {
      domain: context.domain,
      vendorDiscountAmount: legacy.vendorDiscountAmount,
      platformDiscountAmount: legacy.platformDiscountAmount,
      couponDiscountAmount: legacy.couponDiscountAmount,
      adapter: 'legacy-service-discount-calculator',
    },
  };
}

export function isServiceDomain(context: DiscountContext): boolean {
  return context.domain === DiscountDomain.SERVICE;
}

export function isEcommerceDomain(context: DiscountContext): boolean {
  return context.domain === DiscountDomain.ECOMMERCE;
}
