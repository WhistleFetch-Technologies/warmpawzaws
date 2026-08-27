/**
 * @jest-environment jsdom
 */

const loadRazorpayScript = jest.fn(async () => undefined);

jest.mock('../razorpay-utils', () => ({
  loadRazorpayScript: (...args: unknown[]) => loadRazorpayScript(...(args as [])),
  digitsToRazorpayContactE164: jest.requireActual('../razorpay-utils').digitsToRazorpayContactE164,
  razorpaySafeDescription: jest.requireActual('../razorpay-utils').razorpaySafeDescription,
  sanitizeRazorpayInstanceOptions: jest.requireActual('../razorpay-utils').sanitizeRazorpayInstanceOptions,
}));

import { openStandardRazorpayCheckout } from '../open-standard-razorpay-checkout';

describe('openStandardRazorpayCheckout', () => {
  const captured: { options?: Record<string, unknown>; failed?: (resp: unknown) => void } = {};

  beforeEach(() => {
    captured.options = undefined;
    captured.failed = undefined;
    loadRazorpayScript.mockClear();
    (window as unknown as { Razorpay?: unknown }).Razorpay = jest.fn((options: Record<string, unknown>) => {
      captured.options = options;
      return {
        open: jest.fn(),
        on: jest.fn((event: string, cb: (resp: unknown) => void) => {
          if (event === 'payment.failed') captured.failed = cb;
        }),
      };
    });
  });

  it('opens minimal Standard Checkout with unchanged paise and no UPI blocks', async () => {
    const handler = jest.fn();
    await openStandardRazorpayCheckout({
      key: 'rzp_test_key',
      amountPaise: 2302920,
      currency: 'INR',
      description: "Warmpawz Pay - Harley's Corner",
      order_id: 'order_wpay_1',
      customerPhone: '9820009456',
      handler,
    });

    expect(loadRazorpayScript).toHaveBeenCalledTimes(1);
    expect(captured.options?.amount).toBe(2302920);
    expect(captured.options?.order_id).toBe('order_wpay_1');
    expect(captured.options?.method).toBeUndefined();
    expect(captured.options?.config).toBeUndefined();
    expect((captured.options?.prefill as { contact?: string } | undefined)?.contact).toBe('+919820009456');
    expect((captured.options?.prefill as { email?: string } | undefined)?.email).toBeUndefined();
    expect((captured.options?.theme as { color?: string; hide_topbar?: boolean } | undefined)).toEqual({
      color: '#FF8C42',
      hide_topbar: true,
    });
  });

  it('forwards payment.failed to the caller without changing amount', async () => {
    const onPaymentFailed = jest.fn();
    await openStandardRazorpayCheckout({
      key: 'rzp_test_key',
      amountPaise: 2360,
      description: 'Grooming',
      order_id: 'order_appt_1',
      handler: jest.fn(),
      onPaymentFailed,
    });
    captured.failed?.({ error: { description: 'Payment failed' } });
    expect(onPaymentFailed).toHaveBeenCalledWith(expect.any(Error));
    expect((onPaymentFailed.mock.calls[0][0] as Error).message).toBe('Payment failed');
  });
});
