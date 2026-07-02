import { DiscountDomain } from '../../enums/discount-domain';
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
import { resetStackEngineForTests } from '../../stack';
import { DefaultCandidateRepository } from '../candidate-repository';
import {
  DefaultUnifiedDiscountResolver,
  resetUnifiedDiscountResolverForTests,
} from '../unified-discount-resolver';
import type { PriorityDiagnostics, ResolverResult, StackDiagnostics } from '../types';
import type { PromotionRow } from '../../../utils/vendor-promotion-engine';

const productRowA: PromotionRow = {
  id: 'vp-a',
  vendor_id: 'v-1',
  name: 'Sale A',
  promotion_type: 'flash_sale',
  discount_type: 'percentage',
  discount_value: 10,
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

function stackMeta(result: ResolverResult): StackDiagnostics {
  return result.metadata?.stack as StackDiagnostics;
}

describe('Phase 6 — stack engine resolver integration', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    resetCandidateNormalizerForTests();
    resetUnifiedDiscountResolverForTests();
    resetStackEngineForTests();
    getCandidateNormalizer();
    delete process.env.DISCOUNT_ENGINE_V2_PRIORITY_SHADOW;
    process.env.DISCOUNT_ENGINE_V2_PRIORITY_MODE = 'AUTHORITATIVE';
    delete process.env.DISCOUNT_ENGINE_V2_STACK_MODE;
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  const serviceContext: DiscountContext = {
    domain: DiscountDomain.SERVICE,
    trigger: DiscountTrigger.AUTO,
    vendorId: 'v-1',
    amount: 1000,
    booking: { serviceIds: ['s1'], serviceStyle: 'at_home', serviceCategory: 'grooming' },
    metadata: { priorVendorBookingCount: 0 },
  };

  it('AUTHORITATIVE stack mode uses stack engine for applied set', async () => {
    process.env.DISCOUNT_ENGINE_V2_STACK_MODE = 'AUTHORITATIVE';
    const result = await resolve(serviceContext, [
      staticProvider(DiscountSource.VENDOR_PROMOTION, [
        {
          id: 'vs-1',
          vendor_id: 'v-1',
          name: 'Groom 10%',
          promotion_type: 'flash_sale',
          discount_type: 'percentage',
          discount_value: 10,
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
          name: 'Platform 20%',
          promotion_type: 'flash_sale',
          discount_type: 'percentage',
          discount_value: 20,
          min_order_amount: 100,
          max_discount_amount: 500,
          start_date: '2020-01-01',
          end_date: '2099-12-31',
          is_active: true,
          published: true,
          applicable_services: ['grooming'],
        },
      ]),
    ]);

    expect(result.resolverVersion).toBe('phase-6.0');
    expect(stackMeta(result).stackMode).toBe('AUTHORITATIVE');
    expect(stackMeta(result).authoritative).toBe(true);
    expect(result.appliedCandidates.length).toBe(2);
    expect(result.totalSavings).toBeGreaterThan(0);
    expect(stackMeta(result).audit?.appliedSteps.length).toBe(2);
  });

  it('SHADOW stack mode returns legacy amounts but attaches stack audit', async () => {
    process.env.DISCOUNT_ENGINE_V2_STACK_MODE = 'SHADOW';
    const result = await resolve(serviceContext, [
      staticProvider(DiscountSource.VENDOR_PROMOTION, [
        {
          id: 'vs-1',
          vendor_id: 'v-1',
          name: 'Groom 10%',
          promotion_type: 'flash_sale',
          discount_type: 'percentage',
          discount_value: 10,
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
          name: 'Platform 20%',
          promotion_type: 'flash_sale',
          discount_type: 'percentage',
          discount_value: 20,
          min_order_amount: 100,
          max_discount_amount: 500,
          start_date: '2020-01-01',
          end_date: '2099-12-31',
          is_active: true,
          published: true,
          applicable_services: ['grooming'],
        },
      ]),
    ]);

    expect(stackMeta(result).stackMode).toBe('SHADOW');
    expect(stackMeta(result).authoritative).toBe(false);
    expect(stackMeta(result).audit).toBeDefined();
    expect((result.metadata?.priority as PriorityDiagnostics).authoritative).toBe(true);
  });

  it('OFF stack mode skips stack authoritative path (legacy adapter)', async () => {
    process.env.DISCOUNT_ENGINE_V2_STACK_MODE = 'OFF';
    const result = await resolve(serviceContext, [
      staticProvider(DiscountSource.VENDOR_PROMOTION, [
        {
          id: 'vs-1',
          vendor_id: 'v-1',
          name: 'Groom 10%',
          promotion_type: 'flash_sale',
          discount_type: 'percentage',
          discount_value: 10,
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
          name: 'Platform 20%',
          promotion_type: 'flash_sale',
          discount_type: 'percentage',
          discount_value: 20,
          min_order_amount: 100,
          max_discount_amount: 500,
          start_date: '2020-01-01',
          end_date: '2099-12-31',
          is_active: true,
          published: true,
          applicable_services: ['grooming'],
        },
      ]),
    ]);

    expect(stackMeta(result).stackMode).toBe('OFF');
    expect(stackMeta(result).authoritative).toBe(false);
    expect(stackMeta(result).stackVersion).toBe('legacy-adapter');
    expect(result.appliedCandidates.length).toBe(2);
  });

  it('ecommerce still limits via priority + stack (max 1 vendor auto)', async () => {
    process.env.DISCOUNT_ENGINE_V2_STACK_MODE = 'AUTHORITATIVE';
    const ecommerceContext: DiscountContext = {
      domain: DiscountDomain.ECOMMERCE,
      trigger: DiscountTrigger.AUTO,
      vendorId: 'v-1',
      amount: 1000,
      items: [{ id: 'p1', productId: 'p1', quantity: 2, unitPrice: 500 }],
      metadata: { priorVendorOrderCount: 0, evaluationMode: 'full' },
    };

    const result = await resolve(ecommerceContext, [
      staticProvider(DiscountSource.VENDOR_PROMOTION, [productRowA, { ...productRowA, id: 'vp-b' }]),
    ]);

    expect(result.appliedCandidates).toHaveLength(1);
    expect(stackMeta(result).authoritative).toBe(true);
  });
});
