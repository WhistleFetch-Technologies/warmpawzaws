import { evaluateMerchant, buildMerchantReadiness } from '../merchant-readiness.service';
import { resolveMerchantServiceCategory } from '../merchant-service-category.resolver';
import { resolveMerchantBusinessType } from '../merchant-business-type.resolver';
import { resolvePlatformStatus } from '../merchant-platform-status.resolver';
import { resolveWarmpawzAppointmentsStatus } from '../merchant-warmpawz-appointments-status.resolver';
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

  it('derives platform and warmpawz appointments statuses separately', () => {
    expect(
      resolvePlatformStatus({
        vendorStatus: 'approved',
        isActive: true,
        isDeleted: false,
      }),
    ).toBe('Approved');

    expect(
      resolveWarmpawzAppointmentsStatus('draft', false),
    ).toBe('Draft');

    expect(
      resolveWarmpawzAppointmentsStatus(PUBLISHED, true),
    ).toBe('Published');

    expect(
      resolveWarmpawzAppointmentsStatus(PUBLISHED, false),
    ).toBe('Hidden');
  });

  it('requires catalogue publish for customer visibility', () => {
    const draftEvaluation = evaluateMerchant({
      publishStatus: 'draft',
      vendorStatus: 'approved',
      isActive: true,
      isOnline: true,
      bankVerified: false,
      isDeleted: false,
      customerService: 'grooming',
      vendorType: 'solo',
      appointmentFeeConfigured: true,
    });

    expect(draftEvaluation.customerVisible).toBe(false);
    expect(draftEvaluation.readiness.readyForAppointments).toBe(false);

    const publishedEvaluation = evaluateMerchant({
      publishStatus: PUBLISHED,
      vendorStatus: 'approved',
      isActive: true,
      isOnline: true,
      bankVerified: false,
      isDeleted: false,
      customerService: 'grooming',
      vendorType: 'solo',
      appointmentFeeConfigured: true,
    });

    expect(publishedEvaluation.customerVisible).toBe(true);
    expect(publishedEvaluation.readiness.readyForAppointments).toBe(true);
  });

  it('does not require bank_verified for customer visibility', () => {
    const evaluation = evaluateMerchant({
      publishStatus: PUBLISHED,
      vendorStatus: 'approved',
      isActive: true,
      isOnline: true,
      bankVerified: false,
      isDeleted: false,
      customerService: 'grooming',
      vendorType: 'solo',
      appointmentFeeConfigured: true,
    });

    expect(evaluation.customerVisible).toBe(true);
    expect(evaluation.readiness.checks.some((check) => check.key === 'BANK_VERIFIED')).toBe(false);
  });

  it('treats appointment fee configured as a warning and keeps customer visible when blockers pass', () => {
    const evaluation = evaluateMerchant({
      publishStatus: PUBLISHED,
      vendorStatus: 'approved',
      isActive: true,
      isOnline: true,
      bankVerified: false,
      isDeleted: false,
      customerService: 'grooming',
      vendorType: 'solo',
      appointmentFeeConfigured: false,
    });

    const feeCheck = evaluation.readiness.checks.find(
      (check) => check.key === 'APPOINTMENT_FEE_CONFIGURED',
    );

    expect(feeCheck?.severity).toBe('warning');
    expect(feeCheck?.passed).toBe(false);
    expect(evaluation.customerVisible).toBe(true);
    expect(evaluation.readiness.readyForAppointments).toBe(true);
  });

  it('computes readiness score from blockers only', () => {
    const readiness = buildMerchantReadiness({
      publishStatus: PUBLISHED,
      vendorStatus: 'pending',
      isActive: true,
      isOnline: false,
      bankVerified: false,
      isDeleted: false,
      appointmentFeeConfigured: false,
    });

    expect(readiness.blockersTotal).toBe(3);
    expect(readiness.blockersPassed).toBe(2);
    expect(readiness.readyForAppointments).toBe(false);
  });
});
