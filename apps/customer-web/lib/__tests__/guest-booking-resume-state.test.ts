/**
 * @jest-environment jsdom
 */

import {
  buildRestoredBookingState,
  clearGuestBookingIntent,
  persistGuestBookingIntentForAuth,
  readGuestBookingIntent,
  sanitizeGuestBookingNav,
  updateGuestBookingProgress,
  type GuestBookingIntentV1,
} from '../guest-booking-intent';
import { requestGuestAuthForProfileContinue } from '../guest-auth-gate';

function intent(partial: Partial<GuestBookingIntentV1>): GuestBookingIntentV1 {
  return { v: 1, savedAt: Date.now(), returnPath: '/', kind: 'booking', ...partial };
}

describe('guest booking resume state', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    clearGuestBookingIntent();
  });

  it('restores vendor name, selected services, fee and return screen from the saved nav', () => {
    const state = buildRestoredBookingState(
      intent({
        vendorId: 'v-ht',
        persona: 'vet',
        category: 'vet',
        serviceStyle: 'at_home',
        wapptMode: true,
        resumeScreen: 'vet-booking',
        bookingNav: {
          vendorId: 'v-ht',
          vendorName: 'Healing Tails',
          serviceStyle: 'at_home',
          category: 'vet',
          bookingMode: 'wappt_appointment',
          selectedServices: [{ id: 's1', name: 'General checkup' }],
          initialPrice: 99,
          returnScreen: 'wappt-vendor-profile',
        },
      }),
      null,
    );
    expect(state.vendorName).toBe('Healing Tails');
    expect(state.selectedServices).toEqual([{ id: 's1', name: 'General checkup' }]);
    expect(state.initialPrice).toBe(99);
    expect(state.returnScreen).toBe('wappt-vendor-profile');
    expect(state.bookingMode).toBe('wappt_appointment');
    expect(state.serviceStyle).toBe('at_home');
    expect(state.appointmentsMode).toBe(true);
  });

  it('writes the visit style, not the persona, into serviceType', () => {
    const state = buildRestoredBookingState(
      intent({ vendorId: 'v1', persona: 'vet', serviceStyle: 'at_home' }),
      null,
    );
    expect(state.serviceType).toBe('at_home');
    expect(state.category).toBe('vet');
  });

  it('keeps category-style serviceType for boarding, sitting and walker routers', () => {
    expect(buildRestoredBookingState(intent({ vendorId: 'v', persona: 'boarding' }), null).serviceType).toBe('boarding');
    expect(buildRestoredBookingState(intent({ vendorId: 'v', persona: 'sitter' }), null).serviceType).toBe('sitting');
    expect(buildRestoredBookingState(intent({ vendorId: 'v', persona: 'walker' }), null).serviceType).toBe('walking');
  });

  it('drops in-memory booking data that belongs to a different vendor', () => {
    const state = buildRestoredBookingState(
      intent({ vendorId: 'v-new', serviceStyle: 'at_center' }),
      { vendorId: 'v-old', vendorName: 'Old Clinic', selectedServices: [{ id: 'x' }], price: 500 },
    );
    expect(state.vendorId).toBe('v-new');
    expect(state.vendorName).toBeUndefined();
    expect(state.selectedServices).toBeUndefined();
    expect(state.price).toBeUndefined();
  });

  it('keeps in-memory booking data for the same vendor (modal login inside the booking screen)', () => {
    const state = buildRestoredBookingState(
      intent({ vendorId: 'v1', date: '2026-10-08', time: '10:00' }),
      { vendorId: 'v1', vendorName: 'Same Clinic', selectedServices: [{ id: 'a' }] },
    );
    expect(state.vendorName).toBe('Same Clinic');
    expect(state.selectedServices).toEqual([{ id: 'a' }]);
    expect(state.bookingDate).toBe('2026-10-08');
    expect(state.bookingTime).toBe('10:00');
  });

  it('persists the booking nav through the profile-continue guard', () => {
    requestGuestAuthForProfileContinue({
      persona: 'vet',
      category: 'vet',
      vendorId: 'v-ht',
      serviceStyle: 'at_home',
      resumeScreen: 'vet-booking',
      wapptMode: true,
      bookingNav: { vendorId: 'v-ht', vendorName: 'Healing Tails', initialPrice: 99 },
    });
    const saved = readGuestBookingIntent();
    expect(saved?.bookingNav?.vendorName).toBe('Healing Tails');
    expect(saved?.bookingNav?.initialPrice).toBe(99);
  });

  it('strips auth fields and oversized payloads from the booking nav', () => {
    expect(sanitizeGuestBookingNav({ vendorId: 'v', jwt: 'secret', phone: '999' })).toEqual({ vendorId: 'v' });
    expect(sanitizeGuestBookingNav({ blob: 'x'.repeat(30_000) })).toBeUndefined();
    expect(sanitizeGuestBookingNav(['not', 'an', 'object'])).toBeUndefined();
  });

  it('plain login (sidebar) saves nothing, so nothing is resumed after login', () => {
    updateGuestBookingProgress({ persona: 'nutrition' });
    const result = persistGuestBookingIntentForAuth({ returnPath: '/' });
    expect(result.kind).toBe('other');
    expect(readGuestBookingIntent()).toBeNull();
  });

  it('plain login does not overwrite a pending booking journey', () => {
    persistGuestBookingIntentForAuth({
      kind: 'booking',
      vendorId: 'v1',
      resumeScreen: 'grooming-booking',
      returnPath: '/',
    });
    persistGuestBookingIntentForAuth({ returnPath: '/' });
    const saved = readGuestBookingIntent();
    expect(saved?.resumeScreen).toBe('grooming-booking');
    expect(saved?.vendorId).toBe('v1');
  });
});
