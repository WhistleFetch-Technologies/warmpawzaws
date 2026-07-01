import { DiscountDomain } from '../../enums/discount-domain';
import { DiscountOwner } from '../../enums/discount-owner';
import { DiscountSource } from '../../enums/discount-source';
import { DiscountTrigger } from '../../enums/discount-trigger';
import { DiscountStatus } from '../../enums/discount-status';
import {
  CandidateNormalizer,
  getCandidateNormalizer,
  resetCandidateNormalizerForTests,
} from '../candidate-normalizer';
import { candidateToBenefitContext, computeBenefitFromCandidate } from '../bridges/candidate-to-benefit-context';
import { candidateToRuleContext } from '../bridges/candidate-to-rule-context';
import { evaluateCandidateEligibility, evaluateRules } from '../../rules/engine';
import type { PromotionRow } from '../../../utils/vendor-promotion-engine';
import type { ServicePromotionRow } from '../../../utils/service-promotion-engine';

const productRow: PromotionRow = {
  id: 'vp-1',
  vendor_id: 'v-1',
  name: 'Summer Sale',
  promotion_type: 'flash_sale',
  discount_type: 'percentage',
  discount_value: 20,
  min_order_value: 500,
  max_discount_amount: 100,
  start_date: '2020-01-01',
  end_date: '2099-12-31',
  is_active: true,
  usage_limit: 10,
  usage_count: 0,
  target_audience: 'all',
  applicable_products: ['p1'],
  applicable_categories: [],
};

const serviceRow: ServicePromotionRow = {
  id: 'vs-1',
  vendor_id: 'v-1',
  name: 'Grooming Combo',
  promotion_type: 'combo',
  discount_type: 'percentage',
  discount_value: 15,
  min_booking_value: 300,
  start_date: '2020-01-01',
  end_date: '2099-12-31',
  is_active: true,
  usage_limit: 5,
  usage_count: 1,
  applicable_services: ['s1', 's2'],
  applicable_service_styles: ['at_home'],
  combo_services: ['s1', 's2'],
  combo_discount: 15,
};

const platformRow: Record<string, unknown> = {
  id: 'pp-1',
  name: 'Platform Offer',
  promotion_type: 'flash_sale',
  discount_type: 'percentage',
  discount_value: 10,
  min_order_amount: 200,
  max_discount_amount: 50,
  start_date: '2020-01-01',
  end_date: '2099-12-31',
  is_active: true,
  published: true,
  applicable_services: ['grooming'],
  is_spotlight: true,
};

const couponRow: Record<string, unknown> = {
  id: 'c-1',
  code: 'SAVE50',
  name: 'Save 50',
  discount_type: 'fixed',
  discount_value: 50,
  min_order_amount: 100,
  max_uses: 100,
  start_date: '2020-01-01',
  end_date: '2099-12-31',
  is_active: true,
};

describe('Discount Engine Phase 3.5 — DiscountCandidate', () => {
  let normalizer: CandidateNormalizer;

  beforeEach(() => {
    resetCandidateNormalizerForTests();
    normalizer = getCandidateNormalizer();
  });

  describe('CandidateNormalizer', () => {
    it('normalizes vendor product promotion', () => {
      const c = normalizer.fromVendorProductPromotion(productRow);
      expect(c.source).toBe(DiscountSource.VENDOR_PROMOTION);
      expect(c.domain).toBe(DiscountDomain.ECOMMERCE);
      expect(c.trigger).toBe(DiscountTrigger.AUTO);
      expect(c.benefits.type).toBe('flash_sale');
      expect(c.benefits.value).toBe(20);
      expect(c.rules.applicableProducts).toEqual(['p1']);
    });

    it('normalizes coded vendor product as VENDOR_COUPON', () => {
      const c = normalizer.fromVendorProductPromotion({ ...productRow, code: 'VIP20' });
      expect(c.source).toBe(DiscountSource.VENDOR_COUPON);
      expect(c.trigger).toBe(DiscountTrigger.CODE);
      expect(c.code).toBe('VIP20');
    });

    it('normalizes vendor service promotion types', () => {
      const c = normalizer.fromVendorServicePromotion(serviceRow);
      expect(c.domain).toBe(DiscountDomain.SERVICE);
      expect(c.benefits.type).toBe('combo');
      expect(c.benefits.comboServiceIds).toEqual(['s1', 's2']);
      expect(c.rules.minBookingValue).toBe(300);
    });

    it('normalizes platform promotion', () => {
      const c = normalizer.fromPlatformPromotion(platformRow);
      expect(c.source).toBe(DiscountSource.PLATFORM_PROMOTION);
      expect(c.owner).toBe(DiscountOwner.PLATFORM);
      expect(c.rules.published).toBe(true);
      expect(c.metadata?.isSpotlight).toBe(true);
    });

    it('normalizes platform coupon', () => {
      const c = normalizer.fromCoupon(couponRow);
      expect(c.source).toBe(DiscountSource.PLATFORM_COUPON);
      expect(c.trigger).toBe(DiscountTrigger.CODE);
      expect(c.benefits.discountType).toBe('fixed');
      expect(c.usage?.limit).toBe(100);
    });

    it('normalizes all product promotion structural types', () => {
      for (const type of ['flash_sale', 'category_discount', 'buy_x_get_y', 'bundle', 'first_order']) {
        const c = normalizer.fromVendorProductPromotion({ ...productRow, promotion_type: type });
        expect(c.benefits.type).toBe(type);
      }
    });

    it('normalizes service loyalty and first_booking types', () => {
      const loyalty = normalizer.fromVendorServicePromotion({
        ...serviceRow,
        promotion_type: 'loyalty',
        visits_required: 5,
        loyalty_discount: 20,
      });
      expect(loyalty.benefits.type).toBe('loyalty');
      expect(loyalty.benefits.visitsRequired).toBe(5);

      const first = normalizer.fromVendorServicePromotion({
        ...serviceRow,
        promotion_type: 'first_booking',
      });
      expect(first.benefits.type).toBe('first_booking');
    });
  });

  describe('Rule Engine via DiscountCandidate', () => {
    it('evaluateCandidateEligibility matches direct rule path for vendor product', () => {
      const candidate = normalizer.fromVendorProductPromotion(productRow);
      const runtime = {
        contextVendorId: 'v-1',
        priorVendorOrderCount: 0,
        evaluationMode: 'base' as const,
      };
      const fromCandidate = evaluateCandidateEligibility(candidate, runtime);
      const fromBridge = evaluateRules(candidateToRuleContext(candidate, runtime));
      expect(fromCandidate.eligible).toBe(fromBridge.eligible);
      expect(fromCandidate.failedRules).toEqual(fromBridge.failedRules);
    });

    it('inactive candidate fails ActiveRule', () => {
      const candidate = normalizer.fromVendorProductPromotion({ ...productRow, is_active: false });
      const result = evaluateCandidateEligibility(candidate, {
        contextVendorId: 'v-1',
        evaluationMode: 'base',
      });
      expect(result.eligible).toBe(false);
      expect(result.failedRules).toContain('ActiveRule');
    });
  });

  describe('Benefit Engine via DiscountCandidate', () => {
    it('computeBenefitFromCandidate produces percentage discount', () => {
      const candidate = normalizer.fromVendorProductPromotion(productRow);
      const amount = computeBenefitFromCandidate(candidate, {
        originalAmount: 1000,
        currentAmount: 800,
        eligibleAmount: 800,
        legacyAmount: 160,
        label: 'test',
      });
      expect(amount).toBeGreaterThan(0);
    });

    it('candidateToBenefitContext maps benefit fields', () => {
      const candidate = normalizer.fromVendorServicePromotion(serviceRow);
      const ctx = candidateToBenefitContext(candidate, { originalAmount: 500 });
      expect(ctx.comboDiscountPercent).toBe(15);
      expect(ctx.promotionType).toBe('combo');
    });
  });
});
