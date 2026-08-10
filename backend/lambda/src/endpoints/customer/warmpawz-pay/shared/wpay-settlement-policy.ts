import type { WpayPaymentRow } from '../repos/wpay-payment.repo';

export type WapptBookingSettlementFacts = {
  id: string;
  otp_verified: boolean | null;
  commerce_mode: string | null;
};

/** WAPPT appointment-linked Pay Bill uses cover credit or explicit booking link in metadata. */
export function resolveWapptSettlementBookingId(payment: WpayPaymentRow): string | null {
  const meta = (payment.metadata ?? {}) as Record<string, unknown>;
  const fromMeta = String(meta.appointmentFeeBookingId ?? '').trim();
  if (fromMeta) return fromMeta;
  const fromBooking = payment.booking_id ? String(payment.booking_id).trim() : '';
  return fromBooking || null;
}

export function isWapptAppointmentLinkedPayBill(payment: WpayPaymentRow): boolean {
  const meta = (payment.metadata ?? {}) as Record<string, unknown>;
  const credit = Number(meta.appointmentFeeCredit ?? 0);
  if (credit > 0) return true;
  return Boolean(resolveWapptSettlementBookingId(payment));
}

/**
 * Appointment-linked Pay Bill accrues settlement when payment is completed
 * (vendor earnings visible before complete OTP). OTP only closes the visit.
 * Walk-in Pay Bill (no appointment link) accrues on payment alone.
 */
export function assertWapptSettlementEligible(
  payment: WpayPaymentRow,
  bookingFacts: WapptBookingSettlementFacts | null | undefined,
): { ok: true } | { ok: false; skippedReason: string } {
  if (!isWapptAppointmentLinkedPayBill(payment)) {
    return { ok: true };
  }

  const bookingId = resolveWapptSettlementBookingId(payment);
  if (!bookingId) {
    return { ok: false, skippedReason: 'missing_booking_link' };
  }

  if (!bookingFacts) {
    return { ok: false, skippedReason: 'booking_not_found' };
  }

  return { ok: true };
}
