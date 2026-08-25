/**
 * @jest-environment jsdom
 *
 * Checkout presentation only. Initiate/verify payloads and payable paise must stay
 * exactly as the WPay backend returned them.
 */

const openWarmpawzRazorpayCheckout = jest.fn();
const fetchCheckoutEmailForPrefill = jest.fn(async () => 'owner@example.com');

jest.mock('@/lib/razorpay/open-warmpawz-razorpay-checkout', () => ({
  openWarmpawzRazorpayCheckout: (...args: unknown[]) => openWarmpawzRazorpayCheckout(...args),
}));

jest.mock('@/lib/razorpay/build-standard-checkout-options', () => ({
  fetchCheckoutEmailForPrefill: (...args: unknown[]) => fetchCheckoutEmailForPrefill(...args),
}));

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

import * as fs from 'fs';
import * as path from 'path';
import { apiClient } from '@/lib/api-client';
import { runWpayRazorpayCheckout } from '../wpay-razorpay-checkout';

const post = apiClient.post as jest.Mock;

describe('runWpayRazorpayCheckout', () => {
  it('keeps WPay initiate/verify and uses the shared Checkout opener only', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../wpay-razorpay-checkout.ts'), 'utf8');
    expect(source).toContain("'/customer/warmpawz-pay/initiate'");
    expect(source).toContain("'/customer/warmpawz-pay/verify'");
    expect(source).toContain('openWarmpawzRazorpayCheckout');
    expect(source).not.toMatch(/\bgst\b/i);
    expect(source).not.toContain('new window.Razorpay');
    expect(source).not.toContain('new RazorpayCtor');
  });

  beforeEach(() => {
    post.mockReset();
    openWarmpawzRazorpayCheckout.mockReset();
    fetchCheckoutEmailForPrefill.mockClear();
  });

  it('passes backend-authoritative paise to shared Checkout and verifies via WPay', async () => {
    post.mockImplementation(async (path: string) => {
      if (path === '/customer/warmpawz-pay/initiate') {
        return {
          success: true,
          paymentId: 'pay_row_1',
          razorpayOrderId: 'order_wpay_1',
          razorpayKeyId: 'rzp_test_key',
          originalAmount: 23029.2,
          discountAmount: 2302.92,
          appointmentFeeCredit: 0,
          billBase: 23029.2,
          payableAmount: 20726.28,
          amount: 20726.28,
          amountPaise: 2072628,
          currency: 'INR',
        };
      }
      if (path === '/customer/warmpawz-pay/verify') {
        return {
          success: true,
          paymentId: 'pay_row_1',
          originalAmount: 23029.2,
          discountAmount: 2302.92,
          payableAmount: 20726.28,
          savedAmount: 2302.92,
        };
      }
      throw new Error(`unexpected ${path}`);
    });

    openWarmpawzRazorpayCheckout.mockImplementation(async (input: { handler: (r: unknown) => Promise<void> }) => {
      await input.handler({
        razorpay_order_id: 'order_wpay_1',
        razorpay_payment_id: 'pay_rzp_1',
        razorpay_signature: 'sig_1',
      });
    });

    const result = await runWpayRazorpayCheckout({
      vendorId: 'vendor-1',
      vendorName: "Harley's Corner",
      originalAmount: 23029.2,
      customerPhone: '9820009456',
      bookingId: 'booking-1',
    });

    expect(post).toHaveBeenNthCalledWith(1, '/customer/warmpawz-pay/initiate', {
      vendorId: 'vendor-1',
      originalAmount: 23029.2,
      phone: '9820009456',
      bookingId: 'booking-1',
    });

    expect(openWarmpawzRazorpayCheckout).toHaveBeenCalledTimes(1);
    const checkoutArg = openWarmpawzRazorpayCheckout.mock.calls[0][0];
    expect(checkoutArg.amountPaise).toBe(2072628);
    expect(checkoutArg.order_id).toBe('order_wpay_1');
    expect(checkoutArg.key).toBe('rzp_test_key');
    expect(checkoutArg.includeInstrumentBlocks).toBe(true);
    expect(checkoutArg.description).toContain("Harley's Corner");

    expect(post).toHaveBeenCalledWith('/customer/warmpawz-pay/verify', {
      paymentId: 'pay_row_1',
      phone: '9820009456',
      razorpay_order_id: 'order_wpay_1',
      razorpay_payment_id: 'pay_rzp_1',
      razorpay_signature: 'sig_1',
    });

    expect(result.payableAmount).toBe(20726.28);
    expect(result.discountAmount).toBe(2302.92);
    expect(result.originalAmount).toBe(23029.2);
  });

  it('does not recalculate GST or discount before opening Checkout', async () => {
    let opened: { amountPaise?: number; modal?: { ondismiss?: () => void } } | undefined;
    post.mockResolvedValueOnce({
      success: true,
      paymentId: 'pay_row_2',
      razorpayOrderId: 'order_wpay_2',
      razorpayKeyId: 'rzp_test_key',
      payableAmount: 23.6,
      amount: 23.6,
      amountPaise: 2360,
      currency: 'INR',
    });
    openWarmpawzRazorpayCheckout.mockImplementation(async (input: typeof opened) => {
      opened = input;
    });

    const pending = runWpayRazorpayCheckout({
      vendorId: 'vendor-2',
      vendorName: 'Clinic',
      originalAmount: 23.6,
      customerPhone: '7204349299',
    });

    for (let i = 0; i < 8 && !opened; i += 1) {
      await Promise.resolve();
    }
    expect(opened?.amountPaise).toBe(2360);
    expect(opened?.amountPaise).not.toBe(Math.round(23.6 * 1.18 * 100));

    opened?.modal?.ondismiss?.();
    await expect(pending).rejects.toThrow('Payment cancelled');
  });
});
