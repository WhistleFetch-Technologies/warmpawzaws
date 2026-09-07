/**
 * Remember a Pay Bill checkout so UPI app-switch can return to the confirm page
 * even when Razorpay lands the WebView on `/` instead of callback_url.
 */

import { buildWpaySuccessPath } from '@/lib/warmpawz-pay/wpay-success-href';

export const WPAY_PENDING_RETURN_KEY = 'wpay_pending_return';

export type WpayPendingReturn = {
  paymentId: string;
  vendor?: string;
  saved?: number;
};

function canUseSessionStorage(): boolean {
  return typeof window !== 'undefined' && typeof sessionStorage !== 'undefined';
}

export function rememberWpayPendingReturn(pending: WpayPendingReturn): void {
  const paymentId = String(pending.paymentId || '').trim();
  if (!paymentId || !canUseSessionStorage()) return;
  const row: WpayPendingReturn = { paymentId };
  const vendor = pending.vendor?.trim();
  if (vendor) row.vendor = vendor;
  if (pending.saved != null && Number.isFinite(pending.saved) && pending.saved > 0) {
    row.saved = pending.saved;
  }
  try {
    sessionStorage.setItem(WPAY_PENDING_RETURN_KEY, JSON.stringify(row));
  } catch {
    /* ignore quota / private mode */
  }
}

export function peekWpayPendingReturn(): WpayPendingReturn | null {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = sessionStorage.getItem(WPAY_PENDING_RETURN_KEY);
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

export function clearWpayPendingReturn(): void {
  if (!canUseSessionStorage()) return;
  try {
    sessionStorage.removeItem(WPAY_PENDING_RETURN_KEY);
  } catch {
    /* ignore */
  }
}

export function consumeWpayPendingReturnPath(): string | null {
  const pending = peekWpayPendingReturn();
  if (!pending?.paymentId) return null;
  clearWpayPendingReturn();
  return buildWpaySuccessPath(pending);
}
