/**
 * Pay Bill guest conversion — uses the existing guest journey snapshot.
 * Snapshot amount is UI restore only; server revalidates before payment.
 */

import {
  clearGuestBookingIntent,
  readGuestBookingIntent,
  type GuestBookingIntentV1,
} from '../guest-booking-intent';

/** Static export ships only `/warmpawz-pay/vendors/placeholder` — real id travels in query. */
export const WPAY_VENDOR_PLACEHOLDER_PATH = '/warmpawz-pay/vendors/placeholder';

export function buildWpayVendorPayPath(vendorId: string): string {
  const id = String(vendorId || '').trim();
  if (!id || id === 'placeholder' || id === '_') return '/warmpawz-pay';
  const qs = new URLSearchParams();
  qs.set('vendorId', id);
  return `${WPAY_VENDOR_PLACEHOLDER_PATH}?${qs.toString()}`;
}

export function isWpayPayBillJourney(intent: GuestBookingIntentV1 | null | undefined): boolean {
  if (!intent) return false;
  return intent.kind === 'pay_bill' || intent.resumeScreen === 'warmpawz-pay-vendor';
}

/** Restore entered bill amount after login. Does not trust discount / payable. */
export function consumeRestoredWpayPayBillAmount(vendorId: string): number | null {
  const intent = readGuestBookingIntent();
  if (!isWpayPayBillJourney(intent)) return null;
  const id = String(vendorId || '').trim();
  if (intent?.vendorId && id && intent.vendorId !== id) return null;
  const amount = Number(intent?.price);
  clearGuestBookingIntent();
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}
