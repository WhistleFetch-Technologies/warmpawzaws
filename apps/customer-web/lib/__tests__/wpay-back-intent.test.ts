/** @jest-environment jsdom */

import {
  WPAY_BACK_INTENT_KEY,
  WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY,
  WARMPAWZ_SHELL_SCREEN_KEY,
  handleWpayPageBack,
  isWpayVendorPayPath,
  persistShellScreen,
  rememberWpayBackBeforeLeave,
} from '../go-back-or-replace';

describe('Warmpawz Pay service back navigation', () => {
  const push = jest.fn();
  const replace = jest.fn();
  const back = jest.fn();
  const router = { push, replace, back };

  beforeEach(() => {
    push.mockClear();
    replace.mockClear();
    back.mockClear();
    sessionStorage.clear();
    Object.defineProperty(window, 'location', {
      value: { pathname: '/', search: '', href: 'http://localhost/' },
      writable: true,
      configurable: true,
    });
  });

  it('rememberWpayBackBeforeLeave stores the service shell screen from /', () => {
    persistShellScreen('vet');
    rememberWpayBackBeforeLeave({ serviceKey: 'grooming' });
    expect(sessionStorage.getItem(WPAY_BACK_INTENT_KEY)).toBe(
      JSON.stringify({ kind: 'spa', screen: 'vet' }),
    );
  });

  it('rememberWpayBackBeforeLeave falls back to serviceKey when no persisted screen', () => {
    rememberWpayBackBeforeLeave({ serviceKey: 'vet' });
    expect(sessionStorage.getItem(WPAY_BACK_INTENT_KEY)).toBe(
      JSON.stringify({ kind: 'spa', screen: 'vet' }),
    );
  });

  it('handleWpayPageBack restores the service screen instead of home', () => {
    sessionStorage.setItem(
      WPAY_BACK_INTENT_KEY,
      JSON.stringify({ kind: 'spa', screen: 'vet' }),
    );
    handleWpayPageBack(router);
    expect(replace).toHaveBeenCalledWith('/');
    expect(sessionStorage.getItem(WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY)).toBe('vet');
    expect(sessionStorage.getItem(WPAY_BACK_INTENT_KEY)).toBeNull();
    expect(push).not.toHaveBeenCalledWith('/');
  });

  it('vendor Pay Bill page returns to the vendor list without consuming home intent', () => {
    sessionStorage.setItem(
      WPAY_BACK_INTENT_KEY,
      JSON.stringify({ kind: 'spa', screen: 'home' }),
    );
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/warmpawz-pay/vendors/placeholder',
        search: '?vendorId=v-1',
        href: 'http://localhost/warmpawz-pay/vendors/placeholder?vendorId=v-1',
      },
      writable: true,
      configurable: true,
    });
    handleWpayPageBack(router);
    expect(back).toHaveBeenCalled();
    expect(sessionStorage.getItem(WPAY_BACK_INTENT_KEY)).toBe(
      JSON.stringify({ kind: 'spa', screen: 'home' }),
    );
    expect(replace).not.toHaveBeenCalledWith('/');
    expect(sessionStorage.getItem(WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY)).toBeNull();
  });

  it('isWpayVendorPayPath matches vendor pay URLs only', () => {
    expect(isWpayVendorPayPath('/warmpawz-pay/vendors/placeholder')).toBe(true);
    expect(isWpayVendorPayPath('/warmpawz-pay')).toBe(false);
    expect(isWpayVendorPayPath('/warmpawz-pay/history')).toBe(false);
  });

  it('persistShellScreen writes the current hub', () => {
    persistShellScreen('grooming');
    expect(sessionStorage.getItem(WARMPAWZ_SHELL_SCREEN_KEY)).toBe('grooming');
  });
});
