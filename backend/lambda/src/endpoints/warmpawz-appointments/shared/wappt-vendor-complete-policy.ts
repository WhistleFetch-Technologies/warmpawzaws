import { isWapptAppointmentBooking } from './wappt-earnings-policy';

/** Pay Bill may set status=completed before vendor OTP attestation. */
export function isWapptPendingVendorOtpAttestation(
  booking: Record<string, unknown> | null | undefined,
): boolean {
  if (!booking || !isWapptAppointmentBooking(booking)) return false;
  if (Boolean(booking.otp_verified)) return false;
  return String(booking.status ?? '').toLowerCase() === 'completed';
}

/** Block vendor /complete when visit is fully closed (incl. WAPPT after OTP). */
export function isVendorCompleteBlockedAsAlreadyDone(
  booking: Record<string, unknown> | null | undefined,
): boolean {
  if (isWapptPendingVendorOtpAttestation(booking)) return false;
  return String(booking?.status ?? '').toLowerCase() === 'completed';
}
