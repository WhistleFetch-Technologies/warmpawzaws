import {
  ActiveRule,
  AudienceRule,
  BogoRule,
  BundleRule,
  CartItemsRule,
  CategoryRule,
  ComboRule,
  CouponMaxUsesRule,
  CouponServiceTargetRule,
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
} from '../definitions/core.rules';
import {
  BookingCountRule,
  CodeRequiredRule,
  CustomerRule,
  OrderCountRule,
} from '../definitions/extended.rules';
import { evaluateRules, getRuleEngine } from '../engine';
import { getRuleRegistry, resetRuleRegistryForTests } from '../registry';
import { compareEligibilityShadow } from '../shadow';
import type { RuleContext } from '../types';

const IST_PROMO_START = '2020-01-01';
const IST_PROMO_END = '2099-12-31';

function baseProductCtx(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    domain: 'vendor_product',
    promotionId: 'promo-1',
    promotionType: 'flash_sale',
    isActive: true,
    startDate: IST_PROMO_START,
    endDate: IST_PROMO_END,
    now: new Date('2025-06-01T12:00:00+05:30'),
    metadata: { evaluationMode: 'base' },
    ...overrides,
  };
}

function fullProductCtx(overrides: Partial<RuleContext> = {}): RuleContext {
  return baseProductCtx({
    metadata: { evaluationMode: 'full' },
    items: [{ productId: 'p1', quantity: 2, price: 100 }],
    amount: 200,
    ...overrides,
  });
}

function baseServiceCtx(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    domain: 'vendor_service',
    promotionId: 'svc-1',
    promotionType: 'flash_sale',
    isActive: true,
    startDate: IST_PROMO_START,
    endDate: IST_PROMO_END,
    amount: 500,
    now: new Date('2025-06-01T12:00:00+05:30'),
    metadata: { evaluationMode: 'base' },
    ...overrides,
  };
}

describe('Discount Engine Phase 3 — Rule Engine', () => {
  beforeEach(() => {
    resetRuleRegistryForTests();
  });

  describe('individual rules', () => {
    it('ActiveRule rejects inactive promotion', () => {
      const result = new ActiveRule().evaluate(baseProductCtx({ isActive: false }));
      expect(result.passed).toBe(false);
    });

    it('DateRangeIstRule rejects expired IST promotion', () => {
      const result = new DateRangeIstRule().evaluate(
        baseProductCtx({ endDate: '2020-01-01', now: new Date('2025-01-01') })
      );
      expect(result.passed).toBe(false);
    });

    it('DateRangeUtcRule rejects future UTC promotion', () => {
      const result = new DateRangeUtcRule().evaluate({
        domain: 'coupon',
        startDate: '2099-01-01',
        now: new Date('2025-01-01'),
      });
      expect(result.passed).toBe(false);
    });

    it('MaximumUsageRule rejects exhausted vendor promotion', () => {
      const result = new MaximumUsageRule().evaluate(
        baseProductCtx({ usageLimit: 5, usageCount: 5 })
      );
      expect(result.passed).toBe(false);
    });

    it('CouponMaxUsesRule rejects exhausted coupon', () => {
      const result = new CouponMaxUsesRule().evaluate({
        domain: 'coupon',
        maxUses: 3,
        couponUsageCount: 3,
      });
      expect(result.passed).toBe(false);
    });

    it('PublishedRule rejects unpublished platform promo', () => {
      const result = new PublishedRule().evaluate({
        domain: 'platform',
        published: false,
      });
      expect(result.passed).toBe(false);
    });

    it('VendorRule rejects wrong vendor', () => {
      const result = new VendorRule().evaluate(
        baseProductCtx({ vendorId: 'v1', contextVendorId: 'v2' })
      );
      expect(result.passed).toBe(false);
    });

    it('CategoryRule requires category line items', () => {
      const result = new CategoryRule().evaluate(
        fullProductCtx({
          promotionType: 'category_discount',
          applicableCategories: ['cat-1'],
          items: [{ productId: 'p1', quantity: 1, price: 50, categoryId: 'cat-2' }],
        })
      );
      expect(result.passed).toBe(false);
    });

    it('ServiceRule requires applicable service id', () => {
      const result = new ServiceRule().evaluate(
        baseServiceCtx({ applicableServices: ['s1'], serviceIds: ['s2'] })
      );
      expect(result.passed).toBe(false);
    });

    it('ServiceStyleRule rejects mismatched style', () => {
      const result = new ServiceStyleRule().evaluate(
        baseServiceCtx({
          applicableServiceStyles: ['at_home'],
          serviceStyle: 'at_center',
        })
      );
      expect(result.passed).toBe(false);
    });

    it('ProductScopeRule rejects cart without applicable products', () => {
      const result = new ProductScopeRule().evaluate(
        fullProductCtx({
          applicableProducts: ['p9'],
          items: [{ productId: 'p1', quantity: 1, price: 100 }],
        })
      );
      expect(result.passed).toBe(false);
    });

    it('AudienceRule rejects returning-only promo for new customer', () => {
      const result = new AudienceRule().evaluate(
        baseProductCtx({ targetAudience: 'returning_users', priorVendorOrderCount: 0 })
      );
      expect(result.passed).toBe(false);
    });

    it('FirstOrderRule rejects repeat customer', () => {
      const result = new FirstOrderRule().evaluate(
        baseProductCtx({ promotionType: 'first_order', priorVendorOrderCount: 2 })
      );
      expect(result.passed).toBe(false);
    });

    it('FirstBookingRule rejects repeat booking customer', () => {
      const result = new FirstBookingRule().evaluate(
        baseServiceCtx({ promotionType: 'first_booking', priorVendorBookingCount: 1 })
      );
      expect(result.passed).toBe(false);
    });

    it('OrderCountRule and BookingCountRule mirror audience counts', () => {
      expect(
        new OrderCountRule().evaluate(
          baseProductCtx({ targetAudience: 'new_users', priorVendorOrderCount: 1 })
        ).passed
      ).toBe(false);
      expect(
        new BookingCountRule().evaluate(
          baseServiceCtx({ targetAudience: 'returning_users', priorVendorBookingCount: 0 })
        ).passed
      ).toBe(false);
    });

    it('MinimumAmountRule enforces cart minimum on full product evaluation', () => {
      const result = new MinimumAmountRule().evaluate(
        fullProductCtx({ minOrderValue: 300, amount: 200 })
      );
      expect(result.passed).toBe(false);
    });

    it('MinimumBookingRule enforces booking minimum', () => {
      const result = new MinimumBookingRule().evaluate(
        baseServiceCtx({ minBookingValue: 600, amount: 500 })
      );
      expect(result.passed).toBe(false);
    });

    it('ComboRule requires all combo services', () => {
      const result = new ComboRule().evaluate(
        baseServiceCtx({
          metadata: { evaluationMode: 'full' },
          promotionType: 'combo',
          comboServices: ['s1', 's2'],
          serviceIds: ['s1'],
        })
      );
      expect(result.passed).toBe(false);
    });

    it('BundleRule requires all bundle products', () => {
      const result = new BundleRule().evaluate(
        fullProductCtx({
          promotionType: 'bundle',
          bundleProducts: ['p1', 'p2'],
          items: [{ productId: 'p1', quantity: 1, price: 100 }],
        })
      );
      expect(result.passed).toBe(false);
    });

    it('BOGORule requires complete sets', () => {
      const result = new BogoRule().evaluate(
        fullProductCtx({
          promotionType: 'buy_x_get_y',
          buyQuantity: 2,
          getQuantity: 1,
          items: [{ productId: 'p1', quantity: 1, price: 100 }],
        })
      );
      expect(result.passed).toBe(false);
    });

    it('LoyaltyRule enforces visit threshold', () => {
      const result = new LoyaltyRule().evaluate(
        baseServiceCtx({
          metadata: { evaluationMode: 'full' },
          promotionType: 'loyalty',
          visitsRequired: 5,
          priorVendorBookingCount: 2,
        })
      );
      expect(result.passed).toBe(false);
    });

    it('CustomerRule always passes (legacy has no customer-id gate)', () => {
      expect(new CustomerRule().evaluate(baseProductCtx()).passed).toBe(true);
    });

    it('CodeRequiredRule requires manual code for coded promos', () => {
      const result = new CodeRequiredRule().evaluate(
        fullProductCtx({ promotionCode: 'SAVE10', manualCode: undefined })
      );
      expect(result.passed).toBe(false);
    });

    it('Platform inline category/style/service rules', () => {
      expect(
        new PlatformInlineCategoryRule().evaluate({
          domain: 'platform_inline',
          serviceCategory: 'grooming',
          applicableServices: ['vet'],
        }).passed
      ).toBe(false);
      expect(
        new PlatformInlineStyleRule().evaluate({
          domain: 'platform_inline',
          serviceStyle: 'at_center',
          applicableServices: ['style:at_home'],
        }).passed
      ).toBe(false);
      expect(
        new PlatformInlineServiceRule().evaluate({
          domain: 'platform_inline',
          serviceIds: ['00000000-0000-4000-8000-000000000099'],
          applicableServices: ['00000000-0000-4000-8000-000000000001'],
        }).passed
      ).toBe(false);
    });

    it('PlatformInlineCategoryRule ignores UUID service targets', () => {
      const result = new PlatformInlineCategoryRule().evaluate({
        domain: 'platform_inline',
        serviceCategory: 'grooming',
        serviceIds: ['00000000-0000-4000-8000-000000000099'],
        applicableServices: ['00000000-0000-4000-8000-000000000099'],
      });
      expect(result.passed).toBe(true);
    });

    it('CouponServiceTargetRule rejects typed coupons for the wrong service', () => {
      const result = new CouponServiceTargetRule().evaluate({
        domain: 'coupon',
        serviceCategory: 'grooming',
        serviceIds: ['00000000-0000-4000-8000-000000000099'],
        applicableServices: ['00000000-0000-4000-8000-000000000001'],
      });
      expect(result.passed).toBe(false);
    });

    it('PlatformMatchRule mirrors booking platform context matching', () => {
      const row = {
        start_date: '2020-01-01',
        end_date: '2099-12-31',
        published: true,
        min_order_amount: 100,
        applicable_services: ['grooming'],
        service_category: 'grooming',
      };
      const passCtx: RuleContext = {
        domain: 'platform',
        amount: 200,
        serviceCategory: 'grooming',
        serviceIds: [],
        platformRow: row,
      };
      expect(new PlatformMatchRule().evaluate(passCtx).passed).toBe(true);
      expect(
        new PlatformMatchRule().evaluate({ ...passCtx, amount: 50 }).passed
      ).toBe(false);
    });
  });

  describe('registry', () => {
    it('registers default rules and allows lookup', () => {
      const registry = getRuleRegistry();
      expect(registry.getAll().length).toBeGreaterThan(20);
      expect(registry.get('ActiveRule')).toBeDefined();
    });

    it('supports custom rule registration', () => {
      const registry = getRuleRegistry();
      const custom = new ActiveRule();
      registry.register(custom);
      expect(registry.getAll().filter((r) => r.ruleName === 'ActiveRule').length).toBeGreaterThan(1);
    });
  });

  describe('rule engine', () => {
    it('evaluate all rules by default', () => {
      const result = evaluateRules(
        baseProductCtx({ isActive: false, usageLimit: 1, usageCount: 9 })
      );
      expect(result.eligible).toBe(false);
      expect(result.failedRules.length).toBeGreaterThan(1);
    });

    it('fail fast stops after first failure', () => {
      const result = getRuleEngine().evaluate(
        baseProductCtx({ isActive: false, vendorId: 'a', contextVendorId: 'b' }),
        { failFast: true }
      );
      expect(result.eligible).toBe(false);
      expect(result.ruleResults.length).toBe(1);
    });

    it('full product pipeline passes healthy cart promo', () => {
      const result = evaluateRules(fullProductCtx());
      expect(result.eligible).toBe(true);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('shadow comparison', () => {
    it('logs mismatch details without changing legacy boolean', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const comparison = compareEligibilityShadow(
        baseProductCtx({ isActive: false }),
        true,
        'legacy forced true'
      );
      expect(comparison.matched).toBe(false);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('matched comparison is silent', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const ctx = baseProductCtx();
      const ruleResult = evaluateRules(ctx);
      const comparison = compareEligibilityShadow(ctx, ruleResult.eligible, undefined);
      expect(comparison.matched).toBe(true);
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });
});
