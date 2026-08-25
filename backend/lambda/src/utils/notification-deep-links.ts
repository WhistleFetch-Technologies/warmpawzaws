/**
 * Default deep links for FCM data payloads (Capacitor push-navigation.ts consumes these).
 */

export type DeepLinkRecipientType = 'customer' | 'vendor' | 'admin' | 'staff';

export function resolveNotificationDeepLink(params: {
  eventType: string;
  recipientType: DeepLinkRecipientType;
  bookingId?: string;
  orderId?: string;
  deepLinkOverride?: string;
}): string {
  const override = String(params.deepLinkOverride || '').trim();
  if (override) return override;

  const eventType = String(params.eventType || '').toLowerCase();
  const isVendor = params.recipientType === 'vendor';
  const bookingId = String(params.bookingId || '').trim();
  const orderId = String(params.orderId || '').trim();

  if (
    bookingId &&
    (eventType.includes('video') ||
      eventType.includes('tele_call') ||
      eventType === 'video_call_reminder_5min')
  ) {
    return isVendor ? `/video/${encodeURIComponent(bookingId)}` : `/video?bookingId=${encodeURIComponent(bookingId)}`;
  }

  if (
    eventType.includes('booking') ||
    eventType === 'new_booking' ||
    eventType === 'rating_request' ||
    eventType === 'chat_message'
  ) {
    return isVendor ? '/bookings' : '/my-bookings';
  }

  if (
    eventType.includes('order') ||
    eventType.includes('meal_') ||
    eventType.includes('pharmacy_order') ||
    eventType.startsWith('shop_order')
  ) {
    if (isVendor && eventType.includes('pharmacy')) return '/pharmacy/orders';
    if (orderId && isVendor) return `/orders`;
    return '/orders';
  }

  if (eventType.includes('settlement') || eventType.includes('payout') || eventType === 'warmpawz_pay_received') {
    return isVendor ? '/settlements' : '/wallet';
  }

  if (eventType.includes('vendor_application') || eventType.includes('vendor_approved') || eventType.includes('vendor_rejected')) {
    return isVendor ? '/dashboard' : '/';
  }

  if (eventType === 'campaign') {
    return isVendor ? '/dashboard' : '/';
  }

  if (eventType.includes('vaccination')) {
    return isVendor ? '/dashboard' : '/vet';
  }

  return isVendor ? '/dashboard' : '/';
}
