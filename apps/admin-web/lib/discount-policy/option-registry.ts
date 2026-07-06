/**
 * Configuration-driven UI labels and option lists — not business rules.
 */
import type {
  CapOverflowStrategy,
  DiscountDomainKey,
  PriorityStrategyKey,
  TieBreakerKey,
} from './types';
import type {
  DiscountApplicationStrategy,
  WinningStrategyKey,
} from './business-rules-types';

export const POLICY_DOMAIN_OPTIONS: { value: DiscountDomainKey; label: string }[] = [
  { value: 'SERVICE', label: 'Service bookings' },
  { value: 'ECOMMERCE', label: 'E-commerce / shop' },
  { value: 'PHARMACY', label: 'Pharmacy' },
  { value: 'TELECONSULT', label: 'Teleconsultation' },
  { value: 'SUBSCRIPTION', label: 'Subscriptions' },
  { value: 'MEMBERSHIP', label: 'Memberships' },
];

export const APPLICATION_STRATEGY_OPTIONS: {
  value: DiscountApplicationStrategy;
  label: string;
  description: string;
}[] = [
  {
    value: 'BEST_OFFER_ONLY',
    label: 'Apply Best Offer Only',
    description:
      'When enabled, only one eligible promotion or coupon will be applied to a transaction.',
  },
  {
    value: 'STACK_ELIGIBLE',
    label: 'Stack Eligible Offers',
    description:
      'Allow multiple discounts when configured offer combinations are enabled in the rule matrix.',
  },
  {
    value: 'CUSTOM_RULES',
    label: 'Custom Rules',
    description:
      'Advanced mode — use engine stack rules directly. For power users and future offer types.',
  },
];

export const WINNING_STRATEGY_OPTIONS: {
  value: WinningStrategyKey;
  label: string;
  description: string;
}[] = [
  {
    value: 'MAX_CUSTOMER_SAVINGS',
    label: 'Maximum Customer Savings',
    description: 'Determines which offer wins when multiple offers are applicable.',
  },
  {
    value: 'HIGHEST_PRIORITY',
    label: 'Highest Priority',
    description: 'Uses configured priority weights on promotion and coupon records.',
  },
  {
    value: 'LOWEST_PLATFORM_COST',
    label: 'Lowest Platform Cost',
    description: 'Minimizes platform-funded discount exposure when choosing the winning offer.',
  },
  {
    value: 'VENDOR_PREFERRED',
    label: 'Vendor Preferred',
    description: 'Prefers vendor-funded offers over platform offers when both are eligible.',
  },
  {
    value: 'CUSTOM_PRIORITY',
    label: 'Custom Priority',
    description: 'Uses admin-defined offer type order to determine the winning offer.',
  },
];

export const PRIORITY_STRATEGY_OPTIONS: {
  value: PriorityStrategyKey;
  label: string;
  description: string;
}[] = [
  {
    value: 'MAX_CUSTOMER_SAVINGS',
    label: 'Maximum Customer Savings',
    description: 'Selects discounts that maximize total savings for the customer.',
  },
  {
    value: 'VENDOR_SPOTLIGHT_FIRST',
    label: 'Vendor Spotlight',
    description: 'Prioritizes vendor spotlight promotions before platform offers.',
  },
  {
    value: 'FIXED_PRIORITY_WEIGHT',
    label: 'Fixed Priority Weight',
    description: 'Uses configured priority weights on promotion records.',
  },
  {
    value: 'LOWEST_PLATFORM_COST',
    label: 'Lowest Platform Cost',
    description: 'Minimizes platform-funded discount exposure.',
  },
  {
    value: 'ADMIN_MANUAL_ORDER',
    label: 'Admin Manual Order',
    description: 'Applies promotions in admin-defined manual order.',
  },
];

export const TIE_BREAKER_OPTIONS: { value: TieBreakerKey; label: string }[] = [
  { value: 'EXCLUSIVE', label: 'Exclusive first' },
  { value: 'SPOTLIGHT', label: 'Spotlight' },
  { value: 'PRIORITY_WEIGHT', label: 'Priority weight' },
  { value: 'VALID_FROM', label: 'Valid from (earlier first)' },
  { value: 'ID', label: 'Stable ID' },
];

export const STACK_SOURCE_OPTIONS = [
  { value: 'VENDOR_PROMOTION', label: 'Vendor promotion' },
  { value: 'PLATFORM_PROMOTION', label: 'Platform promotion' },
  { value: 'VENDOR_COUPON', label: 'Vendor coupon' },
  { value: 'PLATFORM_COUPON', label: 'Platform coupon' },
];

export const FUNDING_PRESET_SPLITS = [
  { id: '50_50', label: '50 / 50', platformPercent: 50, vendorPercent: 50 },
  { id: '70_30', label: '70 / 30 (platform / vendor)', platformPercent: 70, vendorPercent: 30 },
  { id: '20_80', label: '20 / 80 (platform / vendor)', platformPercent: 20, vendorPercent: 80 },
  { id: '100_platform', label: '100% Platform', platformPercent: 100, vendorPercent: 0 },
  { id: '100_vendor', label: '100% Vendor', platformPercent: 0, vendorPercent: 100 },
];

export const CAP_OVERFLOW_OPTIONS: { value: CapOverflowStrategy; label: string }[] = [
  { value: 'REJECT_LAST', label: 'Reject last discount' },
  { value: 'TRIM_TO_CAP', label: 'Trim to cap' },
  { value: 'REJECT_LOWEST_SAVINGS', label: 'Reject lowest savings' },
];

export const POLICY_CENTER_TABS = [
  { id: 'stack', label: 'Discount Application', group: 'configuration' },
  { id: 'priority', label: 'Winning Offer', group: 'configuration' },
  { id: 'funding', label: 'Funding', group: 'configuration' },
  { id: 'limits', label: 'Limits', group: 'configuration' },
  { id: 'runtime', label: 'Runtime Policy', group: 'diagnostics' },
  { id: 'validation', label: 'Validation', group: 'lifecycle' },
  { id: 'publish', label: 'Publish', group: 'lifecycle' },
  { id: 'history', label: 'History', group: 'lifecycle' },
  { id: 'simulator', label: 'Simulator', group: 'diagnostics' },
  { id: 'audit', label: 'Audit Viewer', group: 'diagnostics' },
] as const;

export type PolicyCenterTabId = (typeof POLICY_CENTER_TABS)[number]['id'];

export const FEATURE_FLAG_LABELS: Record<string, string> = {
  DISCOUNT_ENGINE_V2_RESOLVER_MODE: 'Production resolver mode (OFF | SHADOW | AUTHORITATIVE)',
  DISCOUNT_ENGINE_V2_PRIORITY_MODE: 'Priority engine mode',
  DISCOUNT_ENGINE_V2_STACK_MODE: 'Stack engine mode',
  DISCOUNT_ENGINE_V2_ANALYTICS_MODE: 'Analytics mode',
  DISCOUNT_ENGINE_V2_CAMPAIGN_MODE: 'Campaign engine mode',
};
