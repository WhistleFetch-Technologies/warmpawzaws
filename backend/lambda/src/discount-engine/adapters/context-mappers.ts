import type { CartLineItem } from '../../utils/vendor-promotion-engine';
import { DiscountDomain } from '../enums/discount-domain';
import type { DiscountContext, DiscountContextItem } from '../models/discount-context';
import type { AppliedDiscount, DiscountEngineResult } from '../models/discount-result';
import { DiscountOwner } from '../enums/discount-owner';
import { DiscountTrigger } from '../enums/discount-trigger';
import type { DiscountResult as LegacyServiceDiscountResult } from '../../lib/services/discount-calculation-service';

export const METADATA_PROMOTION_ROWS = 'promotionRows';

export function contextItemsToCartLines(items: DiscountContextItem[]): CartLineItem[] {
  return items.map((item) => ({
    productId: item.productId ?? item.id,
    quantity: item.quantity,
    price: item.unitPrice,
    categoryId: item.categoryId ?? item.category,
  }));
}

export function serviceContextToLegacyParams(context: DiscountContext) {
  const serviceIds =
    context.booking?.serviceIds ??
    context.items?.map((i) => i.serviceId).filter((id): id is string => Boolean(id)) ??
    [];

  return {
    vendorId: context.vendorId ?? '',
    serviceIds,
    originalAmount: context.amount,
    customerId: context.customerId,
    couponCode: context.couponCode,
    serviceCategory: context.booking?.serviceCategory,
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
