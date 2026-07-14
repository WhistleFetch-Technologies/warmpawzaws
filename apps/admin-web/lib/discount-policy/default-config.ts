/**
 * Runtime contract defaults — aligned with discount-engine config loaders (Policy Center V2).
 */
import { DEFAULT_BUSINESS_RULES, syncBusinessRulesToEngine } from './business-rules-mapper';
import type { DiscountPolicyBundle } from './types';

const BASE_POLICY: DiscountPolicyBundle = {
  priority: {
    version: '2.0.0',
    global: {
      strategy: 'MAX_CUSTOMER_SAVINGS',
      tieBreakers: ['EXCLUSIVE', 'SPOTLIGHT', 'PRIORITY_WEIGHT', 'VALID_FROM', 'ID'],
      phases: {
        AUTO_PROMOTIONS: { maxSelected: 1 },
        COUPONS: { maxSelected: 1 },
      },
    },
    domains: {
      SERVICE: {
        strategy: 'MAX_CUSTOMER_SAVINGS',
        phases: { AUTO_PROMOTIONS: { maxSelected: 1 }, COUPONS: { maxSelected: 1 } },
      },
      ECOMMERCE: {
        strategy: 'MAX_CUSTOMER_SAVINGS',
        phases: { AUTO_PROMOTIONS: { maxSelected: 1 }, COUPONS: { maxSelected: 1 } },
      },
    },
  },
  stack: {
    version: '2.0.0',
    global: {
      allowCouponWithPromotion: false,
      allowMultipleCoupons: false,
      allowMultipleVendorPromotions: false,
      allowPlatformWithVendor: false,
      applicationModeDefault: 'SEQUENTIAL',
      exclusiveSkipsCouponPhase: true,
      exclusiveTerminatesAll: true,
      stackOrder: [
        'VENDOR_PROMOTION',
        'PLATFORM_PROMOTION',
        'VENDOR_COUPON',
        'PLATFORM_COUPON',
      ],
      stackRules: [],
    },
    domains: {
      SERVICE: { allowPlatformWithVendor: false },
      ECOMMERCE: { allowPlatformWithVendor: false },
    },
  },
  funding: {
    version: '2.0.0',
    sharedDefaultSplit: { platformPercent: 50, vendorPercent: 50 },
    stackVetoes: [],
    settlementHints: { roundTo: 2, currency: 'INR' },
    blockVendorFundedWithPlatformCoupon: false,
    blockSharedWithPlatformCoupon: false,
  },
  limits: {
    version: '2.0.0',
    global: {
      maxAutoPromotions: 1,
      maxVendorPromotions: 1,
      maxPlatformPromotions: 1,
      maxCoupons: 1,
      maxTotalDiscounts: 1,
      maxTotalDiscountPercent: 100,
      minPayableAmount: 1,
      capOverflowStrategy: 'REJECT_LAST',
    },
    domains: {
      SERVICE: { maxAutoPromotions: 1, maxCoupons: 1 },
      ECOMMERCE: { maxAutoPromotions: 1, maxCoupons: 1 },
    },
  },
};

export const CONTRACT_DEFAULT_POLICY: DiscountPolicyBundle = syncBusinessRulesToEngine(
  BASE_POLICY,
  DEFAULT_BUSINESS_RULES
);

export const DRAFT_STORAGE_KEY = 'warmpawz.discount-policy.draft.v2';

export function clonePolicyBundle(bundle: DiscountPolicyBundle): DiscountPolicyBundle {
  return JSON.parse(JSON.stringify(bundle)) as DiscountPolicyBundle;
}
