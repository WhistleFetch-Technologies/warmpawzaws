/**
 * @jest-environment jsdom
 *
 * Final E2E lifecycle validation for Guest appointment restore.
 * Walks persist → OTP/auth → profile-if-needed → resolve → restore → consume
 * for every numbered product flow. Uses the real shared resolvers.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  markOnboardingCompleteAfterProfile,
  resolvePostAuthRedirectPath,
  resolvePostProfileRedirectPath,
  shouldRestoreGuestJourneyOnHome,
} from '../customer-flow-guards';
import {
  beginGuestJourneyRestore,
  clearGuestBookingIntent,
  finishGuestJourneyRestore,
  isGuestAppointmentJourney,
  persistGuestBookingIntentForAuth,
  readGuestBookingIntent,
  resolveResumeScreen,
  stripAuthFromGuestJourneySnapshots,
  transactionRequiresPet,
  type GuestBookingIntentV1,
} from '../guest-booking-intent';
import { isSelectedSlotStillAvailable, retainValidRestoredSlot } from '../guest-slot-revalidate';

const CUSTOMER_WEB_ROOT = path.resolve(__dirname, '../..');

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(CUSTOMER_WEB_ROOT, rel), 'utf8');
}

function resetGuestState(): void {
  sessionStorage.clear();
  localStorage.clear();
  clearGuestBookingIntent();
}

function persistAppointment(partial: Omit<GuestBookingIntentV1, 'v' | 'savedAt'>): void {
  persistGuestBookingIntentForAuth(partial);
}

function expectSnapshotSurvivesAuth(): GuestBookingIntentV1 {
  const intent = readGuestBookingIntent();
  expect(intent).toBeTruthy();
  expect(JSON.stringify(intent)).not.toMatch(/jwt|access_token|refresh_token|password|"otp"/i);
  return intent as GuestBookingIntentV1;
}

function simulateExistingCustomerLogin(): GuestBookingIntentV1 {
  localStorage.setItem('profile_completed', 'true');
  localStorage.setItem('onboarding_completed', 'true');
  expect(resolvePostAuthRedirectPath('/')).toBe('/');
  expect(shouldRestoreGuestJourneyOnHome()).toBe(true);
  return expectSnapshotSurvivesAuth();
}

function simulateNewCustomerSignupThenProfile(): GuestBookingIntentV1 {
  expect(resolvePostAuthRedirectPath('/')).toBe('/profile');
  expect(shouldRestoreGuestJourneyOnHome()).toBe(false);
  expectSnapshotSurvivesAuth();
  markOnboardingCompleteAfterProfile();
  expect(shouldRestoreGuestJourneyOnHome()).toBe(true);
  expect(resolvePostProfileRedirectPath(null)).toBe('/');
  return expectSnapshotSurvivesAuth();
}

function expectAppointmentRestored(expectedScreen: string): void {
  const restored = beginGuestJourneyRestore();
  expect(restored).toBeTruthy();
  expect(isGuestAppointmentJourney(restored)).toBe(true);
  expect(resolveResumeScreen(restored!)).toBe(expectedScreen);
  expect(beginGuestJourneyRestore()).toBeNull();
  finishGuestJourneyRestore();
  expect(readGuestBookingIntent()).toBeNull();
}

describe('Guest appointment E2E — numbered product flows', () => {
  beforeEach(resetGuestState);

  const sharedSlotBookings: Array<[string, string, string]> = [
    ['1. Vet clinic', 'vet', 'vet-booking'],
    ['3. Grooming', 'grooming', 'grooming-booking'],
    ['4. Training', 'training', 'training-booking'],
    ['5. Behaviorist', 'behaviorist', 'training-booking'],
    ['6. Walker', 'walker', 'walker-booking'],
    ['7. Boarding', 'boarding', 'boarding-booking'],
    ['8. Pet sitting', 'sitting', 'pet-sitter-booking'],
    ['9. Nutrition / Diet', 'nutrition', 'nutritionist-booking'],
  ];

  it.each(sharedSlotBookings)(
    '%s signup → profile → booking restore, not Home-only consume',
    (_label, persona, resumeScreen) => {
      persistAppointment({
        kind: 'booking',
        persona,
        category: persona,
        vendorId: `vendor-${persona}`,
        serviceId: `svc-${persona}`,
        date: '2026-08-21',
        time: '17:00',
        slotId: `slot-${persona}`,
        returnPath: '/',
        resumeScreen,
      });
      simulateNewCustomerSignupThenProfile();
      expectAppointmentRestored(resumeScreen);
    }
  );

  it.each(sharedSlotBookings)(
    '%s existing-customer login → booking restore, not Home',
    (_label, persona, resumeScreen) => {
      persistAppointment({
        kind: 'booking',
        persona,
        category: persona,
        vendorId: `vendor-${persona}`,
        date: '2026-08-21',
        time: '17:00',
        returnPath: '/',
        resumeScreen,
      });
      simulateExistingCustomerLogin();
      expectAppointmentRestored(resumeScreen);
    }
  );

  it('2 + 10. Scheduled Tele Continue restores Tele booking, not Home, and does not invent a slot', () => {
    persistAppointment({
      kind: 'booking',
      persona: 'vet',
      category: 'vet',
      vendorId: 'tele-vendor-1',
      serviceId: 'tele-svc-1',
      serviceStyle: 'tele',
      returnPath: '/',
      resumeScreen: 'vet-tele-consultation',
    });
    simulateNewCustomerSignupThenProfile();
    const restored = beginGuestJourneyRestore();
    expect(isGuestAppointmentJourney(restored)).toBe(true);
    expect(resolveResumeScreen(restored!)).toBe('vet-tele-consultation');
    expect(restored?.date).toBeUndefined();
    expect(restored?.time).toBeUndefined();
    expect(restored?.slotId).toBeUndefined();
    finishGuestJourneyRestore();
  });

  it('11. Home Service Continue restores the persona booking router', () => {
    persistAppointment({
      kind: 'booking',
      persona: 'walker',
      category: 'walker',
      vendorId: 'walker-vendor-1',
      serviceId: 'walk-svc-1',
      serviceStyle: 'at_home',
      returnPath: '/',
      resumeScreen: 'home-service-booking',
    });
    simulateExistingCustomerLogin();
    expectAppointmentRestored('walker-booking');
  });

  it('12. Instant Tele is not an appointment snapshot and does not require pet before auth', () => {
    persistAppointment({
      returnPath: '/?service=tele',
    });
    expect(isGuestAppointmentJourney(readGuestBookingIntent())).toBe(false);
    expect(transactionRequiresPet(readGuestBookingIntent())).toBe(false);
    expect(resolvePostAuthRedirectPath('/?service=tele')).toBe('/profile');
    markOnboardingCompleteAfterProfile();
    expect(resolvePostProfileRedirectPath(null)).toBe('/?service=tele');

    const tele = readSrc('components/customer/vet/TeleConsultationRouter.tsx');
    expect(tele).toMatch(/if \(!hasAuthenticatedCustomerSession\(\) \|\| !phone\) return;/);
    expect(tele).toMatch(/\/customer\/tele\/available-now/);
    expect(tele).toMatch(/requestGuestAuthIfNeeded/);
    const instantPage = readSrc('app/booking/tele/page.tsx');
    expect(instantPage).toMatch(/if \(!hasAuthenticatedCustomerSession\(\)\)/);
    expect(instantPage).toMatch(/requestGuestAuthIfNeeded/);
  });

  it('13. WPay Pay Bill is not classified as appointment restore', () => {
    persistAppointment({
      kind: 'pay_bill',
      vendorId: 'wpay-vendor-1',
      price: 1500,
      returnPath: '/warmpawz-pay/vendors/wpay-vendor-1',
      resumeScreen: 'warmpawz-pay-vendor',
    });
    const intent = expectSnapshotSurvivesAuth();
    expect(isGuestAppointmentJourney(intent)).toBe(false);
    expect(transactionRequiresPet(intent)).toBe(false);
    markOnboardingCompleteAfterProfile();
    expect(resolvePostProfileRedirectPath(null)).toBe('/warmpawz-pay/vendors/wpay-vendor-1');
    const restored = beginGuestJourneyRestore();
    expect(isGuestAppointmentJourney(restored)).toBe(false);
    expect(resolveResumeScreen(restored!)).toBe('warmpawz-pay-vendor');
  });

  it('14. Ecommerce checkout restores /checkout and never requires a pet', () => {
    persistAppointment({
      kind: 'cart',
      returnPath: '/checkout',
      requiresPet: false,
    });
    expect(isGuestAppointmentJourney(readGuestBookingIntent())).toBe(false);
    expect(transactionRequiresPet(readGuestBookingIntent())).toBe(false);
    expect(resolvePostAuthRedirectPath('/checkout')).toBe('/profile?next=%2Fcheckout');
    markOnboardingCompleteAfterProfile();
    expect(resolvePostProfileRedirectPath('/checkout')).toBe('/checkout');
  });

  it('15. Logout isolation keeps guest appointment fields and strips A identity', () => {
    persistAppointment({
      kind: 'booking',
      persona: 'vet',
      vendorId: 'vendor-1',
      date: '2026-08-21',
      time: '17:00',
      returnPath: '/',
      resumeScreen: 'vet-booking',
    });
    const raw = sessionStorage.getItem('warmpawz_guest_booking_intent_v1');
    sessionStorage.setItem(
      'warmpawz_guest_booking_intent_v1',
      JSON.stringify({
        ...JSON.parse(String(raw)),
        jwt: 'jwt-A',
        customerPhone: '9999990001',
        customerId: 'cust-A',
        phone: '9999990001',
        otp: '123456',
      })
    );
    stripAuthFromGuestJourneySnapshots();
    const intent = readGuestBookingIntent();
    expect(intent?.vendorId).toBe('vendor-1');
    expect(intent?.time).toBe('17:00');
    expect((intent as Record<string, unknown> | null)?.jwt).toBeUndefined();
    expect((intent as Record<string, unknown> | null)?.customerPhone).toBeUndefined();
    expect((intent as Record<string, unknown> | null)?.customerId).toBeUndefined();
    expect((intent as Record<string, unknown> | null)?.phone).toBeUndefined();
    expect((intent as Record<string, unknown> | null)?.otp).toBeUndefined();
    localStorage.setItem('profile_completed', 'true');
    expectAppointmentRestored('vet-booking');
  });

  it('16. Normal login with no pending journey does not restore an appointment', () => {
    localStorage.setItem('profile_completed', 'true');
    expect(readGuestBookingIntent()).toBeNull();
    expect(shouldRestoreGuestJourneyOnHome()).toBe(false);
    expect(resolvePostAuthRedirectPath('/')).toBe('/');
    expect(beginGuestJourneyRestore()).toBeNull();
  });

  it('17. Normal signup with no pending journey goes to the normal post-profile destination', () => {
    expect(readGuestBookingIntent()).toBeNull();
    expect(resolvePostAuthRedirectPath('/')).toBe('/profile');
    markOnboardingCompleteAfterProfile();
    expect(resolvePostProfileRedirectPath(null)).toBe('/');
    expect(shouldRestoreGuestJourneyOnHome()).toBe(false);
    expect(beginGuestJourneyRestore()).toBeNull();
  });

  it('18. Slot revalidation keeps an available slot and never substitutes another', () => {
    const slots = [
      { time: '17:00', available: true },
      { time: '18:00', available: true },
    ];
    expect(isSelectedSlotStillAvailable('17:00', slots)).toBe(true);
    expect(retainValidRestoredSlot('17:00', slots)).toBe('17:00');
    expect(retainValidRestoredSlot('17:00', [{ time: '17:00', available: false }, { time: '18:00', available: true }])).toBe(
      ''
    );
    expect(retainValidRestoredSlot('21:00', slots)).toBe('');
  });
});

describe('Guest appointment E2E — router persist contracts', () => {
  it('shared *BookingRouter Book Appointment paths persist the canonical resume screens', () => {
    expect(readSrc('components/customer/vet/VetBookingRouter.tsx')).toMatch(
      /resumeScreen: 'vet-booking'/
    );
    expect(readSrc('components/customer/grooming/GroomingBookingRouter.tsx')).toMatch(
      /resumeScreen: 'grooming-booking'/
    );
    expect(readSrc('components/customer/training/TrainingBookingRouter.tsx')).toMatch(
      /resumeScreen: 'training-booking'/
    );
    expect(readSrc('components/customer/walker/WalkerBookingRouter.tsx')).toMatch(
      /resumeScreen: 'walker-booking'/
    );
    expect(readSrc('components/customer/boarding/BoardingBookingRouter.tsx')).toMatch(
      /resumeScreen: isPetSitting \? 'pet-sitter-booking' : 'boarding-booking'/
    );
    expect(readSrc('components/customer/nutrition/NutritionistBookingRouter.tsx')).toMatch(
      /resumeScreen: 'nutritionist-booking'/
    );
  });

  it('Nutrition guest auth is not a pet or phone gate', () => {
    const nutrition = readSrc('components/customer/nutrition/NutritionistBookingRouter.tsx');
    expect(nutrition).toMatch(/requestGuestAuthForBooking/);
    expect(nutrition).not.toMatch(/router\.(push|replace)\(['`]\/pets/);
    expect(nutrition).not.toMatch(/phone is required/i);
  });
});
