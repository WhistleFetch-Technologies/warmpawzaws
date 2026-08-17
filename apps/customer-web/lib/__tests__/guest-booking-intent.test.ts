/**
 * @jest-environment jsdom
 */

import {
  buildGuestAuthUrlForBooking,
  clearGuestBookingIntent,
  GUEST_BOOKING_INTENT_KEY,
  readGuestBookingIntent,
  saveGuestBookingIntent,
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
});
