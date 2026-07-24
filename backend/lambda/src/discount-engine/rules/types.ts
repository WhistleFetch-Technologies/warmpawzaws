import type { DiscountDomain } from '../enums/discount-domain';
import type { CartLineItem } from '../../utils/vendor-promotion-engine';

export type RuleDomain =
  | 'vendor_product'
  | 'vendor_service'
  | 'platform'
  | 'platform_inline'
  | 'coupon';

export interface RuleContext {
  domain: RuleDomain;
  promotionId?: string;
  promotionType?: string;
  discountDomain?: DiscountDomain;
  now?: Date;

  isActive?: boolean;
  startDate?: string;
  endDate?: string;
  published?: boolean;

  vendorId?: string;
  /** Platform coupon vendor allow-list. */
  vendorIds?: string[];
  contextVendorId?: string;
  customerId?: string;

  usageLimit?: number | null;
  usageCount?: number;
  maxUses?: number | null;
  couponUsageCount?: number;
  /** Per-customer coupon limit (max_uses_per_user). */
  maxUsesPerUser?: number | null;
  /** How many times this customer already redeemed the coupon. */
  customerCouponUsageCount?: number;

  targetAudience?: string;
  minOrderValue?: number | null;
  minBookingValue?: number | null;
  minOrderAmount?: number | null;
  amount?: number;

  priorVendorOrderCount?: number;
  priorVendorBookingCount?: number;

  serviceIds?: string[];
  serviceStyle?: string;
  serviceCategory?: string;

  applicableProducts?: string[];
  applicableCategories?: string[];
  /** all | own_brand | third_party */
  listingOwnershipScope?: string;
  applicableServices?: string[];
  applicableServiceStyles?: string[];
  bundleProducts?: string[];
  comboServices?: string[];
  buyQuantity?: number;
  getQuantity?: number;
  visitsRequired?: number;

  items?: CartLineItem[];
  manualCode?: string;
  promotionCode?: string | null;

  /** Raw platform row for platform-specific matching */
  platformRow?: Record<string, unknown>;

  metadata?: Record<string, unknown>;
}

export interface RuleResult {
  passed: boolean;
  ruleName: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface RuleEvaluation {
  ruleName: string;
  group: string;
  result: RuleResult;
}

export interface EligibilityResult {
  eligible: boolean;
  ruleResults: RuleEvaluation[];
  passedRules: string[];
  failedRules: string[];
  executionTimeMs: number;
  metadata?: Record<string, unknown>;
}

export interface RuleExecutionResult extends EligibilityResult {
  firstFailure?: RuleResult;
}

export interface DiscountRule {
  readonly ruleName: string;
  readonly group: string;
  applies(context: RuleContext): boolean;
  evaluate(context: RuleContext): RuleResult;
}

export interface RuleGroup {
  readonly name: string;
  readonly rules: DiscountRule[];
}

export interface RuleEngine {
  evaluate(context: RuleContext, options?: RuleEngineOptions): EligibilityResult;
}

export interface RuleEngineOptions {
  /** Default false — evaluate all rules for admin preview parity */
  failFast?: boolean;
  /** Override registered rules (testing) */
  rules?: DiscountRule[];
}

export interface RuleRegistry {
  register(rule: DiscountRule): void;
  get(name: string): DiscountRule | undefined;
  getAll(): DiscountRule[];
  getForDomain(domain: RuleDomain): DiscountRule[];
}
