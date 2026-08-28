import {
  WPAY_HISTORY_BACK_INTENT_KEY,
  WARMPAWZ_OPEN_ACCOUNT_MENU_KEY,
  handleWpayHistoryPageBack,
  rememberBeforeWpayHistoryNav,
  rememberWpayHistoryBackFromAccountMenu,
} from '../go-back-or-replace';

describe('Warmpawz Pay History back navigation', () => {
  const push = jest.fn();
  const replace = jest.fn();
  const back = jest.fn();
  const router = { push, replace, back };

  beforeEach(() => {
    push.mockClear();
    replace.mockClear();
    back.mockClear();
    sessionStorage.clear();
  });

  it('rememberWpayHistoryBackFromAccountMenu stores account-menu intent', () => {
    rememberWpayHistoryBackFromAccountMenu();
    expect(sessionStorage.getItem(WPAY_HISTORY_BACK_INTENT_KEY)).toBe(
      JSON.stringify({ kind: 'account-menu' })
    );
  });

  it('rememberBeforeWpayHistoryNav uses path intent off Pay hub', () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/warmpawz-pay', search: '', href: 'http://localhost/warmpawz-pay' },
      writable: true,
      configurable: true,
    });
    rememberBeforeWpayHistoryNav();
    expect(sessionStorage.getItem(WPAY_HISTORY_BACK_INTENT_KEY)).toBe(
      JSON.stringify({ kind: 'path', path: '/warmpawz-pay' })
    );
  });

  it('handleWpayHistoryPageBack with account-menu opens profile menu and goes home', () => {
    rememberWpayHistoryBackFromAccountMenu();
    handleWpayHistoryPageBack(router);
    expect(push).toHaveBeenCalledWith('/');
    expect(sessionStorage.getItem(WARMPAWZ_OPEN_ACCOUNT_MENU_KEY)).toBe('1');
    expect(sessionStorage.getItem(WPAY_HISTORY_BACK_INTENT_KEY)).toBeNull();
  });

  it('handleWpayHistoryPageBack with path intent returns to prior route', () => {
    sessionStorage.setItem(
      WPAY_HISTORY_BACK_INTENT_KEY,
      JSON.stringify({ kind: 'path', path: '/warmpawz-pay' })
    );
    handleWpayHistoryPageBack(router);
    expect(push).toHaveBeenCalledWith('/warmpawz-pay');
    expect(sessionStorage.getItem(WARMPAWZ_OPEN_ACCOUNT_MENU_KEY)).toBeNull();
  });
});
