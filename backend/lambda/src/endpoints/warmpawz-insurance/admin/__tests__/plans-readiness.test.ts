import { planInputSchema } from '../dto/insurance-admin.requests';
import { planPublishBlockers, vendorReadinessBlockers } from '../domain/readiness';

const plan = {
  name: 'Protect',
  productType: 'Health',
  highlights: ['Accident cover'],
  premiumFrom: 499,
  premiumUnit: 'year' as const,
};

describe('plan validation', () => {
  it('accepts a plan with at most 3 highlights and a non-negative premium', () => {
    expect(planInputSchema.parse(plan)).toMatchObject({ premiumUnit: 'year', highlights: ['Accident cover'] });
  });

  it('rejects a fourth highlight, a negative premium, and an unknown unit', () => {
    expect(() => planInputSchema.parse({ ...plan, highlights: ['a', 'b', 'c', 'd'] })).toThrow();
    expect(() => planInputSchema.parse({ ...plan, premiumFrom: -1 })).toThrow();
    expect(() => planInputSchema.parse({ ...plan, premiumUnit: 'week' })).toThrow();
  });
});

describe('readiness', () => {
  const ready = {
    companyActive: true,
    onboardingApproved: true,
    vendorActive: true,
    linkActive: true,
    teleAvailability: true,
    publishedForm: false,
    requirePublishedForm: false,
  };

  it('is ready when onboarding, the vendor, the link, and tele availability are in place', () => {
    expect(vendorReadinessBlockers(ready)).toEqual([]);
  });

  it('lists each missing requirement and skips the form check until that flag is on', () => {
    expect(
      vendorReadinessBlockers({
        ...ready,
        onboardingApproved: false,
        vendorActive: false,
        linkActive: false,
        teleAvailability: false,
      }),
    ).toEqual([
      'Vendor onboarding is not approved',
      'Vendor is not active',
      'Vendor link is not active',
      'No teleconsultation availability',
    ]);
    expect(vendorReadinessBlockers({ ...ready, requirePublishedForm: true, publishedForm: false })).toEqual([
      'No published form template for this company',
    ]);
  });

  it('blocks publish when the company is inactive or no vendor is ready', () => {
    expect(planPublishBlockers({ companyActive: false, readyVendorCount: 0 })).toEqual([
      'Company is not active',
      'At least one ready vendor is required',
    ]);
    expect(planPublishBlockers({ companyActive: true, readyVendorCount: 1 })).toEqual([]);
  });
});
