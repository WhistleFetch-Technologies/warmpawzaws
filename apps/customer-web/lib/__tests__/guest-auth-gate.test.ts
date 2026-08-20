/**
 * @jest-environment jsdom
 */

jest.mock('../guest-browsing-flag', () => ({
  isGuestBrowsingEnabled: jest.fn(() => true),
}));

import { isGuestBrowsingEnabled } from '../guest-browsing-flag';
import {
  registerGuestAuthModalOpener,
  requestGuestAuth,
  requestGuestAuthForWpayPay,
  requestGuestAuthForWpayVendor,
} from '../guest-auth-gate';
import {
  GUEST_BOOKING_INTENT_KEY,
  readGuestBookingIntent,
} from '../guest-booking-intent';

describe('requestGuestAuth', () => {
  beforeEach(() => {
    sessionStorage.clear();
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

  it('requestGuestAuthForWpayPay stores entered amount and does not require a pet', () => {
    const opener = jest.fn();
    registerGuestAuthModalOpener(opener);
    localStorage.clear();

    const blocked = requestGuestAuthForWpayPay({ vendorId: 'vendor-1', amount: 1000 });

    expect(blocked).toBe(true);
    const intent = readGuestBookingIntent();
    expect(intent?.kind).toBe('pay_bill');
    expect(intent?.price).toBe(1000);
    expect(intent?.vendorId).toBe('vendor-1');
    expect(intent?.requiresPet).toBe(false);
    expect(intent?.returnPath).toBe('/warmpawz-pay/vendors/vendor-1');
  });
});
