/**
 * @jest-environment jsdom
 */
import {
  ECOMMERCE_LAUNCH_POPUP_SESSION_KEY,
  hasSeenEcommerceLaunchPopup,
  markEcommerceLaunchPopupSeen,
} from '../ecommerce-launch-promo';

describe('ecommerce-launch-promo session', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('is unseen by default', () => {
    expect(hasSeenEcommerceLaunchPopup()).toBe(false);
  });

  it('marks seen for the rest of the session', () => {
    markEcommerceLaunchPopupSeen();
    expect(sessionStorage.getItem(ECOMMERCE_LAUNCH_POPUP_SESSION_KEY)).toBe('1');
    expect(hasSeenEcommerceLaunchPopup()).toBe(true);
  });
});
