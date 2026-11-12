import { describe, expect, it } from '@jest/globals';
import {
  PLATFORM_VENDOR_LEGAL_VERSION,
  VENDOR_LEGAL_ACCEPTANCE_SOURCE,
  isVendorAgreedToTerms,
} from '../vendor-legal-acceptance';

describe('vendor legal acceptance helpers', () => {
  it('exposes stable version + source', () => {
    expect(PLATFORM_VENDOR_LEGAL_VERSION).toBe('vendor_tos_privacy_onboarding_v1');
    expect(VENDOR_LEGAL_ACCEPTANCE_SOURCE).toBe('vendor_onboarding');
  });

  it('detects agreedToTerms truthy shapes', () => {
    expect(isVendorAgreedToTerms({ agreedToTerms: true })).toBe(true);
    expect(isVendorAgreedToTerms({ agreedToTerms: 'true' })).toBe(true);
    expect(isVendorAgreedToTerms({ agreedToTerms: false })).toBe(false);
    expect(isVendorAgreedToTerms({})).toBe(false);
    expect(isVendorAgreedToTerms(null)).toBe(false);
  });
});
