import {
  attemptAutoStoreRedirect,
  buildAndroidPlayStoreIntentUrl,
  buildReferralInviteUrl,
  detectMobileDeviceKind,
  getCustomerAndroidStoreUrl,
  getCustomerIosStoreUrl,
  getReferralInviteBaseUrl,
  normalizeReferralCode,
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

  it('builds Android Play Store intent with market scheme and https fallback', () => {
    const intent = buildAndroidPlayStoreIntentUrl();
    expect(intent).toContain('intent://details?id=com.warmpawz.customer');
    expect(intent).toContain('scheme=market');
    expect(intent).toContain(encodeURIComponent(getCustomerAndroidStoreUrl()));
  });

  it('attemptAutoStoreRedirect uses Android intent on mobile Android', () => {
    const replace = jest.fn();
    let href = '';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        get href() {
          return href;
        },
        set href(v: string) {
          href = v;
        },
        replace,
      },
    });
    Object.defineProperty(window, 'navigator', {
      configurable: true,
      value: { userAgent: 'Android' },
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });

    attemptAutoStoreRedirect();

    expect(href).toContain('intent://details?id=com.warmpawz.customer');
    expect(replace).not.toHaveBeenCalled();
  });

  it('attemptAutoStoreRedirect sends desktop users to customer home', () => {
    const replace = jest.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { replace, href: '' },
    });
    Object.defineProperty(window, 'navigator', {
      configurable: true,
      value: { userAgent: 'Windows NT 10.0' },
    });

    attemptAutoStoreRedirect();

    expect(replace).toHaveBeenCalledWith(getReferralInviteBaseUrl());
  });
});
