/**
 * @jest-environment jsdom
 */

import { hasAuthenticatedCustomerSession, isGuestApplicationState } from '../guest-auth-gate';
import { hasCustomerAppSession } from '../customer-id-storage';
import { isTokenExpired } from '../session-utils';

function makeJwt(expOffsetSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expOffsetSeconds })
  ).toString('base64url');
  return `${header}.${payload}.sig`;
}

describe('canonical customer session predicates', () => {
  const originalBrowse = process.env.NEXT_PUBLIC_GUEST_BROWSING_ENABLED;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    process.env.NEXT_PUBLIC_GUEST_BROWSING_ENABLED = 'true';
    delete (window as unknown as { __WARMPAWZ_RUNTIME_CONFIG__?: unknown }).__WARMPAWZ_RUNTIME_CONFIG__;
  });

  afterEach(() => {
    if (originalBrowse === undefined) delete process.env.NEXT_PUBLIC_GUEST_BROWSING_ENABLED;
    else process.env.NEXT_PUBLIC_GUEST_BROWSING_ENABLED = originalBrowse;
  });

  it('no token + no phone is Guest', () => {
    expect(hasAuthenticatedCustomerSession()).toBe(false);
    expect(hasCustomerAppSession()).toBe(false);
    expect(isGuestApplicationState()).toBe(true);
  });

  it('phone only is Guest', () => {
    localStorage.setItem('customerPhone', '9999990001');
    expect(hasAuthenticatedCustomerSession()).toBe(false);
    expect(hasCustomerAppSession()).toBe(false);
    expect(isGuestApplicationState()).toBe(true);
  });

  it('expired JWT + phone without refresh is Guest', () => {
    const expired = makeJwt(-120);
    expect(isTokenExpired(expired)).toBe(true);
    localStorage.setItem('customerPhone', '9999990001');
    localStorage.setItem('authToken', expired);
    expect(hasAuthenticatedCustomerSession()).toBe(false);
    expect(isGuestApplicationState()).toBe(true);
  });

  it('expired access token + valid refresh window is Customer', () => {
    const expired = makeJwt(-120);
    localStorage.setItem('customerPhone', '9999990001');
    localStorage.setItem('authToken', expired);
    localStorage.setItem('customerCognitoTokens', JSON.stringify({ refreshToken: 'r' }));
    localStorage.setItem('customerRefreshTokenExpiry', String(Date.now() + 60_000));
    expect(hasAuthenticatedCustomerSession()).toBe(true);
    expect(isGuestApplicationState()).toBe(false);
  });

  it('valid token + phone is Customer', () => {
    const valid = makeJwt(3600);
    expect(isTokenExpired(valid)).toBe(false);
    localStorage.setItem('customerPhone', '9999990001');
    localStorage.setItem('authToken', valid);
    expect(hasAuthenticatedCustomerSession()).toBe(true);
    expect(hasCustomerAppSession()).toBe(true);
    expect(isGuestApplicationState()).toBe(false);
  });
});
