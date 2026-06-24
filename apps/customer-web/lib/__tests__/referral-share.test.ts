import {
  buildReferralInviteUrl,
  detectMobileDeviceKind,
  getCustomerAndroidStoreUrl,
  getCustomerIosStoreUrl,
  getReferralInviteBaseUrl,
  normalizeReferralCode,
  redirectToStoreByUserAgent,
  resolveStoreRedirectUrl,
} from '../referral-share';

describe('referral-share', () => {
  it('normalizes referral codes to uppercase trimmed', () => {
    expect(normalizeReferralCode(' warm123 ')).toBe('WARM123');
    expect(normalizeReferralCode('Warm123')).toBe('WARM123');
  });

  it('builds /r/ share URLs with normalized code', () => {
    const url = buildReferralInviteUrl('warm123');
    expect(url).toMatch(/\/r\/WARM123$/);
    expect(url).not.toContain('/invite/');
  });

  it('detects mobile device kind from user agent', () => {
    expect(detectMobileDeviceKind('Mozilla/5.0 (Linux; Android 13)')).toBe('android');
    expect(detectMobileDeviceKind('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios');
    expect(detectMobileDeviceKind('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('desktop');
  });

  it('resolves store URLs by platform', () => {
    expect(resolveStoreRedirectUrl('Android')).toBe(getCustomerAndroidStoreUrl());
    expect(resolveStoreRedirectUrl('iPhone')).toBe(getCustomerIosStoreUrl());
    expect(resolveStoreRedirectUrl('Windows')).toBe(getReferralInviteBaseUrl());
  });

  it('uses updated default store listing URLs', () => {
    expect(getCustomerAndroidStoreUrl()).toContain('com.warmpawz.customer');
    expect(getCustomerIosStoreUrl()).toContain('id6761255735');
  });

  it('redirectToStoreByUserAgent replaces location and schedules fallback', () => {
    const replace = jest.fn();
    const setTimeoutFn = jest.fn((_fn: () => void, _ms: number) => 99);
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { replace },
    });
    Object.defineProperty(window, 'navigator', {
      configurable: true,
      value: { userAgent: 'Android' },
    });
    jest.spyOn(global, 'setTimeout').mockImplementation(setTimeoutFn as typeof setTimeout);

    redirectToStoreByUserAgent();

    expect(replace).toHaveBeenCalledWith(getCustomerAndroidStoreUrl());
    expect(setTimeoutFn).toHaveBeenCalledWith(expect.any(Function), 3000);
  });
});
