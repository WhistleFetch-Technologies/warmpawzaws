export const WAPPT_COMMERCE_MODE = 'warmpawz_appointments';

export function isWapptAppointmentsBooking(commerceMode?: string | null): boolean {
  return String(commerceMode || '').toLowerCase() === WAPPT_COMMERCE_MODE;
}

export function wapptRefundPreviewPath(bookingId: string) {
  return `/customer/warmpawz-appointments/bookings/${encodeURIComponent(bookingId)}/refund-preview`;
}

export function wapptCancelPath(bookingId: string) {
  return `/customer/warmpawz-appointments/bookings/${encodeURIComponent(bookingId)}/cancel`;
}

export function vendorWapptCancelPath(bookingId: string) {
  return `/vendor/warmpawz-appointments/bookings/${encodeURIComponent(bookingId)}/cancel`;
}
