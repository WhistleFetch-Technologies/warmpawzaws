import type { DiscountContext, DiscountContextItem } from '../models/discount-context';
import { DiscountDomain } from '../enums/discount-domain';
import { DiscountTrigger } from '../enums/discount-trigger';
import type { CandidateLoadContext } from '../candidates/providers/types';
import type { CandidateRuleRuntimeContext } from '../candidates/bridges/candidate-to-rule-context';
import type { BenefitLineItem } from '../benefits/types';
import { contextItemsToCartLines } from '../adapters/context-mappers';

export const METADATA_PRELOADED_ROWS = 'preloadedRows';
export const METADATA_PRIOR_VENDOR_ORDER_COUNT = 'priorVendorOrderCount';
export const METADATA_PRIOR_VENDOR_BOOKING_COUNT = 'priorVendorBookingCount';
export const METADATA_COUPON_USAGE_COUNT = 'couponUsageCount';
export const METADATA_EVALUATION_MODE = 'evaluationMode';

export function discountContextToLoadContext(context: DiscountContext): CandidateLoadContext {
  const preloaded = context.metadata?.[METADATA_PRELOADED_ROWS];
  return {
    domain: context.domain,
    vendorId: context.vendorId,
    customerId: context.customerId,
    trigger: context.trigger,
    code: context.couponCode,
    serviceIds: context.booking?.serviceIds,
    serviceCategory: context.booking?.serviceCategory,
    serviceStyle: context.booking?.serviceStyle,
    amount: context.amount,
    preloadedRows: Array.isArray(preloaded) ? preloaded : undefined,
  };
}

function contextItemsToBenefitLines(items?: DiscountContextItem[]): BenefitLineItem[] | undefined {
  if (!items?.length) return undefined;
  return items.map((item) => ({
    id: item.id,
    productId: item.productId ?? item.id,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  }));
}

export function discountContextToRuleRuntime(context: DiscountContext): CandidateRuleRuntimeContext {
  const priorOrder = context.metadata?.[METADATA_PRIOR_VENDOR_ORDER_COUNT];
  const priorBooking = context.metadata?.[METADATA_PRIOR_VENDOR_BOOKING_COUNT];
  const couponUsage = context.metadata?.[METADATA_COUPON_USAGE_COUNT];
  const evalMode = context.metadata?.[METADATA_EVALUATION_MODE];
  const items = context.items?.length ? contextItemsToCartLines(context.items) : undefined;

  return {
    now: context.evaluatedAt,
    customerId: context.customerId,
    contextVendorId: context.vendorId,
    amount: context.amount,
    priorVendorOrderCount:
      typeof priorOrder === 'number' && Number.isFinite(priorOrder) ? priorOrder : undefined,
    priorVendorBookingCount:
      typeof priorBooking === 'number' && Number.isFinite(priorBooking) ? priorBooking : undefined,
    serviceIds: context.booking?.serviceIds,
    serviceStyle: context.booking?.serviceStyle,
    serviceCategory: context.booking?.serviceCategory,
    items,
    manualCode: context.trigger === DiscountTrigger.CODE ? context.couponCode : undefined,
    couponUsageCount:
      typeof couponUsage === 'number' && Number.isFinite(couponUsage) ? couponUsage : undefined,
    evaluationMode:
      evalMode === 'base' || evalMode === 'full'
        ? evalMode
        : items?.length
          ? 'full'
          : 'base',
    platformMatchParams:
      context.domain === DiscountDomain.SERVICE
        ? {
            category: context.booking?.serviceCategory,
            serviceStyle: context.booking?.serviceStyle,
            serviceIds: context.booking?.serviceIds ?? [],
            amount: context.amount,
          }
        : undefined,
  };
}

export function discountContextToBenefitRuntime(context: DiscountContext): {
  originalAmount: number;
  currentAmount: number;
  items?: BenefitLineItem[];
} {
  return {
    originalAmount: context.amount,
    currentAmount: context.amount,
    items: contextItemsToBenefitLines(context.items),
  };
}
