import { DiscountDomain } from '../../enums/discount-domain';
import { DiscountOwner } from '../../enums/discount-owner';
import { DiscountSource } from '../../enums/discount-source';
import { DiscountTrigger } from '../../enums/discount-trigger';
import {
  CouponCandidateProvider,
  PlatformPromotionCandidateProvider,
  VendorPromotionCandidateProvider,
} from '../../candidates/providers';
import type { CandidateProvider } from '../../candidates/providers/types';
import { getCandidateNormalizer, resetCandidateNormalizerForTests } from '../../candidates/candidate-normalizer';
import type { DiscountContext } from '../../models/discount-context';
import { DefaultCandidateRepository } from '../candidate-repository';
import {
  DefaultUnifiedDiscountResolver,
  resetUnifiedDiscountResolverForTests,
} from '../unified-discount-resolver';
import type { PriorityDiagnostics, ResolverResult } from '../types';
import type { PromotionRow } from '../../../utils/vendor-promotion-engine';

const productRowA: PromotionRow = {
  id: 'vp-a',
  vendor_id: 'v-1',
  name: 'Sale A',
  promotion_type: 'flash_sale',
  discount_type: 'percentage',
  discount_value: 20,
  min_order_value: 100,
  max_discount_amount: 200,
  start_date: '2020-01-01',
  end_date: '2099-12-31',
  is_active: true,
  usage_limit: 10,
  usage_count: 0,
  target_audience: 'all',
  applicable_products: ['p1'],
  applicable_categories: [],
};

const productRowB: PromotionRow = {
  ...productRowA,
  id: 'vp-b',
  name: 'Sale B',
  discount_value: 10,
  max_discount_amount: 50,
};

function staticProvider(source: DiscountSource, rows: unknown[]): CandidateProvider {
  return { source, load: async () => rows };
}

function createResolver(providers: CandidateProvider[]): DefaultUnifiedDiscountResolver {
  class TestRepository extends DefaultCandidateRepository {
    async loadCandidates(context: DiscountContext) {
      return super.loadCandidates(context, providers);
    }
  }
  return new DefaultUnifiedDiscountResolver(new TestRepository());
}

async function resolve(context: DiscountContext, providers: CandidateProvider[]): Promise<ResolverResult> {
  return createResolver(providers).resolve(context);
}

function priorityMeta(result: ResolverResult): PriorityDiagnostics {
  return result.metadata?.priority as PriorityDiagnostics;
}

describe('Phase 5B — authoritative priority', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    resetCandidateNormalizerForTests();
    resetUnifiedDiscountResolverForTests();
    getCandidateNormalizer();
    delete process.env.DISCOUNT_ENGINE_V2_PRIORITY_SHADOW;
    process.env.DISCOUNT_ENGINE_V2_PRIORITY_MODE = 'AUTHORITATIVE';
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  const ecommerceContext: DiscountContext = {
    domain: DiscountDomain.ECOMMERCE,
    trigger: DiscountTrigger.AUTO,
    vendorId: 'v-1',
    amount: 1000,
    items: [{ id: 'p1', productId: 'p1', quantity: 2, unitPrice: 500 }],
    metadata: { priorVendorOrderCount: 0, evaluationMode: 'full' },
  };

  it('limits appliedCandidates to priority selection (ecommerce max 1 auto)', async () => {
    const result = await resolve(ecommerceContext, [
      staticProvider(DiscountSource.VENDOR_PROMOTION, [productRowA, productRowB]),
    ]);

    expect(result.eligibleCandidates).toHaveLength(2);
    expect(result.appliedCandidates.length).toBe(1);
    expect(result.applied).toHaveLength(1);
    expect(priorityMeta(result).authoritative).toBe(true);
    expect(priorityMeta(result).priorityMode).toBe('AUTHORITATIVE');
    expect(priorityMeta(result).selectedCount).toBe(1);
    expect(priorityMeta(result).policyFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('SHADOW mode keeps all eligible in appliedCandidates', async () => {
    process.env.DISCOUNT_ENGINE_V2_PRIORITY_MODE = 'SHADOW';
    const result = await resolve(ecommerceContext, [
      staticProvider(DiscountSource.VENDOR_PROMOTION, [productRowA, productRowB]),
    ]);

    expect(result.appliedCandidates).toHaveLength(2);
    expect(priorityMeta(result).authoritative).toBe(false);
    expect(priorityMeta(result).priorityMode).toBe('SHADOW');
    expect(priorityMeta(result).autoPhase?.selectedCandidates).toHaveLength(1);
  });

  it('OFF mode skips priority authoritative path', async () => {
    process.env.DISCOUNT_ENGINE_V2_PRIORITY_MODE = 'OFF';
    const result = await resolve(ecommerceContext, [
      staticProvider(DiscountSource.VENDOR_PROMOTION, [productRowA, productRowB]),
    ]);

    expect(result.appliedCandidates).toHaveLength(2);
    expect(priorityMeta(result).authoritative).toBe(false);
    expect(priorityMeta(result).priorityMode).toBe('OFF');
  });

  it('falls back to legacy eligible set when policy validation fails', async () => {
    const { getPolicyValidationEngine } = await import('../../policy/policy-validation-engine');
    const { buildValidationResult } = await import('../../policy/validation-result');
    const validateSpy = jest.spyOn(getPolicyValidationEngine(), 'validate').mockReturnValue(
      buildValidationResult([
        {
          ruleId: 'test.invalid',
          message: 'forced test failure',
          severity: 'error',
          path: 'test',
        },
      ])
    );

    const result = await resolve(ecommerceContext, [
      staticProvider(DiscountSource.VENDOR_PROMOTION, [productRowA, productRowB]),
    ]);

    validateSpy.mockRestore();
    expect(result.appliedCandidates).toHaveLength(2);
    expect(priorityMeta(result).authoritative).toBe(false);
    expect(priorityMeta(result).fallbackReason).toBe('POLICY_VALIDATION_FAILED');
  });

  it('service vendor + platform auto passes through legacy stack when allowed', async () => {
    const result = await resolve(
      {
        domain: DiscountDomain.SERVICE,
        trigger: DiscountTrigger.AUTO,
        vendorId: 'v-1',
        amount: 1000,
        booking: { serviceIds: ['s1'], serviceStyle: 'at_home', serviceCategory: 'grooming' },
        metadata: { priorVendorBookingCount: 0 },
      },
      [
        staticProvider(DiscountSource.VENDOR_PROMOTION, [
          {
            id: 'vs-1',
            vendor_id: 'v-1',
            name: 'Groom',
            promotion_type: 'flash_sale',
            discount_type: 'percentage',
            discount_value: 15,
            min_booking_value: 100,
            start_date: '2020-01-01',
            end_date: '2099-12-31',
            is_active: true,
            usage_limit: 5,
            usage_count: 0,
            applicable_services: ['s1'],
            applicable_service_styles: ['at_home'],
          },
        ]),
        staticProvider(DiscountSource.PLATFORM_PROMOTION, [
          {
            id: 'pp-1',
            name: 'Platform',
            promotion_type: 'flash_sale',
            discount_type: 'percentage',
            discount_value: 10,
            min_order_amount: 100,
            max_discount_amount: 50,
            start_date: '2020-01-01',
            end_date: '2099-12-31',
            is_active: true,
            published: true,
            applicable_services: ['grooming'],
          },
        ]),
      ]
    );

    expect(result.eligibleCandidates.length).toBe(2);
    expect(result.appliedCandidates.length).toBeGreaterThanOrEqual(1);
    expect(priorityMeta(result).authoritative).toBe(true);
  });

  it('exclusive auto promotion skips coupon phase', async () => {
    const result = await resolve(
      {
        domain: DiscountDomain.SERVICE,
        trigger: DiscountTrigger.AUTO,
        amount: 2000,
        booking: { serviceIds: ['s1'], serviceCategory: 'grooming', serviceStyle: 'at_home' },
      },
      [
        staticProvider(DiscountSource.PLATFORM_PROMOTION, [
          {
            id: 'excl-1',
            name: 'Exclusive Platform',
            promotion_type: 'flash_sale',
            discount_type: 'percentage',
            discount_value: 30,
            min_order_amount: 0,
            max_discount_amount: 500,
            start_date: '2020-01-01',
            end_date: '2099-12-31',
            is_active: true,
            published: true,
            exclusive: true,
            applicable_services: ['grooming'],
          },
        ]),
        staticProvider(DiscountSource.PLATFORM_COUPON, [
          {
            id: 'c-1',
            code: 'SAVE50',
            name: 'Coupon',
            discount_type: 'fixed',
            discount_value: 50,
            min_order_amount: 0,
            max_uses: 10,
            start_date: '2020-01-01',
            end_date: '2099-12-31',
            is_active: true,
          },
        ]),
      ]
    );

    const priority = priorityMeta(result);
    expect(priority.autoPhase?.selectedCandidates.length).toBeGreaterThanOrEqual(1);
    expect(priority.couponPhase).toBeUndefined();
  });
});
