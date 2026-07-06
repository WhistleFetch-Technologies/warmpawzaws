/**
 * Business-friendly Policy Center rules — shared with admin-web layer.
 * Maps to StackPolicyConfiguration + PriorityConfiguration (no engine rewrite).
 */

export type DiscountApplicationStrategy =
  | 'BEST_OFFER_ONLY'
  | 'STACK_ELIGIBLE'
  | 'CUSTOM_RULES';

export type WinningStrategyKey =
  | 'MAX_CUSTOMER_SAVINGS'
  | 'HIGHEST_PRIORITY'
  | 'LOWEST_PLATFORM_COST'
  | 'VENDOR_PREFERRED'
  | 'CUSTOM_PRIORITY';

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

export const WINNING_TO_PRIORITY: Record<WinningStrategyKey, PriorityStrategyKey> = {
  MAX_CUSTOMER_SAVINGS: 'MAX_CUSTOMER_SAVINGS',
  HIGHEST_PRIORITY: 'FIXED_PRIORITY_WEIGHT',
  LOWEST_PLATFORM_COST: 'LOWEST_PLATFORM_COST',
  VENDOR_PREFERRED: 'VENDOR_SPOTLIGHT_FIRST',
  CUSTOM_PRIORITY: 'ADMIN_MANUAL_ORDER',
};
