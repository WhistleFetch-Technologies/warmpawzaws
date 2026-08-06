import { select } from '../../../database/rds-connection';
import { ensureVendorEarningsForCompletedBooking } from '../../../utils/vendor-earnings-on-completion';
import { isCanonicalPackageParentBooking } from '../../../utils/vendor-commission-rate';
import { onWapptServiceCompleted } from './on-wappt-service-completed';

/**
 * Shared post-OTP service completion hook for all vendor completion paths.
 * Marketplace: vendor earnings accrual (unchanged).
 * WAPPT: releases held Pay Bill settlements; skips marketplace earnings.
 */
export async function finalizeBookingServiceCompleted(params: {
  bookingId: string;
  booking?: Record<string, unknown> | null;
  logPrefix?: string;
}): Promise<void> {
  const logPrefix = params.logPrefix ?? '[SERVICE-COMPLETED]';
  const bookingId = params.bookingId;

  let booking = params.booking ?? null;
  if (!booking) {
    const rows = await select('bookings', { id: bookingId });
    booking = (rows[0] as Record<string, unknown> | undefined) ?? null;
  }
  if (!booking) {
    return;
  }

  await onWapptServiceCompleted(bookingId, booking, logPrefix);

  if (isCanonicalPackageParentBooking(booking)) {
    return;
  }

  await ensureVendorEarningsForCompletedBooking(booking, bookingId, logPrefix);
}
