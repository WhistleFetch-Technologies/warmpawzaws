import { DiscountDomain } from '../../enums/discount-domain';
import { DiscountSource } from '../../enums/discount-source';
import { DiscountTrigger } from '../../enums/discount-trigger';
import type { CandidateProvider } from '../../candidates/providers/types';
import { getCandidateNormalizer, resetCandidateNormalizerForTests } from '../../candidates/candidate-normalizer';
import type { DiscountContext } from '../../models/discount-context';
import { resetSettlementEngineForTests } from '../../settlement';
import { resetStackEngineForTests } from '../../stack';
import { DefaultCandidateRepository } from '../candidate-repository';
import {
  DefaultUnifiedDiscountResolver,
  resetUnifiedDiscountResolverForTests,
} from '../unified-discount-resolver';
import type { ResolverResult, SettlementDiagnostics } from '../types';
import type { PromotionRow } from '../../../utils/vendor-promotion-engine';

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

function settlementMeta(result: ResolverResult): SettlementDiagnostics {
  return result.metadata?.settlement as SettlementDiagnostics;
}

describe('Phase 7 — settlement resolver integration', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    resetCandidateNormalizerForTests();
    resetUnifiedDiscountResolverForTests();
    resetStackEngineForTests();
    resetSettlementEngineForTests();
    getCandidateNormalizer();
    process.env.DISCOUNT_ENGINE_V2_PRIORITY_MODE = 'AUTHORITATIVE';
    delete process.env.DISCOUNT_ENGINE_V2_STACK_MODE;
    delete process.env.DISCOUNT_ENGINE_V2_SETTLEMENT_MODE;
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
    metadata: { priorVendorBookingCount: 0, fees: { platformFee: 20 } },
  };

  it('SHADOW mode attaches settlement preview without authoritative flag', async () => {
    const result = await createResolver([
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
    ]).resolve(serviceContext);

    expect(result.resolverVersion).toBe('phase-7.0');
    expect(result.settlement).toBeDefined();
    expect(result.settlement?.vendorReceivable).toBeGreaterThan(0);
    expect(settlementMeta(result).settlementMode).toBe('SHADOW');
    expect(settlementMeta(result).authoritative).toBe(false);
  });

  it('OFF mode skips settlement diagnostics version', async () => {
    process.env.DISCOUNT_ENGINE_V2_SETTLEMENT_MODE = 'OFF';
    const result = await createResolver([
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
    ]).resolve(serviceContext);

    expect(settlementMeta(result).settlementMode).toBe('OFF');
    expect(result.settlement).toBeUndefined();
  });

  it('AUTHORITATIVE mode marks settlement diagnostics authoritative', async () => {
    process.env.DISCOUNT_ENGINE_V2_SETTLEMENT_MODE = 'AUTHORITATIVE';
    const result = await createResolver([
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
    ]).resolve(serviceContext);

    expect(settlementMeta(result).authoritative).toBe(true);
    expect(settlementMeta(result).audit?.appliedFunding.length).toBeGreaterThanOrEqual(0);
  });
});
