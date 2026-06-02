import {
  MY_PACKAGES_BACK_INTENT_KEY,
  WARMPAWZ_OPEN_ACCOUNT_MENU_KEY,
  consumeOpenAccountMenuAfterNav,
  handleMyPackagesPageBack,
  rememberBeforeMyPackagesNav,
  rememberMyPackagesBackFromAccountMenu,
} from '../go-back-or-replace';

describe('My Packages back navigation', () => {
  const push = jest.fn();
  const replace = jest.fn();
  const router = { push, replace, back: jest.fn() };

  beforeEach(() => {
    push.mockClear();
    replace.mockClear();
    sessionStorage.clear();
  });

  it('rememberMyPackagesBackFromAccountMenu stores account-menu intent', () => {
    rememberMyPackagesBackFromAccountMenu();
    expect(sessionStorage.getItem(MY_PACKAGES_BACK_INTENT_KEY)).toBe(
      JSON.stringify({ kind: 'account-menu' })
    );
  });

  it('rememberBeforeMyPackagesNav uses path intent off home', () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/wallet', search: '', href: 'http://localhost/wallet' },
      writable: true,
      configurable: true,
    });
    rememberBeforeMyPackagesNav();
    expect(sessionStorage.getItem(MY_PACKAGES_BACK_INTENT_KEY)).toBe(
      JSON.stringify({ kind: 'path', path: '/wallet' })
    );
  });

  it('handleMyPackagesPageBack with account-menu opens menu flag and goes home', () => {
    rememberMyPackagesBackFromAccountMenu();
    handleMyPackagesPageBack(router);
    expect(push).toHaveBeenCalledWith('/');
    expect(sessionStorage.getItem(WARMPAWZ_OPEN_ACCOUNT_MENU_KEY)).toBe('1');
    expect(sessionStorage.getItem(MY_PACKAGES_BACK_INTENT_KEY)).toBeNull();
  });

  it('handleMyPackagesPageBack with path intent returns to prior route', () => {
    sessionStorage.setItem(
      MY_PACKAGES_BACK_INTENT_KEY,
      JSON.stringify({ kind: 'path', path: '/search' })
    );
    handleMyPackagesPageBack(router);
    expect(push).toHaveBeenCalledWith('/search');
    expect(sessionStorage.getItem(WARMPAWZ_OPEN_ACCOUNT_MENU_KEY)).toBeNull();
  });

  it('consumeOpenAccountMenuAfterNav returns true once', () => {
    sessionStorage.setItem(WARMPAWZ_OPEN_ACCOUNT_MENU_KEY, '1');
    expect(consumeOpenAccountMenuAfterNav()).toBe(true);
    expect(consumeOpenAccountMenuAfterNav()).toBe(false);
  });
});
