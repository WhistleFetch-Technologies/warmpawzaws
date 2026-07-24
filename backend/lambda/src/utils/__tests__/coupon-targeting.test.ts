import {
  couponRowMatchesService,
  couponRowMatchesVendor,
  parseCouponApplicableServices,
  parseCouponVendorIds,
} from '../coupon-targeting';

describe('coupon-targeting', () => {
  it('matches veterinary slug to customer vet bucket', () => {
    expect(
      couponRowMatchesService(
        {
          service_category: 'veterinary',
          applicable_services: ['veterinary'],
          applicable_to: 'bookings',
        },
        'vet'
      )
    ).toBe(true);
  });

  it('allows platform-wide coupons without targeting', () => {
    expect(couponRowMatchesService({ applicable_to: 'all' }, 'vet')).toBe(true);
  });

  it('parses applicable_services json array', () => {
    expect(parseCouponApplicableServices(JSON.stringify(['veterinary']))).toEqual(['veterinary']);
  });

  it('passes service-bucket filter for UUID-only applicable_services', () => {
    expect(
      couponRowMatchesService(
        {
          applicable_services: ['9175476c-c5fd-4cc9-9356-b7a9bcbb497d'],
          applicable_to: 'bookings',
        },
        'grooming'
      )
    ).toBe(true);
  });

  it('still rejects category-targeted coupons for the wrong bucket', () => {
    expect(
      couponRowMatchesService(
        {
          applicable_services: ['veterinary'],
          applicable_to: 'bookings',
        },
        'grooming'
      )
    ).toBe(false);
  });

  it('rejects UUID coupons when explicit service_category mismatches bucket', () => {
    expect(
      couponRowMatchesService(
        {
          service_category: 'veterinary',
          applicable_services: ['9175476c-c5fd-4cc9-9356-b7a9bcbb497d'],
          applicable_to: 'bookings',
        },
        'grooming'
      )
    ).toBe(false);
  });

  it('parses vendor ids from metadata.selectedTargets.vendors', () => {
    expect(
      parseCouponVendorIds({
        metadata: {
          selectedTargets: { vendors: ['a6db6389-7506-49b7-afed-70b493fa9ba0'] },
        },
      })
    ).toEqual(['a6db6389-7506-49b7-afed-70b493fa9ba0']);
  });

  it('matches vendor-scoped coupon only for allowed vendor', () => {
    const row = {
      metadata: {
        selectedTargets: { vendors: ['vendor-a'] },
      },
    };
    expect(couponRowMatchesVendor(row, 'vendor-a')).toBe(true);
    expect(couponRowMatchesVendor(row, 'vendor-b')).toBe(false);
    expect(couponRowMatchesVendor(row)).toBe(false);
  });

  it('allows platform-wide coupons without vendor targeting', () => {
    expect(couponRowMatchesVendor({ applicable_to: 'all' }, 'any-vendor')).toBe(true);
  });
});
