/**
 * Jio DLT — vendor new appointment SMS (must match approved text in Jio portal).
 * @see config/sms-templates-jio.json → vendor_appointment_scheduled
 */

import {
  formatIstDateDisplay,
  formatIstTimeDisplay,
} from '../utils/notification-display-format';

export const JIO_VENDOR_APPOINTMENT_SCHEDULED_TEMPLATE_ID =
  process.env.SMS_VENDOR_APPOINTMENT_TEMPLATE_ID?.trim() ||
  '1207177977337281970';

/** @deprecated Use formatIstDateDisplay from notification-display-format */
export function formatVendorAppointmentDate(dateStr: string): string {
  return formatIstDateDisplay(dateStr);
}

/** @deprecated Use formatIstTimeDisplay from notification-display-format */
export function formatVendorAppointmentTime(timeStr: string): string {
  return formatIstTimeDisplay(timeStr);
}

/** Body must match registered DLT template (only {#var#} spans differ). */
export function buildVendorAppointmentScheduledSmsBody(params: {
  vendorName?: string | null;
  bookingDate: string;
  bookingTime: string;
}): string {
  const first =
    String(params.vendorName || 'there')
      .trim()
      .split(/\s+/)[0] || 'there';
  const date = formatIstDateDisplay(params.bookingDate);
  const time = formatIstTimeDisplay(params.bookingTime);
  return `Warmpawz: Hi ${first}, you have a new appointment on ${date} at ${time}.`;
}
