/**
 * @jest-environment jsdom
 */

import {
  buildGuestAuthUrlForBooking,
  clearGuestBookingIntent,
  GUEST_BOOKING_INTENT_KEY,
  beginGuestJourneyRestore,
  isGuestAppointmentJourney,
  readGuestBookingIntent,
  resolveResumeScreen,
  saveGuestBookingIntent,
  stripAuthFromGuestJourneySnapshots,
  updateGuestBookingProgress,
} from '../guest-booking-intent';

describe('guest-booking-intent', () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearGuestBookingIntent();
  });

  it('saves and reads intent with TTL fields', () => {
    saveGuestBookingIntent({
      returnPath: '/',
      vendorId: 'v1',
      date: '2026-08-12',
      time: '21:00',
      resumeScreen: 'grooming-booking',
    });
    const intent = readGuestBookingIntent();
    expect(intent?.vendorId).toBe('v1');
    expect(intent?.time).toBe('21:00');
    expect(intent?.resumeScreen).toBe('grooming-booking');
  });

  it('merges progress into auth URL builder', () => {
    updateGuestBookingProgress({
      vendorId: 'v2',
      date: '2026-08-13',
      time: '09:00',
      resumeScreen: 'vet-booking',
    });
    const url = buildGuestAuthUrlForBooking({ returnPath: '/' });
    expect(url).toContain('/auth?signup=1&redirect=');
    const intent = readGuestBookingIntent();
    expect(intent?.vendorId).toBe('v2');
    expect(intent?.time).toBe('09:00');
    expect(sessionStorage.getItem(GUEST_BOOKING_INTENT_KEY)).toBeTruthy();
  });

  it('rejects open redirect via auth-redirect helper', () => {
    const url = buildGuestAuthUrlForBooking({
      returnPath: 'https://evil.example',
    });
    expect(url).toBe('/auth?signup=1&redirect=%2F');
  });

  it('stores appointment context without JWT or secrets', () => {
    saveGuestBookingIntent({
      kind: 'booking',
      persona: 'vet',
      category: 'vet',
      vendorId: 'vendor-1',
      serviceId: 'svc-1',
      serviceStyle: 'at_center',
      date: '2026-08-21',
      time: '17:00',
      slotId: 'slot-17',
      resumeScreen: 'vet-booking',
      returnPath: '/',
      requiresPet: false,
      wapptMode: true,
    });
    const intent = readGuestBookingIntent();
    expect(intent).toMatchObject({
      vendorId: 'vendor-1',
      serviceId: 'svc-1',
      date: '2026-08-21',
      time: '17:00',
      slotId: 'slot-17',
      resumeScreen: 'vet-booking',
      requiresPet: false,
      wapptMode: true,
    });
    const raw = JSON.stringify(intent);
    expect(raw).not.toMatch(/jwt|access_token|refresh_token|password|otp/i);
    expect(isGuestAppointmentJourney(intent)).toBe(true);
  });

  it('strips leaked auth fields without deleting the journey', () => {
    saveGuestBookingIntent({
      returnPath: '/',
      vendorId: 'vendor-1',
      date: '2026-08-21',
      time: '17:00',
      resumeScreen: 'vet-booking',
    });
    const raw = sessionStorage.getItem(GUEST_BOOKING_INTENT_KEY);
    sessionStorage.setItem(
      GUEST_BOOKING_INTENT_KEY,
      JSON.stringify({ ...JSON.parse(String(raw)), idToken: 'leaked', customerPhone: '999' })
    );
    stripAuthFromGuestJourneySnapshots();
    const intent = readGuestBookingIntent();
    expect(intent?.vendorId).toBe('vendor-1');
    expect(intent?.time).toBe('17:00');
    expect((intent as Record<string, unknown> | null)?.idToken).toBeUndefined();
    expect((intent as Record<string, unknown> | null)?.customerPhone).toBeUndefined();
  });

  it('maps scheduled Tele and Home Service resume aliases', () => {
    expect(
      resolveResumeScreen({
        v: 1,
        savedAt: Date.now(),
        returnPath: '/',
        resumeScreen: 'universal-provider-booking',
        serviceStyle: 'tele',
        persona: 'vet',
      })
    ).toBe('vet-tele-consultation');
    expect(
      resolveResumeScreen({
        v: 1,
        savedAt: Date.now(),
        returnPath: '/',
        resumeScreen: 'home-service-booking',
        persona: 'walker',
        category: 'walker',
      })
    ).toBe('walker-booking');
    expect(
      isGuestAppointmentJourney({
        v: 1,
        savedAt: Date.now(),
        kind: 'booking',
        returnPath: '/',
        resumeScreen: 'universal-provider-booking',
        serviceStyle: 'tele',
        persona: 'vet',
      })
    ).toBe(true);
  });

  it('consumes appointment restore exactly once', () => {
    saveGuestBookingIntent({
      kind: 'booking',
      returnPath: '/',
      resumeScreen: 'vet-booking',
      vendorId: 'v1',
      date: '2026-08-21',
      time: '17:00',
    });
    const first = beginGuestJourneyRestore();
    const second = beginGuestJourneyRestore();
    expect(first?.vendorId).toBe('v1');
    expect(second).toBeNull();
    expect(readGuestBookingIntent()?.vendorId).toBe('v1');
  });

  it('does not treat WPay as an appointment journey', () => {
    expect(
      isGuestAppointmentJourney({
        v: 1,
        savedAt: Date.now(),
        kind: 'pay_bill',
        vendorId: 'v1',
        returnPath: '/warmpawz-pay/vendors/v1',
        resumeScreen: 'warmpawz-pay-vendor',
      })
    ).toBe(false);
  });
});
