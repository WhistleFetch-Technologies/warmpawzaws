import { MY_PACKAGES_BACK_INTENT_KEY } from '../go-back-or-replace';
import { navigateFromStandaloneAccountMenu } from '../customer-account-sidebar-nav';

describe('navigateFromStandaloneAccountMenu', () => {
  beforeEach(() => {
    sessionStorage.clear();
    Object.defineProperty(window, 'location', {
      value: { pathname: '/', search: '', href: 'http://localhost/' },
      writable: true,
      configurable: true,
    });
  });

  it('routes profile menu actions to standalone pages', () => {
    const push = jest.fn();
    const router = { push } as { push: (url: string) => void };

    navigateFromStandaloneAccountMenu(router, 'home');
    expect(push).toHaveBeenLastCalledWith('/');

    navigateFromStandaloneAccountMenu(router, 'my-packages');
    expect(push).toHaveBeenLastCalledWith('/my-packages');
    expect(sessionStorage.getItem(MY_PACKAGES_BACK_INTENT_KEY)).toBe(
      JSON.stringify({ kind: 'account-menu' })
    );

    navigateFromStandaloneAccountMenu(router, 'wallet');
    expect(push).toHaveBeenLastCalledWith('/wallet');

    navigateFromStandaloneAccountMenu(router, 'account/orders');
    expect(push).toHaveBeenLastCalledWith('/orders');
  });
});
