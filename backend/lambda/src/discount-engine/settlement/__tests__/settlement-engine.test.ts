import { DiscountDomain } from '../../enums/discount-domain';
import { DiscountFunding } from '../../enums/discount-funding';
import { DiscountOwner } from '../../enums/discount-owner';
import { DiscountTrigger } from '../../enums/discount-trigger';
import type { AppliedDiscount } from '../../models/discount-result';
import { loadRuntimePolicy } from '../../policy/runtime-policy-loader';
import { getFundingAllocator, resetFundingAllocatorForTests } from '../funding-allocator';
import {
  applySettlementPreviewToCommissionableGross,
  extractSettlementPreviewFromBooking,
  getSettlementEngine,
  resetSettlementEngineForTests,
} from '../index';
import { getSettlementMode } from '../settlement-mode';

function applied(
  id: string,
  amount: number,
  funding: DiscountFunding,
  legacySource: 'vendor' | 'platform' | 'coupon' = 'platform'
): AppliedDiscount {
  return {
    id,
    name: id,
    owner: funding === DiscountFunding.VENDOR ? DiscountOwner.VENDOR : DiscountOwner.PLATFORM,
    trigger: DiscountTrigger.AUTO,
    funding,
    discountAmount: amount,
    order: 1,
    legacySource,
  };
}

describe('Settlement Engine — funding allocation', () => {
  beforeEach(() => {
    resetFundingAllocatorForTests();
    resetSettlementEngineForTests();
    delete process.env.DISCOUNT_ENGINE_V2_SETTLEMENT_MODE;
  });

  it('allocates 100% PLATFORM funding to platform share', () => {
    const policy = loadRuntimePolicy(DiscountDomain.SERVICE).funding;
    const result = getFundingAllocator().allocate(
      [applied('p1', 200, DiscountFunding.PLATFORM)],
      { version: '1', sharedDefaultSplit: policy.sharedDefaultSplit, roundTo: 2, currency: 'INR' }
    );
    expect(result.platformShare).toBe(200);
    expect(result.vendorShare).toBe(0);
  });

  it('allocates 100% VENDOR funding to vendor share', () => {
    const policy = loadRuntimePolicy(DiscountDomain.SERVICE).funding;
    const result = getFundingAllocator().allocate(
      [applied('v1', 100, DiscountFunding.VENDOR, 'vendor')],
      { version: '1', sharedDefaultSplit: policy.sharedDefaultSplit, roundTo: 2, currency: 'INR' }
    );
    expect(result.vendorShare).toBe(100);
    expect(result.platformShare).toBe(0);
  });

  it('splits SHARED 50/50 by default', () => {
    const result = getFundingAllocator().allocate(
      [applied('s1', 100, DiscountFunding.SHARED)],
      { version: '1', sharedDefaultSplit: { platformPercent: 50, vendorPercent: 50 }, roundTo: 2, currency: 'INR' }
    );
    expect(result.platformShare).toBe(50);
    expect(result.vendorShare).toBe(50);
  });

  it('splits SHARED 70/30 when configured on discount metadata', () => {
    const discount = applied('s1', 100, DiscountFunding.SHARED);
    discount.metadata = { sharedSplit: { platformPercent: 70, vendorPercent: 30 } };
    const result = getFundingAllocator().allocate([discount], {
      version: '1',
      sharedDefaultSplit: { platformPercent: 50, vendorPercent: 50 },
      roundTo: 2,
      currency: 'INR',
    });
    expect(result.platformShare).toBe(70);
    expect(result.vendorShare).toBe(30);
  });
});

describe('Settlement Engine — preview', () => {
  beforeEach(() => {
    resetSettlementEngineForTests();
    delete process.env.DISCOUNT_ENGINE_V2_SETTLEMENT_MODE;
  });

  const context = {
    domain: DiscountDomain.SERVICE,
    trigger: DiscountTrigger.AUTO,
    amount: 1000,
    metadata: {
      fees: { platformFee: 20, convenienceFee: 10, deliveryFee: 0, gst: 50 },
      commissionRateHint: 15,
    },
  };

  it('generates settlement preview for vendor + platform stack', () => {
    const runtimePolicy = loadRuntimePolicy(DiscountDomain.SERVICE);
    const decision = getSettlementEngine().settle({
      context,
      applied: [
        { ...applied('v1', 100, DiscountFunding.VENDOR, 'vendor'), order: 1 },
        { ...applied('p1', 180, DiscountFunding.PLATFORM), order: 2 },
      ],
      originalAmount: 1000,
      customerPayable: 720,
      totalSavings: 280,
      runtimePolicy,
      policyFingerprint: runtimePolicy.policyFingerprint,
    });

    expect(decision.preview.customerPayable).toBe(720);
    expect(decision.preview.vendorDiscountShare).toBe(100);
    expect(decision.preview.platformDiscountShare).toBe(180);
    expect(decision.preview.vendorReceivable).toBe(900);
    expect(decision.preview.platformCost).toBe(180);
    expect(decision.preview.appliedFunding).toHaveLength(2);
    expect(decision.audit.settlementVersion).toBe('1.0.0');
  });

  it('includes fees in preview without duplicating feeCalculator', () => {
    const runtimePolicy = loadRuntimePolicy(DiscountDomain.SERVICE);
    const decision = getSettlementEngine().settle({
      context,
      applied: [],
      originalAmount: 1000,
      customerPayable: 1000,
      totalSavings: 0,
      runtimePolicy,
      policyFingerprint: runtimePolicy.policyFingerprint,
    });
    expect(decision.preview.fees.platformFees).toBe(20);
    expect(decision.preview.fees.convenienceFees).toBe(10);
  });

  it('computes netSettlement with commission hint', () => {
    const runtimePolicy = loadRuntimePolicy(DiscountDomain.SERVICE);
    const decision = getSettlementEngine().settle({
      context,
      applied: [applied('v1', 100, DiscountFunding.VENDOR, 'vendor')],
      originalAmount: 1000,
      customerPayable: 900,
      totalSavings: 100,
      runtimePolicy,
      policyFingerprint: runtimePolicy.policyFingerprint,
    });
    expect(decision.preview.vendorReceivable).toBe(900);
    expect(decision.preview.netSettlement).toBe(765);
  });
});

describe('Settlement hook bridge', () => {
  beforeEach(() => {
    delete process.env.DISCOUNT_ENGINE_V2_SETTLEMENT_MODE;
  });

  it('does not adjust gross in SHADOW mode', () => {
    process.env.DISCOUNT_ENGINE_V2_SETTLEMENT_MODE = 'SHADOW';
    const adjusted = applySettlementPreviewToCommissionableGross(1000, {
      vendorCost: 100,
      vendorDiscountShare: 100,
    });
    expect(adjusted).toBe(1000);
  });

  it('adjusts gross in AUTHORITATIVE mode', () => {
    process.env.DISCOUNT_ENGINE_V2_SETTLEMENT_MODE = 'AUTHORITATIVE';
    const adjusted = applySettlementPreviewToCommissionableGross(1000, {
      vendorCost: 100,
      sharedDiscountShare: { vendor: 25, platform: 25, total: 50 },
    });
    expect(adjusted).toBe(875);
  });

  it('parses settlement preview from wp_financial_meta notes', () => {
    const preview = extractSettlementPreviewFromBooking({
      notes: 'wp_financial_meta:{"settlement_preview":{"vendorReceivable":850,"vendorDiscountShare":150}}',
    });
    expect(preview?.vendorReceivable).toBe(850);
    expect(preview?.vendorDiscountShare).toBe(150);
  });
});

describe('Settlement mode flags', () => {
  it('defaults to SHADOW', () => {
    delete process.env.DISCOUNT_ENGINE_V2_SETTLEMENT_MODE;
    expect(getSettlementMode()).toBe('SHADOW');
  });
});
