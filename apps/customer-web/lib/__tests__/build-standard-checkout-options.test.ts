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

  test('prioritizes UPI without disabling default Razorpay method blocks', () => {
    const options = buildSanitizedStandardRazorpayCheckoutOptions({
      ...minimalInput,
      amountPaise: 2302920,
      customerPhone: '7204349299',
    });
    expect(options.amount).toBe(2302920);
    expect(options.method).toEqual({ upi: true });
    expect(options.config.display.blocks.upi.name).toBe('Pay using UPI');
    expect(options.config.display.blocks.upi.instruments).toEqual([
      { method: 'upi', flows: ['collect', 'intent', 'qr'] },
    ]);
    expect(options.config.display.sequence).toEqual(['block.upi']);
    expect(options.config.display.preferences.show_default_blocks).toBe(true);
    expect(options.prefill.contact).toBe('+917204349299');
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
