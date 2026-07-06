/**
 * Maps business-friendly Policy Center rules ↔ stack/priority/limits engine config.
 */
import { clonePolicyBundle } from './default-config';
import {
  buildDefaultCombinationMatrix,
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
} from './business-rules-types';
import type { DiscountPolicyBundle, StackRuleConfig } from './types';

export const DEFAULT_BUSINESS_RULES: BusinessRulesConfiguration = {
  version: '1.0.0',
  applicationStrategy: 'BEST_OFFER_ONLY',
  winningStrategy: 'MAX_CUSTOMER_SAVINGS',
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

function applyMatrixToStackFlags(
  bundle: DiscountPolicyBundle,
  matrix: OfferCombinationRule[]
): void {
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
    stack.global.allowCouponWithPromotion ||
    stack.global.allowPlatformWithVendor ||
    stack.global.allowMultipleCoupons
  ) {
    return 'STACK_ELIGIBLE';
  }
  if (stack.global.stackRules.length > 0) return 'CUSTOM_RULES';
  return 'BEST_OFFER_ONLY';
}

export function ensureBusinessRules(bundle: DiscountPolicyBundle): BusinessRulesConfiguration {
  if (bundle.businessRules) {
    const matrix = mergeCombinationMatrix(
      buildDefaultCombinationMatrix(bundle.businessRules.offerTypes),
      bundle.businessRules.combinationMatrix
    );
    return { ...bundle.businessRules, combinationMatrix: matrix };
  }

  const strategy = inferApplicationStrategy(bundle);
  const winningStrategy =
    PRIORITY_TO_WINNING[bundle.priority.global.strategy] ?? 'MAX_CUSTOMER_SAVINGS';

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
  const next = clonePolicyBundle(bundle);
  next.businessRules = { ...rules };

  if (rules.applicationStrategy === 'BEST_OFFER_ONLY') {
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

    const winning = rules.winningStrategy ?? 'MAX_CUSTOMER_SAVINGS';
    next.priority.global.strategy = WINNING_TO_PRIORITY[winning];

    if (winning === 'CUSTOM_PRIORITY') {
      next.priority.global.manualOrder = [...rules.customPriorityOrder];
      next.stack.global.stackOrder = [...rules.customPriorityOrder];
    } else {
      next.stack.global.stackOrder = [...rules.customPriorityOrder];
    }

    const blockedMatrix = rules.combinationMatrix.map((r) => ({ ...r, allowed: false }));
    next.stack.global.stackRules = matrixToStackRules(blockedMatrix);
    next.businessRules.combinationMatrix = blockedMatrix;
  } else if (rules.applicationStrategy === 'STACK_ELIGIBLE') {
    next.limits.global.maxTotalDiscounts = Math.max(next.limits.global.maxTotalDiscounts, 3);
    next.priority.global.phases = {
      AUTO_PROMOTIONS: { maxSelected: 2 },
      COUPONS: { maxSelected: 2 },
    };
    applyMatrixToStackFlags(next, rules.combinationMatrix);
    next.limits.global.maxCoupons = next.stack.global.allowMultipleCoupons ? 2 : 1;
    next.stack.global.stackOrder = [...rules.customPriorityOrder];
  }

  return next;
}

export function patchBusinessRules(
  bundle: DiscountPolicyBundle,
  patch: Partial<BusinessRulesConfiguration>
): DiscountPolicyBundle {
  const current = ensureBusinessRules(bundle);
  const merged: BusinessRulesConfiguration = {
    ...current,
    ...patch,
    combinationMatrix: patch.combinationMatrix ?? current.combinationMatrix,
    customPriorityOrder: patch.customPriorityOrder ?? current.customPriorityOrder,
    offerTypes: patch.offerTypes ?? current.offerTypes,
  };
  return syncBusinessRulesToEngine(bundle, merged);
}

export function getApplicationStrategyLabel(strategy: DiscountApplicationStrategy): string {
  const labels: Record<DiscountApplicationStrategy, string> = {
    BEST_OFFER_ONLY: 'Apply Best Offer Only',
    STACK_ELIGIBLE: 'Stack Eligible Offers',
    CUSTOM_RULES: 'Custom Rules',
  };
  return labels[strategy];
}

export function getWinningStrategyLabel(strategy: WinningStrategyKey): string {
  const labels: Record<WinningStrategyKey, string> = {
    MAX_CUSTOMER_SAVINGS: 'Maximum Customer Savings',
    HIGHEST_PRIORITY: 'Highest Priority',
    LOWEST_PLATFORM_COST: 'Lowest Platform Cost',
    VENDOR_PREFERRED: 'Vendor Preferred',
    CUSTOM_PRIORITY: 'Custom Priority',
  };
  return labels[strategy];
}
