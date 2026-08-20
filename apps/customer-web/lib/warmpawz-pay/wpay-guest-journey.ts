/**
 * Pay Bill guest conversion — uses the existing guest journey snapshot.
 * Snapshot amount is UI restore only; server revalidates before payment.
 */

import {
  clearGuestBookingIntent,
  readGuestBookingIntent,
  type GuestBookingIntentV1,
} from '../guest-booking-intent';

export function buildWpayVendorPayPath(vendorId: string): string {
  const id = String(vendorId || '').trim();
  return id ? `/warmpawz-pay/vendors/${encodeURIComponent(id)}` : '/warmpawz-pay';
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
