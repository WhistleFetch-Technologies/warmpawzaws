import { CONTRACT_DEFAULT_POLICY } from '../default-config';
import { patchBusinessRules, ensureBusinessRules } from '../business-rules-mapper';
import { simulatePolicyLocally, DEFAULT_SIMULATOR_SCENARIO } from '../policy-simulator-local';

describe('business rules mapper', () => {
  it('defaults to Apply Best Offer Only with Maximum Customer Savings', () => {
    const rules = ensureBusinessRules(CONTRACT_DEFAULT_POLICY);
    expect(rules.applicationStrategy).toBe('BEST_OFFER_ONLY');
    expect(rules.winningStrategy).toBe('MAX_CUSTOMER_SAVINGS');
  });

  it('syncs best offer only to engine limits', () => {
    const bundle = patchBusinessRules(CONTRACT_DEFAULT_POLICY, {
      applicationStrategy: 'BEST_OFFER_ONLY',
      winningStrategy: 'MAX_CUSTOMER_SAVINGS',
    });
    expect(bundle.limits.global.maxTotalDiscounts).toBe(1);
    expect(bundle.priority.global.strategy).toBe('MAX_CUSTOMER_SAVINGS');
    expect(bundle.stack.global.allowCouponWithPromotion).toBe(false);
  });
});

describe('policy simulator local', () => {
  it('picks vendor promotion for max customer savings scenario', () => {
    const bundle = CONTRACT_DEFAULT_POLICY;
    const result = simulatePolicyLocally(bundle, DEFAULT_SIMULATOR_SCENARIO);
    expect(result.winningOffer?.offerType).toBe('VENDOR_PROMOTION');
    expect(result.ignoredOffers.length).toBeGreaterThan(0);
    expect(result.customerPays).toBe(750);
  });

  it('uses custom priority order when configured', () => {
    const bundle = patchBusinessRules(CONTRACT_DEFAULT_POLICY, {
      winningStrategy: 'CUSTOM_PRIORITY',
      customPriorityOrder: [
        'PLATFORM_COUPON',
        'VENDOR_PROMOTION',
        'PLATFORM_PROMOTION',
        'VENDOR_COUPON',
      ],
    });
    const result = simulatePolicyLocally(bundle, DEFAULT_SIMULATOR_SCENARIO);
    expect(result.winningOffer?.offerType).toBe('PLATFORM_COUPON');
  });
});
