/**
 * Runtime contract defaults — aligned with discount-engine config loaders.
 * Used when policy HTTP APIs are unavailable (Phase 8 pending).
 */
import type { DiscountPolicyBundle } from './types';

export const CONTRACT_DEFAULT_POLICY: DiscountPolicyBundle = {
  priority: {
    version: '1.0.0',
    global: {
      strategy: 'MAX_CUSTOMER_SAVINGS',
      tieBreakers: ['EXCLUSIVE', 'SPOTLIGHT', 'PRIORITY_WEIGHT', 'VALID_FROM', 'ID'],
      phases: {
        AUTO_PROMOTIONS: { maxSelected: 2 },
        COUPONS: { maxSelected: 1 },
      },
    },
    domains: {
      SERVICE: {
        strategy: 'VENDOR_SPOTLIGHT_FIRST',
        phases: { AUTO_PROMOTIONS: { maxSelected: 2 }, COUPONS: { maxSelected: 1 } },
      },
      ECOMMERCE: {
        strategy: 'MAX_CUSTOMER_SAVINGS',
        phases: { AUTO_PROMOTIONS: { maxSelected: 1 }, COUPONS: { maxSelected: 1 } },
      },
    },
  },
  stack: {
    version: '1.0.0',
    global: {
      allowCouponWithPromotion: true,
      allowMultipleCoupons: false,
      allowMultipleVendorPromotions: false,
      allowPlatformWithVendor: true,
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
      SERVICE: { allowPlatformWithVendor: true },
      ECOMMERCE: { allowPlatformWithVendor: false },
    },
  },
  funding: {
    version: '1.0.0',
    sharedDefaultSplit: { platformPercent: 50, vendorPercent: 50 },
    stackVetoes: [],
    settlementHints: { roundTo: 2, currency: 'INR' },
    blockVendorFundedWithPlatformCoupon: false,
    blockSharedWithPlatformCoupon: false,
  },
  limits: {
    version: '1.0.0',
    global: {
      maxAutoPromotions: 2,
      maxVendorPromotions: 1,
      maxPlatformPromotions: 1,
      maxCoupons: 1,
      maxTotalDiscounts: 3,
      maxTotalDiscountPercent: 100,
      minPayableAmount: 1,
      capOverflowStrategy: 'REJECT_LAST',
    },
    domains: {
      SERVICE: { maxAutoPromotions: 2, maxCoupons: 1 },
      ECOMMERCE: { maxAutoPromotions: 1, maxCoupons: 1 },
    },
  },
};

export const DRAFT_STORAGE_KEY = 'warmpawz.discount-policy.draft.v1';

export function clonePolicyBundle(bundle: DiscountPolicyBundle): DiscountPolicyBundle {
  return JSON.parse(JSON.stringify(bundle)) as DiscountPolicyBundle;
}
