import { navigateFromStandaloneAccountMenu } from '../customer-account-sidebar-nav';

describe('navigateFromStandaloneAccountMenu', () => {
  it('routes profile menu actions to standalone pages', () => {
    const push = jest.fn();
    const router = { push } as { push: (url: string) => void };

    navigateFromStandaloneAccountMenu(router, 'home');
    expect(push).toHaveBeenLastCalledWith('/');

    navigateFromStandaloneAccountMenu(router, 'my-packages');
    expect(push).toHaveBeenLastCalledWith('/my-packages');

    navigateFromStandaloneAccountMenu(router, 'wallet');
    expect(push).toHaveBeenLastCalledWith('/wallet');

    navigateFromStandaloneAccountMenu(router, 'account/orders');
    expect(push).toHaveBeenLastCalledWith('/orders');
  });
});
