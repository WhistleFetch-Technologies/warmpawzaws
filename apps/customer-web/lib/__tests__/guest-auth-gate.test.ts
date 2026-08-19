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
});
