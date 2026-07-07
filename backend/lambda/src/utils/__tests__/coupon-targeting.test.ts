import {
  couponRowMatchesService,
  parseCouponApplicableServices,
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
});
