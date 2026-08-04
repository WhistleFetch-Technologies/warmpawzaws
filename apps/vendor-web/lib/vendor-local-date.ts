const VENDOR_SCHEDULE_TZ = 'Asia/Kolkata';

/** IST calendar YYYY-MM-DD for vendor schedule anchors (matches backend earnings TZ). */
export function formatVendorScheduleAnchorDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: VENDOR_SCHEDULE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}
