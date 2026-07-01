import {
  calculateBestCartPromotion,
  type CartLineItem,
  type PromotionRow,
} from '../../utils/vendor-promotion-engine';
import type { DiscountCalculator } from '../contracts/discount-calculator';
import { DiscountOwner } from '../enums/discount-owner';
import { DiscountTrigger } from '../enums/discount-trigger';
import type { DiscountContext } from '../models/discount-context';
import type { AppliedDiscount, DiscountEngineResult } from '../models/discount-result';
import { emptyDiscountEngineResult } from '../models/discount-result';
import {
  contextItemsToCartLines,
  ecommerceContextToLegacyEvaluateContext,
  isEcommerceDomain,
  METADATA_PROMOTION_ROWS,
} from './context-mappers';

function resolveCartLines(context: DiscountContext): CartLineItem[] {
  const fromMetadata = context.metadata?.cartLines;
  if (Array.isArray(fromMetadata) && fromMetadata.length > 0) {
    return fromMetadata as CartLineItem[];
  }
  if (context.items?.length) {
    return contextItemsToCartLines(context.items);
  }
  return [];
}

function resolvePromotionRows(context: DiscountContext): PromotionRow[] {
  const rows = context.metadata?.[METADATA_PROMOTION_ROWS];
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows as PromotionRow[];
}

/**
 * Wraps vendor-promotion-engine.calculateBestCartPromotion for ecommerce carts.
 * Callers must preload promotion rows into context.metadata.promotionRows
 * (same responsibility as ads-recommendations / ecommerce endpoints today).
 */
export class LegacyEcommerceCartDiscountCalculatorAdapter implements DiscountCalculator {
  readonly name = 'legacy-ecommerce-cart-discount-calculator';

  supports(context: DiscountContext): boolean {
    return isEcommerceDomain(context);
  }

  calculate(context: DiscountContext): Promise<DiscountEngineResult> {
    if (!this.supports(context)) {
      return Promise.resolve({
        ...emptyDiscountEngineResult(context.amount),
        warnings: ['LegacyEcommerceCartDiscountCalculatorAdapter: unsupported context'],
      });
    }

    const items = resolveCartLines(context);
    const promotions = resolvePromotionRows(context);

    if (items.length === 0) {
      return Promise.resolve({
        ...emptyDiscountEngineResult(context.amount),
        warnings: ['No cart line items in DiscountContext'],
      });
    }

    if (promotions.length === 0) {
      return Promise.resolve({
        ...emptyDiscountEngineResult(context.amount),
        warnings: ['No promotion rows in context.metadata.promotionRows — load promos before calculate'],
      });
    }

    const legacy = calculateBestCartPromotion(
      promotions,
      items,
      ecommerceContextToLegacyEvaluateContext(context)
    );

    const applied: AppliedDiscount[] = [];
    if (legacy.bestPromotion) {
      const ev = legacy.bestPromotion;
      applied.push({
        id: ev.promotion.id,
        name: ev.promotion.name,
        owner: DiscountOwner.VENDOR,
        trigger: ev.promotion.code ? DiscountTrigger.CODE : DiscountTrigger.AUTO,
        discountAmount: ev.discountAmount,
        benefitType: ev.promotion.discount_type,
        order: 1,
        legacySource: 'vendor',
        metadata: {
          promotionType: ev.promotion.promotion_type,
          code: ev.promotion.code,
        },
      });
    }

    const benefits = applied.map((a) => ({
      type: a.benefitType ?? 'unknown',
      amount: a.discountAmount,
      description: a.name,
    }));

    return Promise.resolve({
      originalAmount: legacy.originalTotal,
      totalSavings: legacy.totalSavings,
      finalAmount: legacy.discountedTotal,
      applied,
      benefits,
      messages: [],
      warnings: [],
      metadata: {
        adapter: this.name,
        allPromotionCount: legacy.allPromotions.length,
      },
    });
  }
}

export function createLegacyEcommerceCartDiscountCalculator(): DiscountCalculator {
  return new LegacyEcommerceCartDiscountCalculatorAdapter();
}
