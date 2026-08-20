/**
 * @jest-environment jsdom
 */

jest.mock('../guest-auth-gate', () => ({
  emitGuestAuthAnalytics: jest.fn(),
}));

import {
  GUEST_JOURNEY_BACKUP_KEY,
  GUEST_JOURNEY_TTL_MS,
  clearGuestBookingIntent,
  readGuestBookingIntent,
  saveGuestBookingIntent,
  transactionRequiresPet,
} from '../guest-booking-intent';

describe('transaction-specific pet rules', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    clearGuestBookingIntent();
  });

  it('does not require pet for Pay Bill', () => {
    expect(
      transactionRequiresPet({
        v: 1,
        savedAt: Date.now(),
        kind: 'pay_bill',
        returnPath: '/warmpawz-pay/vendors/v1',
        price: 1000,
      })
    ).toBe(false);
  });

  it('does not require pet for ecommerce cart', () => {
    expect(
      transactionRequiresPet({
        v: 1,
        savedAt: Date.now(),
        kind: 'cart',
        returnPath: '/checkout',
        requiresPet: false,
      })
    ).toBe(false);
  });

  it('does not require pet for WPay unless explicitly set', () => {
    expect(
      transactionRequiresPet({
        v: 1,
        savedAt: Date.now(),
        kind: 'booking',
        persona: 'vet',
        wapptMode: true,
        returnPath: '/',
      })
    ).toBe(false);
  });

  it('still requires pet for Nutritionist booking transactions', () => {
    expect(
      transactionRequiresPet({
        v: 1,
        savedAt: Date.now(),
        kind: 'booking',
        persona: 'nutrition',
        category: 'nutrition',
        returnPath: '/',
        resumeScreen: 'nutritionist-booking',
      })
    ).toBe(true);
  });

  it('requires pet for marketplace grooming booking', () => {
    expect(
      transactionRequiresPet({
        v: 1,
        savedAt: Date.now(),
        kind: 'booking',
        persona: 'grooming',
        returnPath: '/',
      })
    ).toBe(true);
  });

  it('requires pet only for explicit add-pet', () => {
    expect(
      transactionRequiresPet({
        v: 1,
        savedAt: Date.now(),
        kind: 'add_pet',
        returnPath: '/?open=add-pet',
      })
    ).toBe(true);
  });

  it('restores from localStorage backup when sessionStorage is empty', () => {
    saveGuestBookingIntent({
      kind: 'search',
      returnPath: '/search?q=grooming',
      search: { q: 'grooming', category: 'grooming' },
    });
    sessionStorage.clear();
    expect(localStorage.getItem(GUEST_JOURNEY_BACKUP_KEY)).toBeTruthy();
    const restored = readGuestBookingIntent();
    expect(restored?.search?.q).toBe('grooming');
    expect(restored?.kind).toBe('search');
  });

  it('expires snapshot after TTL', () => {
    saveGuestBookingIntent({
      kind: 'booking',
      returnPath: '/',
      vendorId: 'v1',
    });
    const raw = sessionStorage.getItem('warmpawz_guest_booking_intent_v1');
    const parsed = JSON.parse(String(raw));
    parsed.savedAt = Date.now() - GUEST_JOURNEY_TTL_MS - 1;
    sessionStorage.setItem('warmpawz_guest_booking_intent_v1', JSON.stringify(parsed));
    localStorage.clear();
    expect(readGuestBookingIntent()).toBeNull();
  });
});
