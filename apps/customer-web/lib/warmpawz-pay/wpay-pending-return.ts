/**
 * Remember a Pay Bill checkout so UPI app-switch can return to the confirm page
 * even when Razorpay lands the WebView on `/` instead of callback_url.
 *
 * Write both sessionStorage and localStorage: Android often recreates the
 * WebView after UPI and drops sessionStorage.
 */

import { buildWpaySuccessPath } from '@/lib/warmpawz-pay/wpay-success-href';

export const WPAY_PENDING_RETURN_KEY = 'wpay_pending_return';

export type WpayPendingReturn = {
  paymentId: string;
  vendor?: string;
  saved?: number;
};

function canUseStorage(kind: 'session' | 'local'): boolean {
  if (typeof window === 'undefined') return false;
  return kind === 'session'
    ? typeof sessionStorage !== 'undefined'
    : typeof localStorage !== 'undefined';
}

function readStore(store: Storage): WpayPendingReturn | null {
  try {
    const raw = store.getItem(WPAY_PENDING_RETURN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WpayPendingReturn;
    const paymentId = String(parsed?.paymentId || '').trim();
    if (!paymentId) return null;
    return {
      paymentId,
      vendor: parsed.vendor,
      saved: parsed.saved,
    };
  } catch {
    return null;
  }
}

function writeStore(store: Storage, row: WpayPendingReturn): void {
  try {
    store.setItem(WPAY_PENDING_RETURN_KEY, JSON.stringify(row));
  } catch {
    /* ignore quota / private mode */
  }
}

function clearStore(store: Storage): void {
  try {
    store.removeItem(WPAY_PENDING_RETURN_KEY);
  } catch {
    /* ignore */
  }
}

export function rememberWpayPendingReturn(pending: WpayPendingReturn): void {
  const paymentId = String(pending.paymentId || '').trim();
  if (!paymentId) return;
  const row: WpayPendingReturn = { paymentId };
  const vendor = pending.vendor?.trim();
  if (vendor) row.vendor = vendor;
  if (pending.saved != null && Number.isFinite(pending.saved) && pending.saved > 0) {
    row.saved = pending.saved;
  }
  if (canUseStorage('session')) writeStore(sessionStorage, row);
  if (canUseStorage('local')) writeStore(localStorage, row);
}

export function peekWpayPendingReturn(): WpayPendingReturn | null {
  if (canUseStorage('session')) {
    const fromSession = readStore(sessionStorage);
    if (fromSession) return fromSession;
  }
  if (canUseStorage('local')) return readStore(localStorage);
  return null;
}

export function clearWpayPendingReturn(): void {
  if (canUseStorage('session')) clearStore(sessionStorage);
  if (canUseStorage('local')) clearStore(localStorage);
}

export function consumeWpayPendingReturnPath(): string | null {
  const pending = peekWpayPendingReturn();
  if (!pending?.paymentId) return null;
  clearWpayPendingReturn();
  return buildWpaySuccessPath(pending);
}
