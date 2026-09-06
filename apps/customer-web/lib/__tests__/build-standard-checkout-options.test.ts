import { describe, expect, test } from '@jest/globals';
import {
  buildSanitizedStandardRazorpayCheckoutOptions,
  WARMPAWZ_RAZORPAY_CHECKOUT_THEME,
} from '@/lib/razorpay/build-standard-checkout-options';
import { sanitizeRazorpayInstanceOptions } from '@/lib/razorpay/razorpay-utils';

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

  test('omits callback_url and redirect unless the caller sets them', () => {
    const options = buildSanitizedStandardRazorpayCheckoutOptions(minimalInput);
    expect(options.callback_url).toBeUndefined();
    expect(options.redirect).toBeUndefined();
    expect(options.method).toBeUndefined();
  });

  test('passes Pay Bill callback_url and redirect through the sanitizer', () => {
    const options = buildSanitizedStandardRazorpayCheckoutOptions({
      ...minimalInput,
      callback_url: 'https://app.example/warmpawz-pay/success?paymentId=pay_1',
      redirect: true,
    });
    expect(options.callback_url).toBe('https://app.example/warmpawz-pay/success?paymentId=pay_1');
    expect(options.redirect).toBe(true);
    expect(options.method).toBeUndefined();
    expect(options.config).toBeUndefined();
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

  test('strips leftover UPI display config so Pay Bill sheet stays default', () => {
    const options = sanitizeRazorpayInstanceOptions({
      key: 'rzp_test_key',
      amount: 2302920,
      currency: 'INR',
      name: 'Warmpawz',
      description: 'Warmpawz Pay - Harley\'s Corner',
      method: { upi: true },
      config: {
        display: {
          blocks: { upi: { name: 'Pay using UPI', instruments: [{ method: 'upi' }] } },
          sequence: ['block.upi'],
        },
      },
    });
    expect(options.method).toBeUndefined();
    expect(options.config).toBeUndefined();
    expect(options.amount).toBe(2302920);
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
