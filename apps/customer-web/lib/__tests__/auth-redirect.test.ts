import {
  buildAuthLoginUrl,
  buildAuthSignupUrl,
  buildAuthUrlWithReturn,
  resolveAuthModeFromParams,
  resolveSafeAuthReturnPath,
} from '../auth-redirect';

describe('resolveSafeAuthReturnPath', () => {
  it('prefers redirect over next', () => {
    expect(resolveSafeAuthReturnPath('redirect=/shop&next=/cart')).toBe('/shop');
  });

  it('accepts next when redirect missing', () => {
    expect(resolveSafeAuthReturnPath('next=/vendor/abc')).toBe('/vendor/abc');
  });

  it('rejects open redirects', () => {
    expect(resolveSafeAuthReturnPath('redirect=https://evil.com')).toBeNull();
    expect(resolveSafeAuthReturnPath('next=//evil.com')).toBeNull();
    expect(resolveSafeAuthReturnPath('redirect=javascript:alert(1)')).toBeNull();
  });

  it('buildAuthUrlWithReturn uses signup + redirect param', () => {
    expect(buildAuthUrlWithReturn('/cart')).toBe('/auth?signup=1&redirect=%2Fcart');
  });

  it('buildAuthSignupUrl adds signup flag', () => {
    expect(buildAuthSignupUrl('/add-pet')).toBe('/auth?signup=1&redirect=%2Fadd-pet');
  });

  it('buildAuthLoginUrl adds login flag', () => {
    expect(buildAuthLoginUrl('/')).toBe('/auth?login=1&redirect=%2F');
  });
});

describe('resolveAuthModeFromParams', () => {
  it('prefers login when login=1', () => {
    expect(resolveAuthModeFromParams(new URLSearchParams('login=1&redirect=/'))).toBe('login');
  });

  it('uses signup when signup=1', () => {
    expect(resolveAuthModeFromParams(new URLSearchParams('signup=1'))).toBe('signup');
  });

  it('defaults signup when redirect present without login=1', () => {
    expect(resolveAuthModeFromParams(new URLSearchParams('redirect=/cart'))).toBe('signup');
  });

  it('defaults login on bare auth', () => {
    expect(resolveAuthModeFromParams(new URLSearchParams(''))).toBe('login');
  });

  it('uses signup for referral ref', () => {
    expect(resolveAuthModeFromParams(new URLSearchParams('ref=ABC'))).toBe('signup');
  });
});
