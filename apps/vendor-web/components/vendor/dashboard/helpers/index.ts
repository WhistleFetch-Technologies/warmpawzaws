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
  