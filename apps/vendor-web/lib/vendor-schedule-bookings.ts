/**
 * Shared schedule params for vendor bookings list (Today / Week / Month + view + pagination).
 * Week = ISO Mon–Sun containing anchorDate. Month = calendar month containing anchorDate.
 */

export const VENDOR_SCHEDULE_PAGE_SIZE = 20;

export type VendorSchedulePeriod = 'today' | 'week' | 'month';

export function buildVendorScheduleBookingsQuery(params: {
  schedulePeriod: VendorSchedulePeriod;
  anchorDate: string;
  pageIndex: number;
  pageSize?: number;
  /** Booking status filter (API `filter` query param — not schedule period). */
  statusFilter?: string;
}): Record<string, string> {
  const pageSize = params.pageSize ?? VENDOR_SCHEDULE_PAGE_SIZE;
  const offset = params.pageIndex * pageSize;
  return {
    period: params.schedulePeriod,
    anchorDate: params.anchorDate,
    limit: String(pageSize),
    offset: String(offset),
    filter: params.statusFilter ?? 'all',
  };
}

export function formatScheduleAnchorDate(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function scheduleAppointmentsSectionTitle(
  schedulePeriod: VendorSchedulePeriod,
  anchorDate: string
): string {
  if (schedulePeriod === 'today') {
    return `Appointments for ${formatScheduleAnchorDate(anchorDate)}`;
  }
  if (schedulePeriod === 'week') {
    return 'Appointments this week';
  }
  return 'Appointments this month';
}

export function scheduleEmptyStateMessage(schedulePeriod: VendorSchedulePeriod): string {
  if (schedulePeriod === 'today') return 'No appointments for this date';
  return 'No appointments for this period';
}

export function paginationShowingLabel(
  total: number,
  offset: number,
  count: number
): string {
  if (total === 0) return 'Showing 0 of 0';
  const from = offset + 1;
  const to = offset + count;
  return `Showing ${from}–${to} of ${total}`;
}

/** Client-side tele vs location check (matches backend view filter semantics). */
export function isTeleScheduleBooking(booking: {
  serviceType?: string;
  service_type?: string;
  service_style?: string;
  serviceStyle?: string;
  communicationType?: string;
}): boolean {
  if (String(booking.communicationType || '').toLowerCase() === 'video') return true;
  const raw = String(
    booking.serviceType ||
      booking.service_type ||
      booking.service_style ||
      booking.serviceStyle ||
      ''
  )
    .toLowerCase()
    .trim();
  return (
    raw === 'tele' ||
    raw === 'video_consultation' ||
    raw === 'tele_consultation' ||
    raw === 'teleconsultation' ||
    raw.includes('tele') ||
    raw.includes('video')
  );
}

export function isLocationScheduleBooking(booking: {
  serviceType?: string;
  service_type?: string;
  service_style?: string;
  serviceStyle?: string;
}): boolean {
  if (isTeleScheduleBooking(booking)) return false;
  const raw = String(
    booking.serviceType ||
      booking.service_type ||
      booking.service_style ||
      booking.serviceStyle ||
      ''
  )
    .toLowerCase()
    .trim();
  return (
    raw === 'at_center' ||
    raw === 'at_home' ||
    raw === 'at_clinic' ||
    raw === 'at_vendor' ||
    raw === 'home_visit' ||
    raw === 'home_service' ||
    raw === 'clinic' ||
    raw.includes('home') ||
    raw.includes('center') ||
    raw.includes('clinic')
  );
}
