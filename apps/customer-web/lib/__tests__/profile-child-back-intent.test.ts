import {
  consumePendingSpaResumeScreen,
  handleProfileChildPageBack,
  handleSetPasswordPageBack,
  rememberOrdersBackToSpaScreen,
  rememberProfileChildBackFromCurrentUrl,
  rememberProfileChildBackToSpaScreen,
  WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY,
} from '@/lib/go-back-or-replace';

describe('profile child back intent', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, '', '/profile');
  });

  it('remembers spa screen and restores via handleProfileChildPageBack', () => {
    window.history.replaceState({}, '', '/');
    rememberProfileChildBackToSpaScreen('customer-profile');
    const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };

    handleProfileChildPageBack(router);

    expect(sessionStorage.getItem(WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY)).toBe('customer-profile');
    expect(router.push).toHaveBeenCalledWith('/');
  });

  it('remembers /profile path and pushes it on back', () => {
    rememberProfileChildBackFromCurrentUrl();
    const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };

    handleProfileChildPageBack(router);

    expect(router.push).toHaveBeenCalledWith('/profile');
  });

  it('consumePendingSpaResumeScreen returns orders or profile spa screen', () => {
    rememberOrdersBackToSpaScreen('customer-profile');
    expect(consumePendingSpaResumeScreen()).toBe('customer-profile');
    expect(consumePendingSpaResumeScreen()).toBeNull();
  });

  it('handleSetPasswordPageBack prefers profile child intent', () => {
    rememberProfileChildBackToSpaScreen('customer-profile');
    const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
    handleSetPasswordPageBack(router);
    expect(router.push).toHaveBeenCalledWith('/');
  });
});
