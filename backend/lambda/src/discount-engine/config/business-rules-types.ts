/**
 * Business-friendly Policy Center rules — shared with admin-web layer.
 * Maps to StackPolicyConfiguration + PriorityConfiguration (no engine rewrite).
 */

export type DiscountApplicationStrategy =
  | 'BEST_OFFER_ONLY'
  | 'PROMOTION_PLUS_COUPON'
  | 'STACK_ELIGIBLE'
  | 'FULLY_CONFIGURABLE'
  /** @deprecated Use FULLY_CONFIGURABLE */
  | 'CUSTOM_RULES';

export type WinningStrategyKey =
  | 'HIGHEST_CUSTOMER_SAVINGS'
  /** @deprecated Use HIGHEST_CUSTOMER_SAVINGS */
  | 'MAX_CUSTOMER_SAVINGS'
  | 'HIGHEST_PRIORITY'
  | 'LOWEST_PLATFORM_COST'
  | 'VENDOR_PREFERRED'
  | 'CUSTOM_PRIORITY'
  /** @deprecated Use CUSTOM_PRIORITY */
  | 'CUSTOM_RULE';

export type PriorityStrategyKey =
  | 'MAX_CUSTOMER_SAVINGS'
  | 'VENDOR_SPOTLIGHT_FIRST'
  | 'FIXED_PRIORITY_WEIGHT'
  | 'LOWEST_PLATFORM_COST'
  | 'ADMIN_MANUAL_ORDER';

export interface OfferTypeDefinition {
  key: string;
  label: string;
  category: 'PROMOTION' | 'COUPON' | 'OTHER';
  funder: 'VENDOR' | 'PLATFORM' | 'SHARED';
}

export interface OfferCombinationRule {
  id: string;
  left: string;
  right: string;
  allowed: boolean;
}

export interface BusinessRulesConfiguration {
  version: string;
  applicationStrategy: DiscountApplicationStrategy;
  winningStrategy?: WinningStrategyKey;
  customPriorityOrder: string[];
  combinationMatrix: OfferCombinationRule[];
  offerTypes: OfferTypeDefinition[];
}

export const DEFAULT_OFFER_TYPES: OfferTypeDefinition[] = [
  { key: 'VENDOR_PROMOTION', label: 'Vendor Promotion', category: 'PROMOTION', funder: 'VENDOR' },
  { key: 'PLATFORM_PROMOTION', label: 'Platform Promotion', category: 'PROMOTION', funder: 'PLATFORM' },
  { key: 'VENDOR_COUPON', label: 'Vendor Coupon', category: 'COUPON', funder: 'VENDOR' },
  { key: 'PLATFORM_COUPON', label: 'Platform Coupon', category: 'COUPON', funder: 'PLATFORM' },
];

export function normalizeWinningStrategy(
  strategy: WinningStrategyKey | undefined
): WinningStrategyKey {
  if (!strategy || strategy === 'MAX_CUSTOMER_SAVINGS') return 'HIGHEST_CUSTOMER_SAVINGS';
  if (strategy === 'CUSTOM_RULE') return 'CUSTOM_PRIORITY';
  return strategy;
}

export function normalizeApplicationStrategy(
  strategy: DiscountApplicationStrategy
): DiscountApplicationStrategy {
  if (strategy === 'CUSTOM_RULES') return 'FULLY_CONFIGURABLE';
  return strategy;
}

export const WINNING_TO_PRIORITY: Record<WinningStrategyKey, PriorityStrategyKey> = {
  HIGHEST_CUSTOMER_SAVINGS: 'MAX_CUSTOMER_SAVINGS',
  MAX_CUSTOMER_SAVINGS: 'MAX_CUSTOMER_SAVINGS',
  HIGHEST_PRIORITY: 'FIXED_PRIORITY_WEIGHT',
  LOWEST_PLATFORM_COST: 'LOWEST_PLATFORM_COST',
  VENDOR_PREFERRED: 'VENDOR_SPOTLIGHT_FIRST',
  CUSTOM_PRIORITY: 'ADMIN_MANUAL_ORDER',
  CUSTOM_RULE: 'ADMIN_MANUAL_ORDER',
};

export const PRIORITY_TO_WINNING: Partial<Record<PriorityStrategyKey, WinningStrategyKey>> = {
  MAX_CUSTOMER_SAVINGS: 'HIGHEST_CUSTOMER_SAVINGS',
  FIXED_PRIORITY_WEIGHT: 'HIGHEST_PRIORITY',
  LOWEST_PLATFORM_COST: 'LOWEST_PLATFORM_COST',
  VENDOR_SPOTLIGHT_FIRST: 'VENDOR_PREFERRED',
  ADMIN_MANUAL_ORDER: 'CUSTOM_PRIORITY',
};
