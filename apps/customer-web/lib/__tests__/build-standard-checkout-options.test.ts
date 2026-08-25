import { describe, expect, test } from '@jest/globals';
import {
  buildSanitizedStandardRazorpayCheckoutOptions,
  WARMPAWZ_RAZORPAY_CHECKOUT_THEME,
} from '@/lib/razorpay/build-standard-checkout-options';

describe('buildSanitizedStandardRazorpayCheckoutOptions', () => {
  const minimalInput = {
    key: 'rzp_test_key',
    amountPaise: 10000,
    description: 'Test payment',
    handler: () => {},
  };

  test('exports shared checkout theme with hide_topbar enabled', () => {
    expect(WARMPAWZ_RAZORPAY_CHECKOUT_THEME).toEqual({
      color: '#FF8C42',
      hide_topbar: true,
    });
  });

  test('always sets theme.hide_topbar true by default', () => {
    const options = buildSanitizedStandardRazorpayCheckoutOptions(minimalInput);
    expect(options.theme).toEqual({
      color: '#FF8C42',
      hide_topbar: true,
    });
  });

  test('builds minimal Standard Checkout without UPI blocks or invented email', () => {
    const options = buildSanitizedStandardRazorpayCheckoutOptions({
      ...minimalInput,
      amountPaise: 2302920,
      customerPhone: '7204349299',
    });
    expect(options.amount).toBe(2302920);
    expect(options.method).toBeUndefined();
    expect(options.config).toBeUndefined();
    expect(options.prefill).toEqual({ contact: '+917204349299' });
    expect(options.prefill.email).toBeUndefined();
  });

  test('prefills a real profile email and does not invent one', () => {
    const withEmail = buildSanitizedStandardRazorpayCheckoutOptions({
      ...minimalInput,
      customerPhone: '7204349299',
      customerEmail: 'owner@example.com',
    });
    expect(withEmail.prefill.email).toBe('owner@example.com');

    const phoneOnly = buildSanitizedStandardRazorpayCheckoutOptions({
      ...minimalInput,
      customerPhone: '7204349299',
    });
    expect(phoneOnly.prefill.email).toBeUndefined();
  });

  test('preserves caller theme overrides while forcing hide_topbar true', () => {
    const options = buildSanitizedStandardRazorpayCheckoutOptions({
      ...minimalInput,
      theme: {
        color: '#FF8C42',
        backdrop_color: 'rgba(0,0,0,0.7)',
      },
    });
    expect(options.theme).toEqual({
      color: '#FF8C42',
      backdrop_color: 'rgba(0,0,0,0.7)',
      hide_topbar: true,
    });
  });
});
