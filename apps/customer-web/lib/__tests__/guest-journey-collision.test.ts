/**
 * @jest-environment jsdom
 */

jest.mock('../allyticas-ingest', () => ({
  enqueueAllyticasEvent: jest.fn(),
}));

import {
  persistGuestBookingIntentForAuth,
  readGuestBookingIntent,
  saveGuestBookingIntent,
  saveGuestBookingIntentUnlessLowerPriority,
  shouldReplaceGuestJourney,
  isGuestAppointmentJourney,
  clearGuestBookingIntent,
} from '../guest-booking-intent';
import {
  registerGuestAuthModalOpener,
  requestGuestAuthForBooking,
  requestGuestAuthForCheckout,
  requestGuestAuthForInstantTele,
  requestGuestAuthForWpayPay,
} from '../guest-auth-gate';

describe('guest journey collision policy', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    clearGuestBookingIntent();
    registerGuestAuthModalOpener(jest.fn());
    process.env.NEXT_PUBLIC_GUEST_BROWSING_ENABLED = 'true';
  });

  it('does not let Instant Tele overwrite a pending appointment', () => {
    requestGuestAuthForBooking({
      kind: 'booking',
      persona: 'vet',
      vendorId: 'vet-1',
      date: '2026-08-21',
      time: '17:00',
      resumeScreen: 'vet-booking',
      returnPath: '/',
    });
    requestGuestAuthForInstantTele('/?service=tele');
    const intent = readGuestBookingIntent();
    expect(intent?.resumeScreen).toBe('vet-booking');
    expect(intent?.kind).toBe('booking');
    expect(isGuestAppointmentJourney(intent)).toBe(true);
  });

  it('does not let WPay overwrite a pending appointment', () => {
    requestGuestAuthForBooking({
      kind: 'booking',
      persona: 'grooming',
      vendorId: 'g-1',
      resumeScreen: 'grooming-booking',
      returnPath: '/',
    });
    requestGuestAuthForWpayPay({ vendorId: 'pay-1', amount: 500 });
    expect(readGuestBookingIntent()?.resumeScreen).toBe('grooming-booking');
    expect(readGuestBookingIntent()?.kind).toBe('booking');
  });

  it('does not let Ecommerce overwrite a pending appointment', () => {
    requestGuestAuthForBooking({
      kind: 'booking',
      persona: 'vet',
      resumeScreen: 'vet-booking',
      returnPath: '/',
    });
    requestGuestAuthForCheckout('/checkout');
    expect(readGuestBookingIntent()?.kind).toBe('booking');
    expect(readGuestBookingIntent()?.resumeScreen).toBe('vet-booking');
  });

  it('does not let Ecommerce overwrite pending WPay', () => {
    requestGuestAuthForWpayPay({ vendorId: 'pay-1', amount: 800 });
    requestGuestAuthForCheckout('/checkout');
    const intent = readGuestBookingIntent();
    expect(intent?.kind).toBe('pay_bill');
    expect(intent?.price).toBe(800);
  });

  it('search does not overwrite appointment', () => {
    saveGuestBookingIntent({
      kind: 'booking',
      resumeScreen: 'vet-booking',
      vendorId: 'vet-1',
      returnPath: '/',
    });
    const wrote = saveGuestBookingIntentUnlessLowerPriority({
      kind: 'search',
      returnPath: '/search?q=vet',
      requiresPet: false,
    });
    expect(wrote).toBe(false);
    expect(readGuestBookingIntent()?.kind).toBe('booking');
  });

  it('appointment may replace search', () => {
    saveGuestBookingIntent({ kind: 'search', returnPath: '/search?q=x' });
    persistGuestBookingIntentForAuth({
      kind: 'booking',
      resumeScreen: 'vet-booking',
      returnPath: '/',
    });
    expect(readGuestBookingIntent()?.kind).toBe('booking');
  });

  it('equal or higher incoming rank replaces existing', () => {
    expect(
      shouldReplaceGuestJourney(
        { v: 1, savedAt: Date.now(), kind: 'cart', returnPath: '/checkout' },
        { kind: 'pay_bill' }
      )
    ).toBe(true);
    expect(
      shouldReplaceGuestJourney(
        { v: 1, savedAt: Date.now(), kind: 'pay_bill', returnPath: '/warmpawz-pay' },
        { kind: 'cart' }
      )
    ).toBe(false);
  });
});
