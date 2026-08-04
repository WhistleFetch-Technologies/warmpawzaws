import {
  WAPPT_BOOKING_MODE,
  WAPPT_DISPLAY_SERVICE_NAME,
} from '../endpoints/warmpawz-appointments/shared/wappt-booking-preflight';

/** Customer-facing service label for booking list/detail APIs. */
export function resolveCustomerBookingServiceDisplayName(
  booking: Record<string, unknown>,
): string {
  const commerceMode = String(booking.commerce_mode ?? booking.commerceMode ?? 'marketplace').trim();
  const persisted = String(booking.booking_service_name ?? '').trim();
  const catalog = String(booking.service_name ?? booking.serviceName ?? '').trim();
  const isWappt =
    commerceMode === WAPPT_BOOKING_MODE ||
    persisted.toLowerCase() === WAPPT_DISPLAY_SERVICE_NAME.toLowerCase();
  if (isWappt) {
    return persisted || WAPPT_DISPLAY_SERVICE_NAME;
  }
  return persisted || catalog || 'Service';
}
