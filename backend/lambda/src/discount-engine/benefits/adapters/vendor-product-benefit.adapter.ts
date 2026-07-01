import type { CartLineItem } from '../../../utils/vendor-promotion-engine';
import { DiscountDomain } from '../../enums/discount-domain';
import { DiscountOwner } from '../../enums/discount-owner';
import { buildRuntimeBenefitCandidate } from '../../candidates/runtime-candidate';
import { computeBenefitFromCandidate } from '../../candidates/bridges/candidate-to-benefit-context';
import type { BenefitLineItem } from '../types';
import { BOGO_BENEFIT_TYPE, BUNDLE_BENEFIT_TYPE } from '../strategies';

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
  const candidate = buildRuntimeBenefitCandidate({
    domain: DiscountDomain.ECOMMERCE,
    owner: DiscountOwner.VENDOR,
    benefits: {
      type: 'flash_sale',
      discountType: params.discountType === 'percentage' ? 'percentage' : 'fixed',
      value: params.discountValue,
      maxDiscount: params.maxDiscountAmount,
    },
  });
  return computeBenefitFromCandidate(candidate, {
    originalAmount: params.originalAmount,
    currentAmount: params.applicableTotal,
    eligibleAmount: params.applicableTotal,
    legacyAmount: params.legacyAmount,
    label: 'vendor-product-standard',
  });
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
  const candidate = buildRuntimeBenefitCandidate({
    domain: DiscountDomain.ECOMMERCE,
    owner: DiscountOwner.VENDOR,
    benefits: {
      type: BOGO_BENEFIT_TYPE,
      value: 0,
      buyQuantity: params.buyQuantity,
      getQuantity: params.getQuantity,
      getDiscountPercent: params.getDiscountPercent,
      maxDiscount: params.maxDiscountAmount,
    },
  });
  return computeBenefitFromCandidate(candidate, {
    originalAmount: params.originalAmount,
    currentAmount: params.originalAmount,
    items: toBenefitItems(params.items),
    legacyAmount: params.legacyAmount,
    label: 'vendor-product-bogo',
  });
}

export function computeVendorBundleDiscountAmount(params: {
  items: CartLineItem[];
  bundleProductIds: string[];
  bundleDiscountPercent?: number | null;
  maxDiscountAmount?: number | null;
  originalAmount: number;
  legacyAmount: number;
}): number {
  const candidate = buildRuntimeBenefitCandidate({
    domain: DiscountDomain.ECOMMERCE,
    owner: DiscountOwner.VENDOR,
    benefits: {
      type: BUNDLE_BENEFIT_TYPE,
      value: params.bundleDiscountPercent ?? 15,
      bundleProductIds: params.bundleProductIds,
      bundleDiscountPercent: params.bundleDiscountPercent,
      maxDiscount: params.maxDiscountAmount,
    },
  });
  return computeBenefitFromCandidate(candidate, {
    originalAmount: params.originalAmount,
    currentAmount: params.originalAmount,
    items: toBenefitItems(params.items),
    legacyAmount: params.legacyAmount,
    label: 'vendor-product-bundle',
  });
}
