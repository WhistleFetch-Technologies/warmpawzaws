import { buildAuthUrlWithReturn, resolveSafeAuthReturnPath } from '../auth-redirect';

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

  it('buildAuthUrlWithReturn uses redirect param', () => {
    expect(buildAuthUrlWithReturn('/cart')).toBe('/auth?redirect=%2Fcart');
  });
});
