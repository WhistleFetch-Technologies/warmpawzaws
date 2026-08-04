import type { DiscountRule, RuleDomain, RuleRegistry } from './types';
import {
  ActiveRule,
  AudienceRule,
  BogoRule,
  BundleRule,
  CartItemsRule,
  CategoryRule,
  ComboRule,
  CouponMaxUsesRule,
  CouponMaxUsesPerUserRule,
  CouponServiceTargetRule,
  CouponVendorTargetRule,
  DateRangeIstRule,
  DateRangeUtcRule,
  FirstBookingRule,
  FirstOrderRule,
  LoyaltyRule,
  MaximumUsageRule,
  MinimumAmountRule,
  MinimumBookingRule,
  PlatformInlineCategoryRule,
  PlatformInlineServiceRule,
  PlatformInlineStyleRule,
  PlatformMatchRule,
  ProductScopeRule,
  PublishedRule,
  ServiceRule,
  ServiceStyleRule,
  VendorRule,
} from './definitions/core.rules';
import {
  BookingCountRule,
  CodeRequiredRule,
  CustomerRule,
  OrderCountRule,
} from './definitions/extended.rules';
import { RULE_GROUP_ORDER } from './groups';

let cachedRules: DiscountRule[] | null = null;

function buildDefaultRules(): DiscountRule[] {
  return [
    new ActiveRule(),
    new DateRangeIstRule(),
    new DateRangeUtcRule(),
    new PublishedRule(),
    new VendorRule(),
    new MaximumUsageRule(),
    new CouponMaxUsesRule(),
    new CouponMaxUsesPerUserRule(),
    new CouponVendorTargetRule(),
    new CouponServiceTargetRule(),
    new AudienceRule(),
    new FirstOrderRule(),
    new FirstBookingRule(),
    new OrderCountRule(),
    new BookingCountRule(),
    new CustomerRule(),
    new MinimumAmountRule(),
    new MinimumBookingRule(),
    new ServiceStyleRule(),
    new ServiceRule(),
    new CartItemsRule(),
    new ProductScopeRule(),
    new CategoryRule(),
    new BogoRule(),
    new BundleRule(),
    new ComboRule(),
    new LoyaltyRule(),
    new PlatformMatchRule(),
    new PlatformInlineCategoryRule(),
    new PlatformInlineStyleRule(),
    new PlatformInlineServiceRule(),
    new CodeRequiredRule(),
  ];
}

function sortByGroup(rules: DiscountRule[]): DiscountRule[] {
  const order = RULE_GROUP_ORDER as readonly string[];
  return [...rules].sort(
    (a, b) => order.indexOf(a.group) - order.indexOf(b.group)
  );
}

export class DefaultRuleRegistry implements RuleRegistry {
  private rules: DiscountRule[];

  constructor(rules?: DiscountRule[]) {
    this.rules = rules ?? getDefaultRules();
  }

  register(rule: DiscountRule): void {
    this.rules.push(rule);
  }

  get(name: string): DiscountRule | undefined {
    return this.rules.find((rule) => rule.ruleName === name);
  }

  getAll(): DiscountRule[] {
    return [...this.rules];
  }

  getForDomain(domain: RuleDomain): DiscountRule[] {
    const probe = { domain } as { domain: RuleDomain };
    return sortByGroup(this.rules.filter((rule) => rule.applies(probe)));
  }
}

export function getDefaultRules(): DiscountRule[] {
  if (!cachedRules) {
    cachedRules = buildDefaultRules();
  }
  return cachedRules;
}

let defaultRegistry: DefaultRuleRegistry | null = null;

export function getRuleRegistry(): DefaultRuleRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new DefaultRuleRegistry();
  }
  return defaultRegistry;
}

export function resetRuleRegistryForTests(rules?: DiscountRule[]): void {
  cachedRules = rules ?? buildDefaultRules();
  defaultRegistry = new DefaultRuleRegistry(cachedRules);
}
