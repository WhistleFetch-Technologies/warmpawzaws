import type { Dashboardstats } from '../types';

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
} | null | undefined): number {
  if (!res || res.success === false) return 0;
  const fromApi = res.unreadCount;
  if (typeof fromApi === 'number' && !Number.isNaN(fromApi)) return fromApi;
  const rows = res.notifications || [];
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
  