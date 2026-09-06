import { apiClient } from '@/lib/api-client';
import { ApiError } from '@/lib/error-handling';
import type { WpayVerifyResponse } from '@/lib/warmpawz-pay/wpay-razorpay-checkout';

export const WPAY_RECONCILE_POLL_INTERVAL_MS = 3000;
export const WPAY_RECONCILE_POLL_WINDOW_MS = 60_000;

export const WPAY_CONFIRMING_COPY = 'Confirming payment...';
export const WPAY_CONFIRM_TIMEOUT_COPY =
  "We're still confirming your payment. If your account was debited, the payment will be updated automatically once confirmed. You can check your payment history shortly.";

export type WpayRazorpayCallbackParams = {
  razorpay_payment_id?: string | null;
  razorpay_order_id?: string | null;
  razorpay_signature?: string | null;
};

export type WpayConfirmOutcome =
  | { status: 'success'; result: WpayVerifyResponse }
  | { status: 'pending' }
  | { status: 'timeout' }
  | { status: 'auth'; message: string }
  | { status: 'not_found'; message: string }
  | { status: 'error'; message: string }
  | { status: 'aborted' };

function errorStatusCode(error: unknown): number | undefined {
  if (error instanceof ApiError && typeof error.statusCode === 'number') {
    return error.statusCode;
  }
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const n = Number((error as { statusCode?: unknown }).statusCode);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function errorPayload(error: unknown): Record<string, unknown> | null {
  if (!error || typeof error !== 'object') return null;
  const rec = error as { response?: unknown; responseData?: unknown };
  const raw = rec.response ?? rec.responseData;
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  const payload = errorPayload(error);
  const fromPayload = payload?.error;
  if (typeof fromPayload === 'string' && fromPayload.trim()) return fromPayload;
  return fallback;
}

export function hasWpayRazorpayCallbackParams(params: WpayRazorpayCallbackParams): boolean {
  return Boolean(
    String(params.razorpay_payment_id ?? '').trim() &&
      String(params.razorpay_order_id ?? '').trim() &&
      String(params.razorpay_signature ?? '').trim(),
  );
}

/** Expected 409 pending from reconcile — normal control flow, not a console error. */
export function isWpayReconcilePendingError(error: unknown): boolean {
  const status = errorStatusCode(error);
  const payload = errorPayload(error);
  const message = error instanceof Error ? error.message : '';
  if (payload?.pending === true) return true;
  if (status === 409 && /not captured yet/i.test(message)) return true;
  if (status === 409 && payload?.error === 'Payment not captured yet') return true;
  return false;
}

export function classifyWpayConfirmError(
  error: unknown,
): 'pending' | 'auth' | 'not_found' | 'error' {
  if (isWpayReconcilePendingError(error)) return 'pending';
  const status = errorStatusCode(error);
  const message = errorMessage(error, '');
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'not_found';
  if (/authentication required|does not match authenticated|please log in/i.test(message)) {
    return 'auth';
  }
  if (/payment not found/i.test(message)) return 'not_found';
  return 'error';
}

function outcomeFromClassified(
  kind: 'pending' | 'auth' | 'not_found' | 'error',
  error: unknown,
): WpayConfirmOutcome {
  if (kind === 'pending') return { status: 'pending' };
  if (kind === 'auth') return { status: 'auth', message: errorMessage(error, 'Authentication required') };
  if (kind === 'not_found') {
    return { status: 'not_found', message: errorMessage(error, 'Payment not found') };
  }
  return { status: 'error', message: errorMessage(error, 'Payment confirmation failed') };
}

export async function defaultWpayConfirmSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const id = setTimeout(() => resolve(), ms);
    const onAbort = () => {
      clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

async function postWpayReconcile(
  paymentId: string,
  phone: string,
): Promise<WpayConfirmOutcome> {
  try {
    const reconciled = (await apiClient.post('/customer/warmpawz-pay/reconcile', {
      paymentId,
      phone,
    })) as WpayVerifyResponse;
    if (reconciled?.success) return { status: 'success', result: reconciled };
    if (reconciled?.pending) return { status: 'pending' };
    return { status: 'error', message: reconciled?.error || 'Payment confirmation failed' };
  } catch (error: unknown) {
    return outcomeFromClassified(classifyWpayConfirmError(error), error);
  }
}

async function postWpayVerify(
  paymentId: string,
  phone: string,
  callback: WpayRazorpayCallbackParams,
): Promise<WpayConfirmOutcome | 'fallback'> {
  try {
    const verified = (await apiClient.post('/customer/warmpawz-pay/verify', {
      paymentId,
      phone,
      razorpay_order_id: String(callback.razorpay_order_id).trim(),
      razorpay_payment_id: String(callback.razorpay_payment_id).trim(),
      razorpay_signature: String(callback.razorpay_signature).trim(),
    })) as WpayVerifyResponse;
    if (verified?.success) return { status: 'success', result: verified };
    return 'fallback';
  } catch (error: unknown) {
    const kind = classifyWpayConfirmError(error);
    if (kind === 'pending') return { status: 'pending' };
    if (kind === 'auth' || kind === 'not_found') {
      return outcomeFromClassified(kind, error);
    }
    return 'fallback';
  }
}

export async function confirmWpayPaymentFromSuccessPage(opts: {
  paymentId: string;
  phone: string;
  callback?: WpayRazorpayCallbackParams;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  now?: () => number;
  signal?: AbortSignal;
}): Promise<WpayConfirmOutcome> {
  const {
    paymentId,
    phone,
    callback = {},
    sleep = defaultWpayConfirmSleep,
    now = Date.now,
    signal,
  } = opts;

  if (signal?.aborted) return { status: 'aborted' };

  let outcome: WpayConfirmOutcome;
  if (hasWpayRazorpayCallbackParams(callback)) {
    const verified = await postWpayVerify(paymentId, phone, callback);
    outcome = verified === 'fallback' ? await postWpayReconcile(paymentId, phone) : verified;
  } else {
    outcome = await postWpayReconcile(paymentId, phone);
  }

  if (outcome.status !== 'pending') {
    return signal?.aborted ? { status: 'aborted' } : outcome;
  }

  const started = now();
  while (now() - started < WPAY_RECONCILE_POLL_WINDOW_MS) {
    if (signal?.aborted) return { status: 'aborted' };
    try {
      await sleep(WPAY_RECONCILE_POLL_INTERVAL_MS, signal);
    } catch (error: unknown) {
      if (isAbortError(error) || signal?.aborted) return { status: 'aborted' };
      throw error;
    }
    if (signal?.aborted) return { status: 'aborted' };
    outcome = await postWpayReconcile(paymentId, phone);
    if (outcome.status !== 'pending') {
      return signal?.aborted ? { status: 'aborted' } : outcome;
    }
  }

  return signal?.aborted ? { status: 'aborted' } : { status: 'timeout' };
}
