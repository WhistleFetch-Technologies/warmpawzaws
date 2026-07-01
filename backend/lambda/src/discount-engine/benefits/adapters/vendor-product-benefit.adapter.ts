import type { CartLineItem } from '../../../utils/vendor-promotion-engine';
import { getBenefitCalculator } from '../benefit-calculator';
import { resolveDiscountWithLegacyFallback } from '../compare';
import type { BenefitContext, BenefitLineItem } from '../types';
import {
  BOGO_BENEFIT_TYPE,
  BUNDLE_BENEFIT_TYPE,
  FLAT_BENEFIT_TYPE,
  PERCENTAGE_BENEFIT_TYPE,
} from '../strategies';

function toBenefitItems(items: CartLineItem[]): BenefitLineItem[] {
  return items.map((i) => ({
    id: i.id,
    productId: i.productId ?? i.id,
    quantity: i.quantity,
    unitPrice: i.price,
  }));
}

export function computeVendorStandardDiscountAmount(params: {
  discountType: string;
  discountValue: number;
  applicableTotal: number;
  maxDiscountAmount?: number | null;
  originalAmount: number;
  legacyAmount: number;
}): number {
  const ctx: BenefitContext = {
    originalAmount: params.originalAmount,
    currentAmount: params.applicableTotal,
    eligibleAmount: params.applicableTotal,
    discountType: params.discountType === 'percentage' ? 'percentage' : 'fixed',
    discountValue: params.discountValue,
    maxDiscount: params.maxDiscountAmount,
  };
  const result = getBenefitCalculator().calculate(ctx);
  return resolveDiscountWithLegacyFallback(
    'vendor-product-standard',
    params.legacyAmount,
    result.discountAmount
  );
}

export function computeVendorBogoDiscountAmount(params: {
  items: CartLineItem[];
  buyQuantity?: number | null;
  getQuantity?: number | null;
  getDiscountPercent?: number | null;
  maxDiscountAmount?: number | null;
  originalAmount: number;
  legacyAmount: number;
}): number {
  const ctx: BenefitContext = {
    originalAmount: params.originalAmount,
    currentAmount: params.originalAmount,
    items: toBenefitItems(params.items),
    benefitType: BOGO_BENEFIT_TYPE,
    promotionType: BOGO_BENEFIT_TYPE,
    buyQuantity: params.buyQuantity ?? undefined,
    getQuantity: params.getQuantity ?? undefined,
    getDiscountPercent: params.getDiscountPercent ?? undefined,
    maxDiscount: params.maxDiscountAmount,
  };
  const result = getBenefitCalculator().calculateWithStrategy(ctx, BOGO_BENEFIT_TYPE);
  return resolveDiscountWithLegacyFallback(
    'vendor-product-bogo',
    params.legacyAmount,
    result.discountAmount
  );
}

export function computeVendorBundleDiscountAmount(params: {
  items: CartLineItem[];
  bundleProductIds: string[];
  bundleDiscountPercent?: number | null;
  maxDiscountAmount?: number | null;
  originalAmount: number;
  legacyAmount: number;
}): number {
  const ctx: BenefitContext = {
    originalAmount: params.originalAmount,
    currentAmount: params.originalAmount,
    items: toBenefitItems(params.items),
    benefitType: BUNDLE_BENEFIT_TYPE,
    promotionType: BUNDLE_BENEFIT_TYPE,
    bundleProductIds: params.bundleProductIds,
    bundleDiscountPercent: params.bundleDiscountPercent ?? undefined,
    maxDiscount: params.maxDiscountAmount,
  };
  const result = getBenefitCalculator().calculateWithStrategy(ctx, BUNDLE_BENEFIT_TYPE);
  return resolveDiscountWithLegacyFallback(
    'vendor-product-bundle',
    params.legacyAmount,
    result.discountAmount
  );
}

export function computeCappedDiscountAmount(params: {
  rawAmount: number;
  maxDiscount?: number | null;
  maxBase: number;
  legacyAmount: number;
  label: string;
}): number {
  const ctx: BenefitContext = {
    originalAmount: params.maxBase,
    currentAmount: params.maxBase,
    eligibleAmount: params.maxBase,
    discountType: 'fixed',
    discountValue: params.rawAmount,
    maxDiscount: params.maxDiscount,
  };
  const result = getBenefitCalculator().calculateWithStrategy(ctx, FLAT_BENEFIT_TYPE);
  return resolveDiscountWithLegacyFallback(params.label, params.legacyAmount, result.discountAmount);
}

export { PERCENTAGE_BENEFIT_TYPE, FLAT_BENEFIT_TYPE };
