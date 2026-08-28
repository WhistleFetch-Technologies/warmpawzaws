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
    expect(authFlow).toMatch(/Log in or create an account with your mobile number/);
    expect(authFlow).toMatch(/Send Verification Code/);
  });

  it('guest account sidebar keeps Login and hides Sign Up', () => {
    const sidebar = readSrc('components/customer/UserAccountSidebar.tsx');
    const guestStart = sidebar.indexOf('if (isGuest)');
    const guestEnd = sidebar.indexOf('displayName={displayName}');
    const guestBlock = sidebar.slice(guestStart, guestEnd);
    expect(guestBlock).toMatch(/mode: 'login'/);
    expect(guestBlock).not.toMatch(/mode: 'signup'/);
    expect(guestBlock).toMatch(/>Login</);
    expect(guestBlock).not.toMatch(/>Sign Up</);
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
    expect(wrapper).toMatch(/beginGuestJourneyRestore/);
    expect(wrapper).toMatch(/vet-tele-consultation/);
  });

  it('scheduled Tele persist maps to vet-tele-consultation', () => {
    const profile = readSrc('components/customer/shared/UniversalProviderProfile.tsx');
    expect(profile).toMatch(/vet-tele-consultation/);
    expect(profile).toMatch(/hasAuthenticatedCustomerSession\(\)/);
  });

  it('Home Services Continue uses persona booking restore screens', () => {
    const home = readSrc('components/customer/home-services/HomeServiceProviderProfile.tsx');
    expect(home).toMatch(/resolveWarmpawzBookingScreen/);
    expect(home).not.toMatch(/resumeScreen: 'home-service-booking'/);
  });

  it('Instant Tele does not load customer APIs before auth', () => {
    const tele = readSrc('components/customer/vet/TeleConsultationRouter.tsx');
    expect(tele).toMatch(/hasAuthenticatedCustomerSession\(\)/);
    expect(tele).toMatch(/requestGuestAuthForInstantTele/);
    const instant = readSrc('app/booking/tele/page.tsx');
    expect(instant).toMatch(/hasAuthenticatedCustomerSession\(\)/);
    expect(instant).toMatch(/requestGuestAuthForInstantTele/);
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

  it('login OTP sends new customers to profile creation', () => {
    const authFlow = readSrc('components/customer/auth/CustomerAuthFlow.tsx');
    const modal = readSrc('components/customer/auth/GuestAuthModal.tsx');
    const app = readSrc('components/customer/CustomerApp.tsx');
    expect(authFlow).toMatch(/applyOtpVerifyProfileFlags/);
    expect(authFlow).toMatch(/extractOtpAuthState/);
    expect(modal).toMatch(/readProfileCompleted\(\)/);
    expect(modal).toMatch(/router\.push\(dest\)/);
    expect(app).toMatch(/router\.replace\('\/profile'\)/);
  });
});
