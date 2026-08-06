import { WAPPT_COMMERCE_MODE } from './wappt-policy.constants';

export { WAPPT_COMMERCE_MODE };

/** SQL fragment: exclude WAPPT appointment bookings from marketplace vendor_earnings. */
export const SQL_EXCLUDE_WAPPT_BOOKING_EARNINGS = `LOWER(COALESCE(b.commerce_mode, '')) <> '${WAPPT_COMMERCE_MODE}'`;

/** Use on vendor_earnings queries without a bookings alias (filters via subquery). */
export const SQL_EXCLUDE_WAPPT_VENDOR_EARNINGS_VE = `NOT EXISTS (
  SELECT 1 FROM bookings b_wappt
  WHERE b_wappt.id = ve.booking_id
    AND LOWER(COALESCE(b_wappt.commerce_mode, '')) = '${WAPPT_COMMERCE_MODE}'
)`;

export function isWapptAppointmentBooking(booking: Record<string, unknown> | null | undefined): boolean {
  const mode = String(booking?.commerce_mode ?? booking?.commerceMode ?? '').toLowerCase();
  return mode === WAPPT_COMMERCE_MODE;
}

/** WAPPT appointment fees are platform revenue; vendor payout is Pay Bill settlement only. */
export function shouldSkipVendorEarningsForWappt(booking: Record<string, unknown> | null | undefined): boolean {
  return isWapptAppointmentBooking(booking);
}
