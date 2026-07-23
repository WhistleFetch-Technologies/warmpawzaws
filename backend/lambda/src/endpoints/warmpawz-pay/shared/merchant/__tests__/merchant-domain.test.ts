import { evaluateMerchant, buildMerchantReadiness } from '../merchant-readiness.service';
import { resolveMerchantCategory } from '../merchant-category.resolver';
import { resolveMerchantBusinessType } from '../merchant-business-type.resolver';
import { resolvePlatformStatus } from '../merchant-platform-status.resolver';
import { resolveWarmpawzPayStatus } from '../merchant-warmpawz-pay-status.resolver';
import { PUBLISHED } from '../../../constants/publish-status';

describe('merchant domain resolvers', () => {
  it('resolves category using approved priority order', () => {
    expect(
      resolveMerchantCategory({
        roleCategory: 'grooming',
        customerService: 'vet',
        legacyCategory: 'legacy',
      }),
    ).toBe('Grooming');

    expect(
      resolveMerchantCategory({
        customerService: 'vet',
        legacyCategory: 'legacy',
      }),
    ).toBe('Vet');

    expect(
      resolveMerchantCategory({
        serviceCategory: 'training',
        legacyCategory: 'legacy',
      }),
    ).toBe('Training');

    expect(resolveMerchantCategory({ legacyCategory: 'walker' })).toBe('Walker');
    expect(resolveMerchantCategory({})).toBe('Unknown');
  });

  it('resolves business type as Solo, Business, or Center', () => {
    expect(resolveMerchantBusinessType({ vendorType: 'solo' })).toBe('Solo');
    expect(resolveMerchantBusinessType({ roleName: 'groomer_center' })).toBe('Center');
    expect(resolveMerchantBusinessType({ vendorType: 'business' })).toBe('Business');
  });

  it('derives platform and warmpawz pay statuses separately', () => {
    expect(
      resolvePlatformStatus({
        vendorStatus: 'approved',
        isActive: true,
        isDeleted: false,
      }),
    ).toBe('Approved');

    expect(
      resolveWarmpawzPayStatus('draft', false),
    ).toBe('Draft');

    expect(
      resolveWarmpawzPayStatus(PUBLISHED, true),
    ).toBe('Published');

    expect(
      resolveWarmpawzPayStatus(PUBLISHED, false),
    ).toBe('Hidden');
  });

  it('treats pricing configured as a warning and keeps customer visible when blockers pass', () => {
    const evaluation = evaluateMerchant({
      publishStatus: PUBLISHED,
      vendorStatus: 'approved',
      isActive: true,
      isOnline: true,
      bankVerified: true,
      payBillEnabled: true,
      isDeleted: false,
      roleCategory: 'grooming',
      vendorType: 'solo',
      pricingConfigured: false,
    });

    const pricingCheck = evaluation.readiness.checks.find(
      (check) => check.key === 'PRICING_CONFIGURED',
    );

    expect(pricingCheck?.severity).toBe('warning');
    expect(pricingCheck?.passed).toBe(false);
    expect(evaluation.customerVisible).toBe(true);
    expect(evaluation.readiness.readyForPayBill).toBe(true);
  });

  it('computes readiness score from blockers only', () => {
    const readiness = buildMerchantReadiness({
      publishStatus: PUBLISHED,
      vendorStatus: 'pending',
      isActive: true,
      isOnline: false,
      bankVerified: false,
      payBillEnabled: false,
      isDeleted: false,
      pricingConfigured: false,
    });

    expect(readiness.blockersTotal).toBe(4);
    expect(readiness.blockersPassed).toBe(1);
    expect(readiness.readyForPayBill).toBe(false);
  });
});
