import {
  isVendorCompleteBlockedAsAlreadyDone,
  isWapptPendingVendorOtpAttestation,
} from '../wappt-vendor-complete-policy';

describe('wappt-vendor-complete-policy', () => {
  it('detects Pay Bill first pending OTP attestation', () => {
    expect(
      isWapptPendingVendorOtpAttestation({
        commerce_mode: 'warmpawz_appointments',
        status: 'completed',
        otp_verified: false,
      }),
    ).toBe(true);
  });

  it('does not block /complete when WAPPT awaits OTP after Pay Bill', () => {
    expect(
      isVendorCompleteBlockedAsAlreadyDone({
        commerce_mode: 'warmpawz_appointments',
        status: 'completed',
        otp_verified: false,
      }),
    ).toBe(false);
  });

  it('blocks /complete when WAPPT OTP already attested', () => {
    expect(
      isVendorCompleteBlockedAsAlreadyDone({
        commerce_mode: 'warmpawz_appointments',
        status: 'completed',
        otp_verified: true,
      }),
    ).toBe(true);
  });
});
