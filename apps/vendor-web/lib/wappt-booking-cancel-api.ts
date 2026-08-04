export const WAPPT_COMMERCE_MODE = 'warmpawz_appointments';

export function isWapptAppointmentsBooking(commerceMode?: string | null): boolean {
  return String(commerceMode || '').toLowerCase() === WAPPT_COMMERCE_MODE;
}

export function shouldUseWapptVendorCancel(
  commerceMode?: string | null,
  serviceType?: string | null,
): boolean {
  return isWapptAppointmentsBooking(commerceMode) && String(serviceType || '').toLowerCase() !== 'tele';
}

export function vendorWapptCancelPath(bookingId: string) {
  return `/vendor/warmpawz-appointments/bookings/${encodeURIComponent(bookingId)}/cancel`;
}
