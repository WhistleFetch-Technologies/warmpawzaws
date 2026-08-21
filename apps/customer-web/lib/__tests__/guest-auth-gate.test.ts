/**
 * @jest-environment jsdom
 */

const getJwt = jest.fn(() => null as string | null);

jest.mock('../session-utils', () => ({
  getStoredCustomerJwtForSession: () => getJwt(),
}));

jest.mock('../guest-browsing-flag', () => ({
  isGuestBrowsingEnabled: jest.fn(() => true),
}));

jest.mock('../allyticas-ingest', () => ({
  enqueueAllyticasEvent: jest.fn(),
}));

import { isGuestBrowsingEnabled } from '../guest-browsing-flag';
import {
  registerGuestAuthModalOpener,
  requestGuestAuth,
  requestGuestAuthForBooking,
  requestGuestAuthForEcommerceAdd,
  requestGuestAuthForWpayVendor,
} from '../guest-auth-gate';
import {
  GUEST_BOOKING_INTENT_KEY,
  readGuestBookingIntent,
} from '../guest-booking-intent';

describe('requestGuestAuth', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    getJwt.mockReturnValue(null);
    registerGuestAuthModalOpener(null);
    (isGuestBrowsingEnabled as jest.Mock).mockReturnValue(true);
    delete (window as { location?: Location }).location;
    window.location = { href: '' } as Location;
  });

  it('opens modal when guest browsing is enabled and opener is registered', () => {
    const opener = jest.fn();
    registerGuestAuthModalOpener(opener);

    requestGuestAuth({
      mode: 'signup',
      returnPath: '/?open=add-pet',
      resumeScreen: 'add-pet',
      openAddPet: true,
    });

    expect(opener).toHaveBeenCalledWith({
      mode: 'signup',
      returnPath: '/?open=add-pet',
      resumeScreen: 'add-pet',
      openAddPet: true,
    });
    expect(window.location.href).toBe('');
    expect(readGuestBookingIntent()?.resumeScreen).toBe('add-pet');
    expect(sessionStorage.getItem(GUEST_BOOKING_INTENT_KEY)).toBeTruthy();
  });

  it('falls back to full-page /auth when modal opener is unavailable', () => {
    requestGuestAuth({ mode: 'login', returnPath: '/cart' });
    expect(window.location.href).toBe('/auth?login=1&redirect=%2Fcart');
  });

  it('falls back to full-page /auth when guest browsing is disabled', () => {
    (isGuestBrowsingEnabled as jest.Mock).mockReturnValue(false);
    const opener = jest.fn();
    registerGuestAuthModalOpener(opener);

    requestGuestAuth({ mode: 'signup', returnPath: '/add-pet' });

    expect(opener).not.toHaveBeenCalled();
    expect(window.location.href).toBe('/auth?signup=1&redirect=%2Fadd-pet');
  });

  it('requestGuestAuthForBooking persists appointment slot context', () => {
    const opener = jest.fn();
    registerGuestAuthModalOpener(opener);

    const blocked = requestGuestAuthForBooking({
      kind: 'booking',
      persona: 'vet',
      category: 'vet',
      vendorId: 'vendor-1',
      serviceId: 'svc-1',
      serviceStyle: 'at_center',
      date: '2026-08-21',
      time: '17:00',
      slotId: 'slot-17',
      wapptMode: true,
      requiresPet: false,
      returnPath: '/',
      resumeScreen: 'vet-booking',
    });

    expect(blocked).toBe(true);
    expect(opener).toHaveBeenCalled();
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
    expect(JSON.stringify(intent)).not.toMatch(/jwt|access_token|refreshToken|password/i);
  });

  it('requestGuestAuthForWpayVendor opens the modal with the vendor return path', () => {
    const opener = jest.fn();
    registerGuestAuthModalOpener(opener);
    localStorage.clear();

    const blocked = requestGuestAuthForWpayVendor('vendor-1');

    expect(blocked).toBe(true);
    expect(opener).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'signup',
        returnPath: '/warmpawz-pay/vendors/vendor-1',
        resumeScreen: 'warmpawz-pay-vendor',
      }),
    );
  });
});

describe('requestGuestAuthForEcommerceAdd', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    getJwt.mockReturnValue(null);
    registerGuestAuthModalOpener(null);
    (isGuestBrowsingEnabled as jest.Mock).mockReturnValue(true);
    delete (window as { location?: Location }).location;
    window.location = { href: '' } as Location;
  });

  it('allows guest add when guest browsing is enabled', () => {
    const opener = jest.fn();
    registerGuestAuthModalOpener(opener);

    const blocked = requestGuestAuthForEcommerceAdd('/shop');

    expect(blocked).toBe(false);
    expect(opener).not.toHaveBeenCalled();
  });

  it('allows pharmacy guest add when guest browsing is enabled', () => {
    const opener = jest.fn();
    registerGuestAuthModalOpener(opener);

    const blocked = requestGuestAuthForEcommerceAdd('/pharmacy');

    expect(blocked).toBe(false);
    expect(opener).not.toHaveBeenCalled();
  });

  it('prompts login before add when guest browsing is disabled', () => {
    (isGuestBrowsingEnabled as jest.Mock).mockReturnValue(false);

    const blocked = requestGuestAuthForEcommerceAdd('/shop');

    expect(blocked).toBe(true);
    expect(window.location.href).toBe('/auth?signup=1&redirect=%2Fshop');
  });

  it('allows add when customer session is authenticated', () => {
    localStorage.setItem('customerPhone', '9999999999');
    getJwt.mockReturnValue('jwt');
    const opener = jest.fn();
    registerGuestAuthModalOpener(opener);

    const blocked = requestGuestAuthForEcommerceAdd('/shop');

    expect(blocked).toBe(false);
    expect(opener).not.toHaveBeenCalled();
  });
});
