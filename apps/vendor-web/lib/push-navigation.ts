/**
 * Navigate after the user taps a tray push (Capacitor pushNotificationActionPerformed).
 */

const VENDOR_ROUTE_ALIASES: Record<string, string> = {
  booking: '/bookings',
  bookings: '/bookings',
  dashboard: '/dashboard',
  home: '/dashboard',
  video: '/video',
  orders: '/orders',
  pharmacy: '/pharmacy/orders',
  notifications: '/dashboard',
  settlements: '/settlements',
  earnings: '/earnings',
};

function isSafeInternalPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  return !path.includes('://');
}

function normalizePushData(raw: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v != null && String(v).length > 0) out[k] = String(v);
  }
  return out;
}

/** @param data FCM `data` map (all string values). */
export function navigateFromPushPayload(data: Record<string, string | undefined>): void {
  if (typeof window === 'undefined') return;

  const payload = normalizePushData(data);
  const deepLink = (payload.deep_link || payload.deepLink || '').trim();
  const type = (payload.type || '').toLowerCase();
  const bookingId = payload.booking_id || payload.bookingId;

  console.log('[push-navigation] vendor tap navigate', { type, deepLink, bookingId });

  if (bookingId && (type.includes('video') || deepLink.includes('video'))) {
    window.location.assign(`/video/${encodeURIComponent(bookingId)}`);
    return;
  }

  if (bookingId || type.includes('booking')) {
    window.location.assign('/bookings');
    return;
  }

  if (!deepLink) {
    window.location.assign('/dashboard');
    return;
  }

  if (/^https?:\/\//i.test(deepLink)) {
    window.location.assign(deepLink);
    return;
  }

  const path = deepLink.startsWith('/') ? deepLink : `/${deepLink}`;
  const pathOnly = path.split('?')[0].split('#')[0];

  if (isSafeInternalPath(pathOnly)) {
    const seg = pathOnly.replace(/^\/+/, '').split('/').filter(Boolean)[0]?.toLowerCase() || '';
    if (seg && VENDOR_ROUTE_ALIASES[seg]) {
      window.location.assign(VENDOR_ROUTE_ALIASES[seg]);
      return;
    }
    window.location.assign(pathOnly === '/' ? '/dashboard' : path);
    return;
  }

  window.location.assign('/dashboard');
}
