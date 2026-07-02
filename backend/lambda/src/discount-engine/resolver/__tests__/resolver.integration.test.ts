import { DiscountDomain } from '../../enums/discount-domain';
import { DiscountOwner } from '../../enums/discount-owner';
import { DiscountSource } from '../../enums/discount-source';
import { DiscountTrigger } from '../../enums/discount-trigger';
import {
  CouponCandidateProvider,
  PlatformPromotionCandidateProvider,
  VendorPromotionCandidateProvider,
  VendorServicePromotionCandidateProvider,
} from '../../candidates/providers';
import type { CandidateProvider } from '../../candidates/providers/types';
import { getCandidateNormalizer, resetCandidateNormalizerForTests } from '../../candidates/candidate-normalizer';
import type { DiscountContext } from '../../models/discount-context';
import { DefaultCandidateRepository } from '../candidate-repository';
import {
  DefaultUnifiedDiscountResolver,
  resetUnifiedDiscountResolverForTests,
} from '../unified-discount-resolver';
import type { ResolverResult } from '../types';
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

const codedProductRow: PromotionRow = {
  ...productRow,
  id: 'vp-code',
  code: 'SHOP20',
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

const codedServiceRow: ServicePromotionRow = {
  ...serviceRow,
  id: 'vs-code',
  code: 'GROOM15',
  promotion_type: 'flash_sale',
  discount_type: 'percentage',
  discount_value: 10,
  combo_services: undefined,
  combo_discount: undefined,
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
};

const codedPlatformRow: Record<string, unknown> = {
  ...platformRow,
  id: 'pp-code',
  code: 'PLATFORM10',
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

function staticProvider(source: DiscountSource, rows: unknown[]): CandidateProvider {
  return { source, load: async () => rows };
}

function createResolverWithProviders(providers: CandidateProvider[]): DefaultUnifiedDiscountResolver {
  class TestRepository extends DefaultCandidateRepository {
    async loadCandidates(context: DiscountContext) {
      return super.loadCandidates(context, providers);
    }
  }
  return new DefaultUnifiedDiscountResolver(new TestRepository());
}

async function resolve(context: DiscountContext, providers: CandidateProvider[]): Promise<ResolverResult> {
  const resolver = createResolverWithProviders(providers);
  return resolver.resolve(context);
}

describe('Discount Engine Phase 4 — Unified Discount Resolver', () => {
  beforeEach(() => {
    resetCandidateNormalizerForTests();
    resetUnifiedDiscountResolverForTests();
    getCandidateNormalizer();
  });

  describe('production flow orchestration', () => {
    it('S1 — service vendor promotion (AUTO)', async () => {
      const result = await resolve(
        {
          domain: DiscountDomain.SERVICE,
          trigger: DiscountTrigger.AUTO,
          vendorId: 'v-1',
          amount: 1000,
          booking: { serviceIds: ['s1', 's2'], serviceStyle: 'at_home' },
          metadata: { priorVendorBookingCount: 0 },
        },
        [staticProvider(DiscountSource.VENDOR_PROMOTION, [serviceRow])]
      );

      expect(result.metadata?.candidateCount).toBe(1);
      expect(result.eligibleCandidates.length).toBeGreaterThanOrEqual(1);
      expect(result.benefitResults.length).toBe(result.eligibleCandidates.length);
      expect(result.appliedCandidates.length).toBeLessThanOrEqual(result.eligibleCandidates.length);
      if (result.eligibleCandidates.length === 1) {
        expect(result.appliedCandidates).toEqual(result.eligibleCandidates);
      }
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('S2 — service platform promotion (AUTO)', async () => {
      const result = await resolve(
        {
          domain: DiscountDomain.SERVICE,
          trigger: DiscountTrigger.AUTO,
          owner: DiscountOwner.PLATFORM,
          amount: 1000,
          booking: {
            serviceIds: ['s1'],
            serviceCategory: 'grooming',
            serviceStyle: 'at_home',
          },
        },
        [staticProvider(DiscountSource.PLATFORM_PROMOTION, [platformRow])]
      );

      expect(result.eligibleCandidates.length).toBeGreaterThanOrEqual(1);
      expect(result.ruleResults).toHaveLength(1);
      expect(result.benefitResults[0]?.discountAmount).toBeGreaterThan(0);
    });

    it('S5 — service platform coupon (CODE)', async () => {
      const result = await resolve(
        {
          domain: DiscountDomain.SERVICE,
          trigger: DiscountTrigger.CODE,
          owner: DiscountOwner.PLATFORM,
          amount: 500,
          couponCode: 'SAVE50',
          metadata: { couponUsageCount: 0 },
        },
        [staticProvider(DiscountSource.PLATFORM_COUPON, [couponRow])]
      );

      expect(result.eligibleCandidates).toHaveLength(1);
      expect(result.eligibleCandidates[0]?.source).toBe(DiscountSource.PLATFORM_COUPON);
      expect(result.benefitResults[0]?.discountAmount).toBe(50);
    });

    it('S6 — service vendor coupon (CODE)', async () => {
      const result = await resolve(
        {
          domain: DiscountDomain.SERVICE,
          trigger: DiscountTrigger.CODE,
          vendorId: 'v-1',
          amount: 1000,
          couponCode: 'GROOM15',
        },
        [staticProvider(DiscountSource.VENDOR_PROMOTION, [codedServiceRow])]
      );

      expect(result.eligibleCandidates.length).toBeGreaterThanOrEqual(1);
      expect(result.eligibleCandidates[0]?.code).toBe('GROOM15');
    });

    it('E1 — ecommerce vendor promotion (AUTO)', async () => {
      const result = await resolve(
        {
          domain: DiscountDomain.ECOMMERCE,
          trigger: DiscountTrigger.AUTO,
          vendorId: 'v-1',
          amount: 1000,
          items: [{ id: 'p1', productId: 'p1', quantity: 2, unitPrice: 500 }],
          metadata: { priorVendorOrderCount: 0, evaluationMode: 'full' },
        },
        [staticProvider(DiscountSource.VENDOR_PROMOTION, [productRow])]
      );

      expect(result.eligibleCandidates.length).toBeGreaterThanOrEqual(1);
      expect(result.benefitResults[0]?.discountAmount).toBeGreaterThan(0);
    });

    it('E2/E3 — ecommerce vendor coupon (CODE)', async () => {
      const result = await resolve(
        {
          domain: DiscountDomain.ECOMMERCE,
          trigger: DiscountTrigger.CODE,
          vendorId: 'v-1',
          amount: 1000,
          couponCode: 'SHOP20',
          items: [{ id: 'p1', productId: 'p1', quantity: 2, unitPrice: 500 }],
          metadata: { priorVendorOrderCount: 0, evaluationMode: 'full' },
        },
        [staticProvider(DiscountSource.VENDOR_PROMOTION, [codedProductRow])]
      );

      expect(result.eligibleCandidates).toHaveLength(1);
      expect(result.eligibleCandidates[0]?.source).toBe(DiscountSource.VENDOR_COUPON);
    });

    it('E5 — ecommerce platform promotion (CODE)', async () => {
      const result = await resolve(
        {
          domain: DiscountDomain.ECOMMERCE,
          trigger: DiscountTrigger.CODE,
          owner: DiscountOwner.PLATFORM,
          amount: 800,
          couponCode: 'PLATFORM10',
        },
        [staticProvider(DiscountSource.PLATFORM_PROMOTION, [codedPlatformRow])]
      );

      expect(result.eligibleCandidates.length).toBeGreaterThanOrEqual(1);
      expect(result.benefitResults[0]?.discountAmount).toBeGreaterThan(0);
    });

    it('E6 — ecommerce platform coupon (CODE)', async () => {
      const result = await resolve(
        {
          domain: DiscountDomain.ECOMMERCE,
          trigger: DiscountTrigger.CODE,
          owner: DiscountOwner.PLATFORM,
          amount: 500,
          couponCode: 'SAVE50',
          metadata: { couponUsageCount: 0 },
        },
        [staticProvider(DiscountSource.PLATFORM_COUPON, [couponRow])]
      );

      expect(result.eligibleCandidates).toHaveLength(1);
      expect(result.benefitResults[0]?.discountAmount).toBe(50);
    });
  });

  describe('mixed candidate loading', () => {
    it('loads vendor service + platform promotions for service AUTO', async () => {
      const result = await resolve(
        {
          domain: DiscountDomain.SERVICE,
          trigger: DiscountTrigger.AUTO,
          vendorId: 'v-1',
          amount: 1000,
          booking: { serviceIds: ['s1', 's2'], serviceStyle: 'at_home', serviceCategory: 'grooming' },
          metadata: { priorVendorBookingCount: 0 },
        },
        [
          staticProvider(DiscountSource.VENDOR_PROMOTION, [serviceRow]),
          staticProvider(DiscountSource.PLATFORM_PROMOTION, [platformRow]),
        ]
      );

      expect(result.metadata?.candidateCount).toBe(2);
      expect(result.metadata?.providerBreakdown).toBeDefined();
      expect(result.eligibleCandidates.length + result.rejectedCandidates.length).toBe(2);
    });
  });

  describe('candidate normalization', () => {
    it('never exposes raw DB rows in rule/benefit outcomes', async () => {
      const result = await resolve(
        {
          domain: DiscountDomain.ECOMMERCE,
          trigger: DiscountTrigger.AUTO,
          vendorId: 'v-1',
          amount: 1000,
          items: [{ id: 'p1', productId: 'p1', quantity: 1, unitPrice: 1000 }],
          metadata: { priorVendorOrderCount: 0, evaluationMode: 'full' },
        },
        [staticProvider(DiscountSource.VENDOR_PROMOTION, [productRow])]
      );

      for (const outcome of result.ruleResults) {
        expect(outcome.candidate.id).toBe('vp-1');
        expect(outcome.candidate.source).toBe(DiscountSource.VENDOR_PROMOTION);
        expect(outcome.candidate.originalEntity).toBeDefined();
      }
    });
  });

  describe('rule and benefit evaluation', () => {
    it('rejects inactive candidates via Rule Engine', async () => {
      const inactive = { ...productRow, is_active: false };
      const result = await resolve(
        {
          domain: DiscountDomain.ECOMMERCE,
          trigger: DiscountTrigger.AUTO,
          vendorId: 'v-1',
          amount: 1000,
          items: [{ id: 'p1', productId: 'p1', quantity: 1, unitPrice: 1000 }],
          metadata: { priorVendorOrderCount: 0, evaluationMode: 'full' },
        },
        [staticProvider(DiscountSource.VENDOR_PROMOTION, [inactive])]
      );

      expect(result.eligibleCandidates).toHaveLength(0);
      expect(result.rejectedCandidates).toHaveLength(1);
      expect(result.rejectedCandidates[0]?.id).toBe('vp-1');
      expect(result.ruleResults[0]?.eligibility.eligible).toBe(false);
      expect(result.benefitResults).toHaveLength(0);
    });

    it('returns BenefitResult for every eligible candidate', async () => {
      const result = await resolve(
        {
          domain: DiscountDomain.SERVICE,
          trigger: DiscountTrigger.AUTO,
          vendorId: 'v-1',
          amount: 1000,
          booking: { serviceIds: ['s1', 's2'], serviceStyle: 'at_home' },
          metadata: { priorVendorBookingCount: 0 },
        },
        [staticProvider(DiscountSource.VENDOR_PROMOTION, [serviceRow])]
      );

      expect(result.benefitResults).toHaveLength(result.eligibleCandidates.length);
      for (const br of result.benefitResults) {
        expect(br.benefit).toBeDefined();
        expect(typeof br.discountAmount).toBe('number');
      }
    });
  });

  describe('ResolverResult shape', () => {
    it('includes diagnostics metadata without settlement fields', async () => {
      const result = await resolve(
        {
          domain: DiscountDomain.SERVICE,
          trigger: DiscountTrigger.AUTO,
          vendorId: 'v-1',
          amount: 500,
          booking: { serviceIds: ['s1', 's2'], serviceStyle: 'at_home' },
          metadata: { priorVendorBookingCount: 0 },
        },
        [staticProvider(DiscountSource.VENDOR_PROMOTION, [serviceRow])]
      );

      expect(result.resolverVersion).toMatch(/phase-6/);
      expect(result.metadata?.pipelineTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.metadata?.candidateCount).toBe(1);
      expect(typeof result.metadata?.eligibleCount).toBe('number');
      expect(typeof result.metadata?.rejectedCount).toBe('number');
      expect(result.metadata?.usagePrepared).toBeDefined();
      expect(result.appliedCandidates.length).toBeLessThanOrEqual(result.eligibleCandidates.length);
      if (result.eligibleCandidates.length === 1) {
        expect(result.appliedCandidates).toEqual(result.eligibleCandidates);
      }
      expect(result).not.toHaveProperty('settlement');
      expect(result).not.toHaveProperty('stackedAmount');
    });
  });

  describe('provider registry', () => {
    it('maps each provider class to the correct source', () => {
      expect(new PlatformPromotionCandidateProvider().source).toBe(
        DiscountSource.PLATFORM_PROMOTION
      );
      expect(new VendorPromotionCandidateProvider().source).toBe(DiscountSource.VENDOR_PROMOTION);
      expect(new VendorServicePromotionCandidateProvider().source).toBe(
        DiscountSource.VENDOR_PROMOTION
      );
      expect(new CouponCandidateProvider().source).toBe(DiscountSource.PLATFORM_COUPON);
    });
  });
});
