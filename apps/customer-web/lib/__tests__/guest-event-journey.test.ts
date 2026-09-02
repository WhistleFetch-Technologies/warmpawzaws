/**
 * @jest-environment jsdom
 */

import {
  clearGuestBookingIntent,
  guestJourneyPriority,
  isGuestAppointmentJourney,
  readGuestBookingIntent,
  saveGuestBookingIntent,
  transactionRequiresPet,
} from '../guest-booking-intent';
import { requestGuestAuthForEventBook } from '../guest-auth-gate';
import { resolveGuestPublicApiPath } from '../guest-public-api-path';

jest.mock('../session-utils', () => ({
  getStoredCustomerJwtForSession: () => null,
  isTokenExpired: () => true,
}));

jest.mock('../guest-browsing-flag', () => ({
  isGuestBrowsingEnabled: () => true,
}));

describe('guest event journey', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    clearGuestBookingIntent();
  });

  it('persists event booking intent and requires pets', () => {
    saveGuestBookingIntent({
      kind: 'event',
      returnPath: '/events/11111111-1111-1111-1111-111111111111/book',
      requiresPet: true,
      funnelStarted: 'booking',
    });
    const intent = readGuestBookingIntent();
    expect(intent?.kind).toBe('event');
    expect(transactionRequiresPet(intent)).toBe(true);
    expect(isGuestAppointmentJourney(intent)).toBe(false);
    expect(guestJourneyPriority(intent)).toBe(36);
  });

  it('does not treat event as a marketplace appointment restore', () => {
    saveGuestBookingIntent({
      kind: 'event',
      returnPath: '/events/11111111-1111-1111-1111-111111111111/book',
      resumeScreen: 'vet-booking',
    });
    expect(isGuestAppointmentJourney(readGuestBookingIntent())).toBe(false);
  });

  it('opens guest auth for Event book', () => {
    const opened = requestGuestAuthForEventBook({
      eventId: '11111111-1111-1111-1111-111111111111',
    });
    expect(opened).toBe(true);
    expect(readGuestBookingIntent()?.kind).toBe('event');
    expect(readGuestBookingIntent()?.returnPath).toContain('/events/');
  });

  it('rewrites public Event discovery and detail only', () => {
    expect(resolveGuestPublicApiPath('/events/discover?city=Bengaluru')).toBe(
      '/public/events/discover?city=Bengaluru'
    );
    expect(
      resolveGuestPublicApiPath('/events/11111111-1111-1111-1111-111111111111')
    ).toBe('/public/events/11111111-1111-1111-1111-111111111111');
    expect(resolveGuestPublicApiPath('/events/my-registrations')).toBe('/events/my-registrations');
    expect(
      resolveGuestPublicApiPath('/events/11111111-1111-1111-1111-111111111111/register')
    ).toBe('/events/11111111-1111-1111-1111-111111111111/register');
  });
});
