/**
 * @jest-environment jsdom
 */

import * as fs from 'fs';
import * as path from 'path';

const CUSTOMER_WEB_ROOT = path.resolve(__dirname, '../..');

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(CUSTOMER_WEB_ROOT, rel), 'utf8');
}

describe('Guest auth UI', () => {
  const authFlow = readSrc('components/customer/auth/CustomerAuthFlow.tsx');

  it('keeps the X/close control on the guest auth modal', () => {
    expect(authFlow).toMatch(/aria-label="Close"/);
    expect(authFlow).toMatch(/onDismiss/);
  });

  it('still renders Login and Sign Up copy', () => {
    expect(authFlow).toMatch(/Create Your Account/);
    expect(authFlow).toMatch(/Log in with your mobile number/);
    expect(authFlow).toMatch(/Send Verification Code/);
  });

  it('does not render Continue without booking / Continue browsing without login', () => {
    expect(authFlow).not.toMatch(/Continue browsing without login/);
    expect(authFlow).not.toMatch(/Continue without booking/i);
    expect(authFlow).not.toMatch(/Continue Without Booking/);
  });
});

describe('Guest appointment restore contracts', () => {
  it('does not consume a pending journey until profile is complete', () => {
    const wrapper = readSrc('components/customer/wrappers/CustomerHomeWrapper.tsx');
    expect(wrapper).toMatch(/shouldRestoreGuestJourneyOnHome/);
    expect(wrapper).toMatch(/readGuestBookingIntent\(\) && !shouldRestoreGuestJourneyOnHome\(\)/);
    expect(wrapper).toMatch(/isGuestAppointmentJourney/);
  });

  it('profile creation uses the shared post-profile destination helper', () => {
    const profile = readSrc('app/profile/page.tsx');
    expect(profile).toMatch(/resolvePostProfileRedirectPath/);
    expect(profile).toMatch(/readGuestBookingIntent\(\)/);
    expect(profile).toMatch(/markOnboardingCompleteAfterProfile/);
  });

  it('OTP verify does not clear the guest booking snapshot', () => {
    const authFlow = readSrc('components/customer/auth/CustomerAuthFlow.tsx');
    expect(authFlow).not.toMatch(/clearGuestBookingIntent/);
  });
});
