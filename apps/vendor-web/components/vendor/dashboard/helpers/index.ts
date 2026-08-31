import type { Dashboardstats } from '../types';
import type { VendorScheduleTypeFilter } from '@/lib/vendor-meal-order-schedule';

/** Prefer service_style when present (canonical for booking location type). */
export function resolveScheduleServiceType(booking: {
  service_type?: string;
  service_style?: string;
  serviceType?: string;
  serviceStyle?: string;
}): string {
  return String(
    booking.service_style ||
      booking.serviceStyle ||
      booking.service_type ||
      booking.serviceType ||
      'at_center'
  ).toLowerCase();
}

export function matchesScheduleTypeFilter(
  serviceType: string,
  filter: VendorScheduleTypeFilter
): boolean {
  if (filter === 'all' || filter === 'meal_orders') return filter === 'all';
  const typeMap: Record<string, string> = {
    at_center: 'clinic',
    clinic: 'clinic',
    at_clinic: 'clinic',
    at_home: 'home',
    home: 'home',
    home_visit: 'home',
    tele: 'tele',
    teleconsultation: 'tele',
    online: 'tele',
    video_consultation: 'tele',
  };
  return typeMap[serviceType.toLowerCase()] === filter;
}

import {
  resolveVendorBookingServiceLabel,
  shouldShowVendorBookingPrice,
} from '@/lib/vendor-utils';

function formatDbTimeTo12h(raw: string): string {
  if (!raw || typeof raw !== 'string') return 'N/A';
  if (raw.includes('AM') || raw.includes('PM')) return raw.trim();
  return formatBookingTime(raw.replace(/\.\d+$/, ''));
}

/** Map GET /vendor/bookings response row to Home schedule card shape (parity with Bookings tab). */
export function mapVendorBookingsApiToScheduleItem(
  booking: Record<string, unknown>,
  opts: { defaultServiceType?: string; vendorAddress?: string } = {}
) {
  const defaultServiceType = opts.defaultServiceType ?? 'at_center';
  const rawTime =
    booking.booking_time ||
    booking.scheduledTime ||
    booking.time ||
    booking.scheduled_time;
  const timeStr =
    typeof rawTime === 'string'
      ? rawTime.includes('AM') || rawTime.includes('PM')
        ? rawTime
        : formatDbTimeTo12h(rawTime)
      : 'N/A';

  const serviceTypeRaw = resolveScheduleServiceType(
    booking as Parameters<typeof resolveScheduleServiceType>[0]
  );
  const serviceType = serviceTypeRaw || defaultServiceType;

  const isAtHome =
    String(booking.service_type || booking.serviceType || '')
      .toLowerCase()
      .includes('home') ||
    String(booking.service_style || booking.serviceStyle || '')
      .toLowerCase()
      .includes('home');

  const address =
    (isAtHome
      ? booking.address ||
        booking.destination_address ||
        booking.location ||
        booking.delivery_address
      : null) ||
    booking.address ||
    booking.destination_address ||
    booking.location ||
    booking.delivery_address ||
    opts.vendorAddress ||
    '';

  const bookingLike = {
    commerce_mode: booking.commerce_mode as string | undefined,
    commerceMode: booking.commerceMode as string | undefined,
    service_name: (booking.service_name || booking.serviceName || booking.service) as
      | string
      | undefined,
    serviceName: (booking.serviceName ||
      booking.service_name ||
      (booking.service as { name?: string } | undefined)?.name) as string | undefined,
    service_type: booking.service_type as string | undefined,
    service_style: booking.service_style as string | undefined,
    serviceType,
    serviceStyle: serviceType,
    communicationType:
      serviceType === 'tele' || String(booking.service_type || booking.serviceType) === 'tele'
        ? 'video'
        : 'in-person',
  };

  const rawAmount = booking.price ?? booking.total_amount ?? booking.totalAmount;
  const parsedPrice =
    rawAmount == null || rawAmount === '' ? 0 : parseFloat(String(rawAmount));

  const customerObj = booking.customer as { name?: string; phone?: string; id?: string } | undefined;

  return {
    id: String(booking.id || booking.booking_id || ''),
    bookingId: String(booking.id || booking.booking_id || ''),
    time: timeStr,
    duration: Number(booking.duration ?? booking.duration_minutes) || 30,
    petName: String(booking.pet_name || booking.petName || 'Pet'),
    petBreed: (booking.pet_breed || booking.petBreed || booking.pet_type || booking.petType) as
      | string
      | undefined,
    customerName: String(
      customerObj?.name ||
        booking.customer_name ||
        booking.customerName ||
        'Customer'
    ),
    customerPhone: String(
      customerObj?.phone ||
        booking.customer_phone ||
        booking.customerPhone ||
        ''
    ),
    customerId: (booking.customer_id || booking.customerId || customerObj?.id) as
      | string
      | undefined,
    serviceName: resolveVendorBookingServiceLabel(bookingLike),
    serviceType,
    status: String(booking.status || 'pending'),
    price: shouldShowVendorBookingPrice(bookingLike) ? parsedPrice : 0,
    commerce_mode: (booking.commerce_mode ?? booking.commerceMode) as string | undefined,
    commerceMode: (booking.commerceMode ?? booking.commerce_mode) as string | undefined,
    communicationType: bookingLike.communicationType,
    address: String(address || ''),
    specialInstructions: booking.notes as string | undefined,
    hasPrescription: Boolean(booking.hasPrescription),
    hasUnreadMessages: Boolean(booking.hasUnreadMessages),
    unreadMessageCount: Number(booking.unreadMessageCount) || 0,
    chatEnabled: booking.chatEnabled !== false,
    isFollowUp: Boolean(booking.isFollowUp),
    isRescheduled: Boolean(
      booking.isRescheduled || booking.rescheduledAt || booking.rescheduled_at
    ),
    rescheduledAt: (booking.rescheduledAt || booking.rescheduled_at) as string | null | undefined,
    packagePurchaseId: booking.packagePurchaseId ?? booking.package_purchase_id,
    packageSessionNumber:
      booking.packageSessionNumber != null
        ? Number(booking.packageSessionNumber)
        : booking.package_session_number != null
          ? Number(booking.package_session_number)
          : undefined,
    packageTotalSessions:
      booking.packageTotalSessions != null
        ? Number(booking.packageTotalSessions)
        : booking.package_total_sessions != null
          ? Number(booking.package_total_sessions)
          : booking.total_sessions != null
            ? Number(booking.total_sessions)
            : undefined,
    isPackageSession: Boolean(booking.isPackageSession ?? booking.is_package_session),
  };
}

export function mapDashboardBookingToScheduleItem(b: Record<string, unknown>, defaultServiceType = 'at_center') {
  const serviceType = resolveScheduleServiceType(b as Parameters<typeof resolveScheduleServiceType>[0]) || defaultServiceType;
  const bookingLike = {
    commerce_mode: b.commerce_mode as string | undefined,
    commerceMode: b.commerceMode as string | undefined,
    service_name: b.service_name as string | undefined,
    serviceName: b.service_name as string | undefined,
    service_type: b.service_type as string | undefined,
    service_style: b.service_style as string | undefined,
    serviceType,
    serviceStyle: serviceType,
  };
  const rawAmount = b.total_amount;
  const parsedPrice =
    rawAmount == null || rawAmount === ''
      ? 0
      : parseFloat(String(rawAmount));
  return {
    id: (b.id || b.booking_id) as string,
    bookingId: (b.id || b.booking_id) as string,
    time: b.booking_time ? formatBookingTime(String(b.booking_time)) : 'N/A',
    duration: Number(b.duration_minutes) || 30,
    petName: (b.pet_name as string) || 'Pet',
    petBreed: b.pet_breed as string | undefined,
    customerName: (b.customer_name as string) || 'Customer',
    customerPhone: (b.customer_phone as string) || '',
    customerId: (b.customerId ?? b.customer_id) as string | undefined,
    serviceName: resolveVendorBookingServiceLabel(bookingLike),
    serviceType,
    status: (b.status as string) || 'pending',
    price: shouldShowVendorBookingPrice(bookingLike) ? parsedPrice : 0,
    commerce_mode: (b.commerce_mode ?? b.commerceMode) as string | undefined,
    address: (b.address as string) || '',
    specialInstructions: b.notes as string | undefined,
    hasPrescription: Boolean(b.hasPrescription),
    hasUnreadMessages: Boolean(b.hasUnreadMessages),
    unreadMessageCount: Number(b.unreadMessageCount) || 0,
    chatEnabled: b.chatEnabled !== false,
    isFollowUp: Boolean(b.isFollowUp),
    isRescheduled: Boolean(b.isRescheduled || b.rescheduledAt || b.rescheduled_at),
    rescheduledAt: (b.rescheduledAt || b.rescheduled_at) as string | null | undefined,
    packagePurchaseId: b.packagePurchaseId ?? b.package_purchase_id,
    packageSessionNumber:
      b.packageSessionNumber != null
        ? Number(b.packageSessionNumber)
        : b.package_session_number != null
          ? Number(b.package_session_number)
          : undefined,
    packageTotalSessions:
      b.packageTotalSessions != null
        ? Number(b.packageTotalSessions)
        : b.package_total_sessions != null
          ? Number(b.package_total_sessions)
          : b.total_sessions != null
            ? Number(b.total_sessions)
            : undefined,
    isPackageSession: Boolean(b.isPackageSession ?? b.is_package_session),
  };
}

/** UI copy + a11y for vendor dashboard rating (no fake averages when review count is zero). */
export interface VendorDashboardRatingPresentation {
  label: string;
  ariaLabel: string;
  showNumeric: boolean;
  numeric?: number;
}

/**
 * Rating shown only when there is at least one review and a finite average.
 * Avoids implying a "0.0 star" score when the vendor simply has no reviews yet.
 */
export function getVendorDashboardRatingPresentation(
  totalReviews: unknown,
  rating: unknown
): VendorDashboardRatingPresentation {
  const count = Number(totalReviews);
  const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  let parsed: number | undefined;
  if (rating != null && rating !== '') {
    const n = Number(rating);
    if (Number.isFinite(n)) parsed = n;
  }
  if (safeCount > 0 && parsed !== undefined) {
    const rounded = parseFloat(parsed.toFixed(1));
    return {
      label: rounded.toFixed(1),
      ariaLabel: `Rating ${rounded.toFixed(1)}, ${safeCount} reviews. Open reviews`,
      showNumeric: true,
      numeric: rounded,
    };
  }
  return {
    label: 'No reviews yet',
    ariaLabel: 'No reviews yet. Open reviews',
    showNumeric: false,
  };
}

/** Normalize API rating + count for state (null rating when no aggregate). */
export function normalizeDashboardRatingFields(
  totalReviews: unknown,
  rating: unknown
): { rating: number | null; totalReviews: number } {
  const count = Number(totalReviews);
  const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  let parsed: number | null = null;
  if (rating != null && rating !== '') {
    const n = Number(rating);
    if (Number.isFinite(n)) parsed = n;
  }
  if (safeCount > 0 && parsed !== null) {
    return { rating: parseFloat(parsed.toFixed(1)), totalReviews: safeCount };
  }
  return { rating: null, totalReviews: safeCount };
}

/**
 * Merge dashboard API `stats` into local Dashboardstats (maps todayBookings → appointments, etc.).
 */
export function mergeVendorDashboardStats(
  previous: Dashboardstats,
  api: Record<string, unknown> | null | undefined
): Dashboardstats {
  if (!api || typeof api !== 'object') return previous;
  const { rating, totalReviews } = normalizeDashboardRatingFields(api.totalReviews, api.rating);
  return {
    ...previous,
    appointments: Number(api.todayBookings ?? api.appointments ?? previous.appointments) || 0,
    consultations: Number(api.consultations ?? previous.consultations) || 0,
    completedServices:
      Number(api.completedToday ?? api.completedServices ?? previous.completedServices) || 0,
    earnings: Number(api.earnings ?? previous.earnings) || 0,
    pendingEarnings: Number(api.pendingSettlement ?? api.pendingEarnings ?? previous.pendingEarnings) || 0,
    activeOrders: Number(api.pendingBookings ?? api.activeOrders ?? previous.activeOrders ?? 0) || 0,
    rating,
    totalReviews,
  };
}

/**
 * Unread count for vendor notification APIs (`/vendor/:id/notifications`, `/vendor/notifications/:id`).
 * Prefer server `unreadCount` (full DB count). Raw rows use `is_read`, not `isRead`.
 */
export function vendorNotificationUnreadCount(res: {
  success?: boolean;
  unreadCount?: unknown;
  notifications?: any[];
} | null | undefined | unknown): number {
  const payload = res as {
    success?: boolean;
    unreadCount?: unknown;
    notifications?: any[];
  } | null | undefined;
  if (!payload || payload.success === false) return 0;
  const fromApi = payload.unreadCount;
  if (typeof fromApi === 'number' && !Number.isNaN(fromApi)) return fromApi;
  const rows = payload.notifications || [];
  return rows.filter((row: any) => row.is_read === false).length;
}

/** Business vendor dashboard: Bookings + Sessions stat tiles under Today/Week/Month. Set true to show again. */
export const SHOW_VENDOR_STATS_BOOKINGS_SESSIONS_CARDS = false;

/** Footer bar chart / Reporting tab. Set true to show again; reporting panel code stays mounted when tab is active. */
export const SHOW_VENDOR_FOOTER_REPORTING_TAB = false;

// ✅ Helper to format booking time from "HH:MM:SS" to "HH:MM AM/PM"
export function formatBookingTime(time: string): string {
    if (!time) return 'N/A';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  }
  