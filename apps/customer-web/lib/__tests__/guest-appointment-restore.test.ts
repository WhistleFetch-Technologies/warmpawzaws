/**
 * @jest-environment jsdom
 */

import { resolvePostAuthRedirectPath, resolvePostProfileRedirectPath } from '../customer-flow-guards';
import {
  beginGuestJourneyRestore,
  clearGuestBookingIntent,
  finishGuestJourneyRestore,
  isGuestAppointmentJourney,
  resolveResumeScreen,
  saveGuestBookingIntent,
  type GuestBookingIntentV1,
} from '../guest-booking-intent';

function bookingIntent(
  resumeScreen: string,
  extra: Partial<GuestBookingIntentV1> = {}
): GuestBookingIntentV1 {
  return {
    v: 1,
    savedAt: Date.now(),
    kind: 'booking',
    returnPath: '/',
    resumeScreen,
    vendorId: 'vendor-1',
    ...extra,
  };
}

describe('guest appointment restore mapping', () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearGuestBookingIntent();
  });

  const sharedRouters: Array<[string, string]> = [
    ['vet-booking', 'Vet'],
    ['grooming-booking', 'Grooming'],
    ['training-booking', 'Training / Behaviorist'],
    ['walker-booking', 'Walker'],
    ['boarding-booking', 'Boarding'],
    ['pet-sitter-booking', 'Sitting'],
    ['nutritionist-booking', 'Nutrition'],
    ['vet-tele-consultation', 'Vet Tele scheduled'],
  ];

  it.each(sharedRouters)('treats %s (%s) as an appointment journey', (resume) => {
    expect(isGuestAppointmentJourney(bookingIntent(resume))).toBe(true);
    expect(resolveResumeScreen(bookingIntent(resume))).toBe(resume);
  });

  it('maps scheduled Tele alias to the existing Tele screen', () => {
    expect(
      resolveResumeScreen(
        bookingIntent('universal-provider-booking', { persona: 'vet', serviceStyle: 'tele' })
      )
    ).toBe('vet-tele-consultation');
  });

  it('does not map clinic/home vet Continue to Tele', () => {
    expect(
      resolveResumeScreen(
        bookingIntent('universal-provider-booking', { persona: 'vet', serviceStyle: 'at_center' })
      )
    ).toBe('vet-booking');
  });

  it('maps Home Service aliases onto persona booking screens', () => {
    expect(
      resolveResumeScreen(bookingIntent('home-service-booking', { persona: 'walker' }))
    ).toBe('walker-booking');
    expect(
      resolveResumeScreen(bookingIntent('home-service-booking', { persona: 'grooming' }))
    ).toBe('grooming-booking');
    expect(
      resolveResumeScreen(bookingIntent('home-service-booking', { persona: 'sitter' }))
    ).toBe('pet-sitter-booking');
  });

  it('does not classify WPay or Ecommerce as appointment', () => {
    expect(
      isGuestAppointmentJourney({
        v: 1,
        savedAt: Date.now(),
        kind: 'pay_bill',
        returnPath: '/warmpawz-pay/vendors/v1',
        resumeScreen: 'warmpawz-pay-vendor',
      })
    ).toBe(false);
    expect(
      isGuestAppointmentJourney({
        v: 1,
        savedAt: Date.now(),
        kind: 'cart',
        returnPath: '/checkout',
        resumeScreen: 'checkout',
      })
    ).toBe(false);
  });
});

describe('post-auth / post-profile priority', () => {
  const originalProfile = localStorage.getItem('profile_completed');

  afterEach(() => {
    if (originalProfile == null) localStorage.removeItem('profile_completed');
    else localStorage.setItem('profile_completed', originalProfile);
    finishGuestJourneyRestore();
  });

  it('existing customer login keeps the intended booking return path', () => {
    localStorage.setItem('profile_completed', 'true');
    expect(resolvePostAuthRedirectPath('/')).toBe('/');
  });

  it('new customer login goes to profile before restore', () => {
    localStorage.setItem('profile_completed', 'false');
    expect(resolvePostAuthRedirectPath('/')).toBe('/profile');
  });

  it('profile complete restores appointment returnPath instead of forcing Home', () => {
    saveGuestBookingIntent({
      kind: 'booking',
      returnPath: '/',
      resumeScreen: 'vet-booking',
      vendorId: 'vendor-1',
      date: '2026-08-21',
      time: '17:00',
    });
    expect(resolvePostProfileRedirectPath(null)).toBe('/');
    const taken = beginGuestJourneyRestore();
    expect(taken?.resumeScreen).toBe('vet-booking');
    expect(beginGuestJourneyRestore()).toBeNull();
  });

  it('profile complete keeps Ecommerce next=/checkout over appointment Home', () => {
    expect(resolvePostProfileRedirectPath('/checkout')).toBe('/checkout');
  });
});
