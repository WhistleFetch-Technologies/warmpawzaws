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

  try {
    const { safeRecordVcfVisitFromBooking } = await import(
      '../../../discount-engine/promo-engine/services/visit-writer.service'
    );
    await safeRecordVcfVisitFromBooking({
      id: bookingId,
      customer_id: booking.customer_id != null ? String(booking.customer_id) : null,
      vendor_id: booking.vendor_id != null ? String(booking.vendor_id) : null,
      service_type: booking.service_type != null ? String(booking.service_type) : null,
      service_style: booking.service_style != null ? String(booking.service_style) : null,
      service_category: booking.service_category != null ? String(booking.service_category) : null,
      payment_status: booking.payment_status != null ? String(booking.payment_status) : null,
      status: booking.status != null ? String(booking.status) : 'completed',
    });
  } catch (err) {
    console.warn('[vcf] booking visit write skipped:', err instanceof Error ? err.message : err);
  }

  if (isCanonicalPackageParentBooking(booking)) {
    return;
  }

  await ensureVendorEarningsForCompletedBooking(booking, bookingId, logPrefix);
}
