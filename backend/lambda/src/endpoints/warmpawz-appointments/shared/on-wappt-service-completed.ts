import { accruePendingWpaySettlementsForWapptBooking } from '../../customer/warmpawz-pay/shared/accrue-wpay-settlement';
import { isWapptAppointmentBooking } from './wappt-earnings-policy';

/**
 * Release held Warmpawz Pay settlements after service attestation (OTP at completion).
 * Independent of marketplace vendor_earnings.
 */
export async function onWapptServiceCompleted(
  bookingId: string,
  booking: Record<string, unknown> | null | undefined,
  logPrefix = '[WAPPT-SERVICE-COMPLETED]',
): Promise<void> {
  if (!isWapptAppointmentBooking(booking)) {
    return;
  }
  try {
    await accruePendingWpaySettlementsForWapptBooking(bookingId, logPrefix);
  } catch (error) {
    console.warn(`${logPrefix} held settlement release failed`, { bookingId, error });
  }
}
