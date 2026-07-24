import { evaluateMerchant, buildMerchantReadiness } from '../merchant-readiness.service';
import { resolveMerchantServiceCategory } from '../merchant-service-category.resolver';
import { resolveMerchantBusinessType } from '../merchant-business-type.resolver';
import { resolvePlatformStatus } from '../merchant-platform-status.resolver';
import { resolveWarmpawzPayStatus } from '../merchant-warmpawz-pay-status.resolver';
import { PUBLISHED } from '../../../constants/publish-status';

describe('merchant domain resolvers', () => {
  it('resolves launch service category from customer_service first', () => {
    expect(
      resolveMerchantServiceCategory({
        customerService: 'vet',
        roleCategory: 'healthcare',
        roleDisplayName: 'Vet Clinic',
      }),
    ).toMatchObject({
      serviceCategoryId: 'vet',
      serviceCategory: 'Vet',
      roleLabel: 'Vet Clinic',
    });

    expect(
      resolveMerchantServiceCategory({
        customerService: 'training',
        roleDisplayName: 'Behaviorist Center',
      }),
    ).toMatchObject({
      serviceCategoryId: 'training',
      serviceCategory: 'Training',
      roleLabel: 'Behaviorist Center',
    });

    expect(
      resolveMerchantServiceCategory({
        legacyCategory: 'walker',
      }),
    ).toMatchObject({
      serviceCategoryId: 'walker',
      serviceCategory: 'Walking',
    });
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

  it('requires catalogue publish for customer visibility', () => {
    const draftEvaluation = evaluateMerchant({
      publishStatus: 'draft',
      vendorStatus: 'approved',
      isActive: true,
      isOnline: true,
      bankVerified: true,
      isDeleted: false,
      customerService: 'grooming',
      vendorType: 'solo',
      pricingConfigured: true,
    });

    expect(draftEvaluation.customerVisible).toBe(false);
    expect(draftEvaluation.readiness.readyForPayBill).toBe(false);

    const publishedEvaluation = evaluateMerchant({
      publishStatus: PUBLISHED,
      vendorStatus: 'approved',
      isActive: true,
      isOnline: true,
      bankVerified: true,
      isDeleted: false,
      customerService: 'grooming',
      vendorType: 'solo',
      pricingConfigured: true,
    });

    expect(publishedEvaluation.customerVisible).toBe(true);
    expect(publishedEvaluation.readiness.readyForPayBill).toBe(true);
  });

  it('treats pricing configured as a warning and keeps customer visible when blockers pass', () => {
    const evaluation = evaluateMerchant({
      publishStatus: PUBLISHED,
      vendorStatus: 'approved',
      isActive: true,
      isOnline: true,
      bankVerified: true,
      isDeleted: false,
      customerService: 'grooming',
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
      isDeleted: false,
      pricingConfigured: false,
    });

    expect(readiness.blockersTotal).toBe(4);
    expect(readiness.blockersPassed).toBe(2);
    expect(readiness.readyForPayBill).toBe(false);
  });
});
