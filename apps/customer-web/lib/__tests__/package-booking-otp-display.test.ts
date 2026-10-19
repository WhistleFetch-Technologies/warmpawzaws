import { packageBookingUsesSessionOtps } from '../booking-display-utils';

describe('packageBookingUsesSessionOtps', () => {
  it('hides the generic service OTP when the booking belongs to a package', () => {
    expect(packageBookingUsesSessionOtps({ packagePurchaseId: 'pp-1', isPackageSession: false })).toBe(true);
    expect(packageBookingUsesSessionOtps({ isPackageSession: true })).toBe(true);
    expect(
      packageBookingUsesSessionOtps({
        packageDetails: { packagePurchaseId: 'pp-2' },
      })
    ).toBe(true);
  });

  it('keeps the service OTP for a normal booking', () => {
    expect(packageBookingUsesSessionOtps({})).toBe(false);
    expect(packageBookingUsesSessionOtps(null)).toBe(false);
  });
});
