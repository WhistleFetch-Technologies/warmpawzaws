/**
 * @jest-environment jsdom
 */

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

import { apiClient } from '@/lib/api-client';
import { ApiError } from '@/lib/error-handling';
import {
  classifyWpayConfirmError,
  confirmWpayPaymentFromSuccessPage,
  isWpayReconcilePendingError,
  WPAY_RECONCILE_POLL_INTERVAL_MS,
  WPAY_RECONCILE_POLL_WINDOW_MS,
} from '../wpay-success-confirm';

const post = apiClient.post as jest.Mock;

function pendingError(): ApiError {
  const error = new ApiError('Payment not captured yet', 'client_error', 409);
  (error as { response?: unknown }).response = {
    success: false,
    pending: true,
    error: 'Payment not captured yet',
  };
  return error;
}

function authError(): ApiError {
  return new ApiError('Authentication required', 'client_error', 401);
}

function notFoundError(): ApiError {
  return new ApiError('Payment not found', 'client_error', 404);
}

describe('wpay success confirm', () => {
  beforeEach(() => {
    post.mockReset();
  });

  it('treats expected 409 pending as control flow, not a failure class', () => {
    const error = pendingError();
    expect(isWpayReconcilePendingError(error)).toBe(true);
    expect(classifyWpayConfirmError(error)).toBe('pending');
    expect(classifyWpayConfirmError(authError())).toBe('auth');
    expect(classifyWpayConfirmError(notFoundError())).toBe('not_found');
  });

  it('A: Razorpay callback parameters present → verify → success', async () => {
    post.mockImplementation(async (path: string) => {
      if (path === '/customer/warmpawz-pay/verify') {
        return { success: true, paymentId: 'pay-1', savedAmount: 24 };
      }
      throw new Error(`unexpected ${path}`);
    });

    const sleep = jest.fn();
    const outcome = await confirmWpayPaymentFromSuccessPage({
      paymentId: 'pay-1',
      phone: '9876543210',
      callback: {
        razorpay_payment_id: 'pay_rzp',
        razorpay_order_id: 'order_1',
        razorpay_signature: 'sig_1',
      },
      sleep,
    });

    expect(outcome).toEqual({
      status: 'success',
      result: { success: true, paymentId: 'pay-1', savedAmount: 24 },
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/customer/warmpawz-pay/verify', {
      paymentId: 'pay-1',
      phone: '9876543210',
      razorpay_order_id: 'order_1',
      razorpay_payment_id: 'pay_rzp',
      razorpay_signature: 'sig_1',
    });
    expect(sleep).not.toHaveBeenCalled();
  });

  it('B: verify fails → reconcile', async () => {
    post.mockImplementation(async (path: string) => {
      if (path === '/customer/warmpawz-pay/verify') {
        throw new ApiError('Invalid signature', 'client_error', 400);
      }
      if (path === '/customer/warmpawz-pay/reconcile') {
        return { success: true, paymentId: 'pay-1', savedAmount: 24 };
      }
      throw new Error(`unexpected ${path}`);
    });

    const outcome = await confirmWpayPaymentFromSuccessPage({
      paymentId: 'pay-1',
      phone: '9876543210',
      callback: {
        razorpay_payment_id: 'pay_rzp',
        razorpay_order_id: 'order_1',
        razorpay_signature: 'bad',
      },
    });

    expect(outcome.status).toBe('success');
    expect(post).toHaveBeenNthCalledWith(1, '/customer/warmpawz-pay/verify', expect.any(Object));
    expect(post).toHaveBeenNthCalledWith(2, '/customer/warmpawz-pay/reconcile', {
      paymentId: 'pay-1',
      phone: '9876543210',
    });
  });

  it('C: reconcile 409 pending → poll every ~3 seconds', async () => {
    let reconcileCalls = 0;
    post.mockImplementation(async (path: string) => {
      if (path !== '/customer/warmpawz-pay/reconcile') throw new Error(`unexpected ${path}`);
      reconcileCalls += 1;
      if (reconcileCalls >= 3) return { success: true, paymentId: 'pay-1' };
      throw pendingError();
    });

    const sleeps: number[] = [];
    let t = 0;
    const outcome = await confirmWpayPaymentFromSuccessPage({
      paymentId: 'pay-1',
      phone: '9876543210',
      now: () => t,
      sleep: async (ms) => {
        sleeps.push(ms);
        t += ms;
      },
    });

    expect(outcome.status).toBe('success');
    expect(sleeps.length).toBe(2);
    expect(sleeps.every((ms) => ms === WPAY_RECONCILE_POLL_INTERVAL_MS)).toBe(true);
    expect(post).toHaveBeenCalledTimes(3);
    expect(post.mock.calls.every((call) => call[0] === '/customer/warmpawz-pay/reconcile')).toBe(true);
  });

  it('D: capture arrives during polling → stop and succeed', async () => {
    const responses = [pendingError(), pendingError(), { success: true, paymentId: 'pay-1', savedAmount: 10 }];
    post.mockImplementation(async () => {
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return next;
    });

    let t = 0;
    const outcome = await confirmWpayPaymentFromSuccessPage({
      paymentId: 'pay-1',
      phone: '9876543210',
      now: () => t,
      sleep: async (ms) => {
        t += ms;
      },
    });

    expect(outcome).toMatchObject({ status: 'success', result: { paymentId: 'pay-1' } });
    expect(post).toHaveBeenCalledTimes(3);
  });

  it('E: pending for the whole window → timeout without cancelled copy', async () => {
    post.mockImplementation(async () => {
      throw pendingError();
    });

    let t = 0;
    const outcome = await confirmWpayPaymentFromSuccessPage({
      paymentId: 'pay-1',
      phone: '9876543210',
      now: () => t,
      sleep: async (ms) => {
        t += ms;
      },
    });

    expect(outcome).toEqual({ status: 'timeout' });
    expect(t).toBeGreaterThanOrEqual(WPAY_RECONCILE_POLL_WINDOW_MS);
    expect(JSON.stringify(outcome)).not.toMatch(/cancelled/i);
  });

  it('G: already completed → no polling', async () => {
    post.mockResolvedValue({ success: true, paymentId: 'pay-1', savedAmount: 24 });
    const sleep = jest.fn();
    const outcome = await confirmWpayPaymentFromSuccessPage({
      paymentId: 'pay-1',
      phone: '9876543210',
      sleep,
    });
    expect(outcome.status).toBe('success');
    expect(sleep).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/customer/warmpawz-pay/reconcile', {
      paymentId: 'pay-1',
      phone: '9876543210',
    });
  });

  it('stops immediately on auth or not-found errors', async () => {
    post.mockRejectedValueOnce(authError());
    const sleep = jest.fn();
    await expect(
      confirmWpayPaymentFromSuccessPage({
        paymentId: 'pay-1',
        phone: '9876543210',
        sleep,
      }),
    ).resolves.toMatchObject({ status: 'auth' });
    expect(sleep).not.toHaveBeenCalled();

    post.mockRejectedValueOnce(notFoundError());
    await expect(
      confirmWpayPaymentFromSuccessPage({
        paymentId: 'pay-2',
        phone: '9876543210',
        sleep,
      }),
    ).resolves.toMatchObject({ status: 'not_found' });
  });

  it('H: aborting the signal stops timers and further reconcile calls', async () => {
    post.mockImplementation(async () => {
      throw pendingError();
    });

    const controller = new AbortController();
    let t = 0;
    const pending = confirmWpayPaymentFromSuccessPage({
      paymentId: 'pay-1',
      phone: '9876543210',
      now: () => t,
      signal: controller.signal,
      sleep: async (ms, signal) => {
        t += ms;
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        controller.abort();
      },
    });

    await expect(pending).resolves.toEqual({ status: 'aborted' });
    expect(post).toHaveBeenCalledTimes(1);
  });
});
