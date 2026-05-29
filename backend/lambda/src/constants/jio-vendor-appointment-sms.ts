/**
 * Jio DLT — vendor new appointment SMS (must match approved text in Jio portal).
 * @see config/sms-templates-jio.json → vendor_appointment_scheduled
 */

export const JIO_VENDOR_APPOINTMENT_SCHEDULED_TEMPLATE_ID =
  process.env.SMS_VENDOR_APPOINTMENT_TEMPLATE_ID?.trim() ||
  '1207177977337281970';

export function formatVendorAppointmentDate(dateStr: string): string {
  const raw = String(dateStr || '').trim();
  if (!raw) return '';
  const d = new Date(`${raw.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatVendorAppointmentTime(timeStr: string): string {
  const raw = String(timeStr || '').trim();
  if (!raw) return '';
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return raw;
  let hour = parseInt(match[1], 10);
  const minutes = match[2];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minutes} ${ampm}`;
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
  const date = formatVendorAppointmentDate(params.bookingDate);
  const time = formatVendorAppointmentTime(params.bookingTime);
  return `Warmpawz: Hi ${first}, you have a new appointment on ${date} at ${time}.`;
}
