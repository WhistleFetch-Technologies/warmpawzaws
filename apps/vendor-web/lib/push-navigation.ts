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

function assignVendorPath(pathWithOptionalQuery: string): void {
  const path = pathWithOptionalQuery.startsWith('/')
    ? pathWithOptionalQuery
    : `/${pathWithOptionalQuery}`;
  const qIndex = path.indexOf('?');
  const pathOnly = (qIndex >= 0 ? path.slice(0, qIndex) : path).split('#')[0];
  const query = qIndex >= 0 ? path.slice(qIndex) : '';

  if (!isSafeInternalPath(pathOnly)) {
    window.location.assign('/dashboard');
    return;
  }

  const seg = pathOnly.replace(/^\/+/, '').split('/').filter(Boolean)[0]?.toLowerCase() || '';
  if (seg && VENDOR_ROUTE_ALIASES[seg]) {
    window.location.assign(`${VENDOR_ROUTE_ALIASES[seg]}${query}`);
    return;
  }
  window.location.assign(pathOnly === '/' ? '/dashboard' : `${pathOnly}${query}`);
}

/** @param data FCM `data` map (all string values). */
export function navigateFromPushPayload(data: Record<string, string | undefined>): void {
  if (typeof window === 'undefined') return;

  const payload = normalizePushData(data);
  const deepLink = (payload.deep_link || payload.deepLink || '').trim();
  const type = (payload.type || '').toLowerCase();
  const bookingId = payload.booking_id || payload.bookingId;

  console.log('[push-navigation] vendor tap navigate', { type, deepLink, bookingId });

  if (type === 'warmpawz_pay_received' || type.includes('warmpawz_pay')) {
    assignVendorPath(deepLink || '/bookings?tab=earnings');
    return;
  }

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

  assignVendorPath(deepLink);
}
