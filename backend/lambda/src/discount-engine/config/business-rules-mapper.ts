/**
 * Maps business-friendly Policy Center rules ↔ stack/priority/limits engine config.
 */
import {
  buildDefaultCombinationMatrix,
  buildPromotionPlusCouponMatrix,
  mergeCombinationMatrix,
} from './business-rules-matrix';
import type {
  BusinessRulesConfiguration,
  DiscountApplicationStrategy,
  OfferCombinationRule,
  WinningStrategyKey,
} from './business-rules-types';
import {
  DEFAULT_OFFER_TYPES,
  PRIORITY_TO_WINNING,
  WINNING_TO_PRIORITY,
  normalizeApplicationStrategy,
  normalizeWinningStrategy,
} from './business-rules-types';
import type {
  FundingConfiguration,
  LimitConfiguration,
  PriorityConfiguration,
  StackPolicyConfiguration,
  StackRuleConfig,
} from './types';

export interface DiscountPolicyBundle {
  priority: PriorityConfiguration;
  stack: StackPolicyConfiguration;
  funding: FundingConfiguration;
  limits: LimitConfiguration;
  businessRules?: BusinessRulesConfiguration;
}

export const DEFAULT_BUSINESS_RULES: BusinessRulesConfiguration = {
  version: '2.0.0',
  applicationStrategy: 'BEST_OFFER_ONLY',
  winningStrategy: 'HIGHEST_CUSTOMER_SAVINGS',
  customPriorityOrder: DEFAULT_OFFER_TYPES.map((o) => o.key),
  combinationMatrix: buildDefaultCombinationMatrix(),
  offerTypes: [...DEFAULT_OFFER_TYPES],
};

function matrixPairAllowed(matrix: OfferCombinationRule[], left: string, right: string): boolean {
  const id = [left, right].sort().join('::');
  return matrix.find((r) => r.id === id)?.allowed ?? false;
}

function matrixToStackRules(matrix: OfferCombinationRule[]): StackRuleConfig[] {
  return matrix.map((rule) => ({
    id: rule.id,
    left: { source: rule.left },
    right: { source: rule.right },
    allowed: rule.allowed,
    reasonCode: rule.allowed ? 'MATRIX_ALLOWED' : 'MATRIX_BLOCKED',
  }));
}

function applyMatrixToStackFlags(bundle: DiscountPolicyBundle, matrix: OfferCombinationRule[]): void {
  const g = bundle.stack.global;
  g.allowPlatformWithVendor = matrixPairAllowed(
    matrix,
    'VENDOR_PROMOTION',
    'PLATFORM_PROMOTION'
  );
  g.allowMultipleCoupons = matrixPairAllowed(matrix, 'VENDOR_COUPON', 'PLATFORM_COUPON');
  g.allowMultipleVendorPromotions = false;

  const promoCouponAllowed =
    matrixPairAllowed(matrix, 'VENDOR_PROMOTION', 'VENDOR_COUPON') ||
    matrixPairAllowed(matrix, 'VENDOR_PROMOTION', 'PLATFORM_COUPON') ||
    matrixPairAllowed(matrix, 'PLATFORM_PROMOTION', 'VENDOR_COUPON') ||
    matrixPairAllowed(matrix, 'PLATFORM_PROMOTION', 'PLATFORM_COUPON');

  g.allowCouponWithPromotion = promoCouponAllowed;
  g.stackRules = matrixToStackRules(matrix);
}

function inferApplicationStrategy(bundle: DiscountPolicyBundle): DiscountApplicationStrategy {
  const { limits, stack } = bundle;
  if (limits.global.maxTotalDiscounts === 1) return 'BEST_OFFER_ONLY';
  if (
    stack.global.allowCouponWithPromotion &&
    !stack.global.allowPlatformWithVendor &&
    !stack.global.allowMultipleCoupons
  ) {
    return 'PROMOTION_PLUS_COUPON';
  }
  if (
    stack.global.allowCouponWithPromotion ||
    stack.global.allowPlatformWithVendor ||
    stack.global.allowMultipleCoupons
  ) {
    return 'STACK_ELIGIBLE';
  }
  if (stack.global.stackRules.length > 0) return 'FULLY_CONFIGURABLE';
  return 'BEST_OFFER_ONLY';
}

export function ensureBusinessRules(bundle: DiscountPolicyBundle): BusinessRulesConfiguration {
  if (bundle.businessRules) {
    const matrix = mergeCombinationMatrix(
      buildDefaultCombinationMatrix(bundle.businessRules.offerTypes),
      bundle.businessRules.combinationMatrix
    );
    return {
      ...bundle.businessRules,
      applicationStrategy: normalizeApplicationStrategy(bundle.businessRules.applicationStrategy),
      winningStrategy: bundle.businessRules.winningStrategy
        ? normalizeWinningStrategy(bundle.businessRules.winningStrategy)
        : undefined,
      combinationMatrix: matrix,
    };
  }

  const strategy = inferApplicationStrategy(bundle);
  const winningStrategy =
    PRIORITY_TO_WINNING[bundle.priority.global.strategy] ?? 'HIGHEST_CUSTOMER_SAVINGS';

  return {
    ...DEFAULT_BUSINESS_RULES,
    applicationStrategy: strategy,
    winningStrategy: strategy === 'BEST_OFFER_ONLY' ? winningStrategy : undefined,
    customPriorityOrder: bundle.priority.global.manualOrder?.length
      ? [...bundle.priority.global.manualOrder]
      : bundle.stack.global.stackOrder.length
        ? [...bundle.stack.global.stackOrder]
        : DEFAULT_BUSINESS_RULES.customPriorityOrder,
    combinationMatrix: mergeCombinationMatrix(
      buildDefaultCombinationMatrix(),
      bundle.stack.global.stackRules.map((r) => ({
        id: r.id,
        left: String(r.left.source),
        right: String(r.right.source),
        allowed: r.allowed,
      }))
    ),
    offerTypes: [...DEFAULT_OFFER_TYPES],
  };
}

export function syncBusinessRulesToEngine(
  bundle: DiscountPolicyBundle,
  rules: BusinessRulesConfiguration
): DiscountPolicyBundle {
  const next: DiscountPolicyBundle = JSON.parse(JSON.stringify(bundle));
  const normalizedRules: BusinessRulesConfiguration = {
    ...rules,
    applicationStrategy: normalizeApplicationStrategy(rules.applicationStrategy),
    winningStrategy: rules.winningStrategy
      ? normalizeWinningStrategy(rules.winningStrategy)
      : undefined,
  };
  next.businessRules = normalizedRules;

  const strategy = normalizedRules.applicationStrategy;

  if (strategy === 'BEST_OFFER_ONLY') {
    next.limits.global.maxTotalDiscounts = 1;
    next.limits.global.maxCoupons = 1;
    next.limits.global.maxAutoPromotions = 1;
    next.priority.global.phases = {
      AUTO_PROMOTIONS: { maxSelected: 1 },
      COUPONS: { maxSelected: 1 },
    };

    next.stack.global.allowCouponWithPromotion = false;
    next.stack.global.allowMultipleCoupons = false;
    next.stack.global.allowMultipleVendorPromotions = false;
    next.stack.global.allowPlatformWithVendor = false;
    next.stack.global.exclusiveSkipsCouponPhase = true;
    next.stack.global.exclusiveTerminatesAll = true;

    const winning = normalizedRules.winningStrategy ?? 'HIGHEST_CUSTOMER_SAVINGS';
    next.priority.global.strategy = WINNING_TO_PRIORITY[winning];

    if (winning === 'CUSTOM_PRIORITY') {
      next.priority.global.manualOrder = [...normalizedRules.customPriorityOrder];
      next.stack.global.stackOrder = [...normalizedRules.customPriorityOrder];
    } else {
      next.stack.global.stackOrder = [...normalizedRules.customPriorityOrder];
    }

    const blockedMatrix = normalizedRules.combinationMatrix.map((r) => ({ ...r, allowed: false }));
    next.stack.global.stackRules = matrixToStackRules(blockedMatrix);
    next.businessRules.combinationMatrix = blockedMatrix;
  } else if (strategy === 'PROMOTION_PLUS_COUPON') {
    const promoCouponMatrix = buildPromotionPlusCouponMatrix(normalizedRules.offerTypes);
    next.businessRules.combinationMatrix = promoCouponMatrix;
    next.limits.global.maxTotalDiscounts = 2;
    next.limits.global.maxCoupons = 1;
    next.limits.global.maxAutoPromotions = 1;
    next.priority.global.phases = {
      AUTO_PROMOTIONS: { maxSelected: 1 },
      COUPONS: { maxSelected: 1 },
    };
    applyMatrixToStackFlags(next, promoCouponMatrix);
    next.stack.global.stackOrder = [...normalizedRules.customPriorityOrder];
    next.stack.global.exclusiveSkipsCouponPhase = false;
  } else if (strategy === 'STACK_ELIGIBLE') {
    next.limits.global.maxTotalDiscounts = Math.max(next.limits.global.maxTotalDiscounts, 3);
    next.priority.global.phases = {
      AUTO_PROMOTIONS: { maxSelected: 2 },
      COUPONS: { maxSelected: 2 },
    };
    applyMatrixToStackFlags(next, normalizedRules.combinationMatrix);
    next.limits.global.maxCoupons = next.stack.global.allowMultipleCoupons ? 2 : 1;
    next.stack.global.stackOrder = [...normalizedRules.customPriorityOrder];
    next.stack.global.exclusiveSkipsCouponPhase = false;
  } else if (strategy === 'FULLY_CONFIGURABLE') {
    applyMatrixToStackFlags(next, normalizedRules.combinationMatrix);
    next.stack.global.stackOrder = [...normalizedRules.customPriorityOrder];
    next.stack.global.exclusiveSkipsCouponPhase = false;
  }

  return next;
}

export function buildDefaultPolicyBundle(): DiscountPolicyBundle {
  const base: DiscountPolicyBundle = {
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
  return syncBusinessRulesToEngine(base, DEFAULT_BUSINESS_RULES);
}
