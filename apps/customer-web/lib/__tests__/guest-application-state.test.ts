/**
 * @jest-environment jsdom
 */

const getJwt = jest.fn(() => null as string | null);

jest.mock('../session-utils', () => ({
  getStoredCustomerJwtForSession: () => getJwt(),
  isTokenExpired: (token: string | null) => !token,
}));

jest.mock('../allyticas-ingest', () => ({
  enqueueAllyticasEvent: jest.fn(),
}));

import { hasAuthenticatedCustomerSession, isGuestApplicationState } from '../guest-auth-gate';

describe('guest application state', () => {
  const originalBrowse = process.env.NEXT_PUBLIC_GUEST_BROWSING_ENABLED;

  afterEach(() => {
    if (originalBrowse === undefined) {
      delete process.env.NEXT_PUBLIC_GUEST_BROWSING_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_GUEST_BROWSING_ENABLED = originalBrowse;
    }
    localStorage.clear();
    getJwt.mockReturnValue(null);
    delete (window as unknown as { __WARMPAWZ_RUNTIME_CONFIG__?: unknown }).__WARMPAWZ_RUNTIME_CONFIG__;
  });

  it('does not treat missing phone alone as guest when browsing is off', () => {
    delete process.env.NEXT_PUBLIC_GUEST_BROWSING_ENABLED;
    expect(isGuestApplicationState()).toBe(false);
    expect(hasAuthenticatedCustomerSession()).toBe(false);
  });

  it('is guest when browsing is enabled and there is no phone+JWT session', () => {
    process.env.NEXT_PUBLIC_GUEST_BROWSING_ENABLED = 'true';
    expect(isGuestApplicationState()).toBe(true);
  });

  it('is not guest when phone and JWT are present', () => {
    process.env.NEXT_PUBLIC_GUEST_BROWSING_ENABLED = 'true';
    localStorage.setItem('customerPhone', '9999999999');
    getJwt.mockReturnValue('jwt');
    expect(hasAuthenticatedCustomerSession()).toBe(true);
    expect(isGuestApplicationState()).toBe(false);
  });
});
