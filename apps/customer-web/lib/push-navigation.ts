/**
 * Navigate after the user taps a tray push (Capacitor pushNotificationActionPerformed).
 * Uses existing SPA resume keys and Next routes — no native rebuild required.
 */

import {
  WARMPAWZ_HOME_RESUME_SCREENS,
  WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY,
} from './go-back-or-replace';
import { navigateCustomerDeepLink } from './navigation/deep-link-navigation';
import { resolveFeaturedVendorDestination } from './promotion-navigation';

const CUSTOMER_FULL_ROUTES = new Set([
  '/shop',
  '/promotions',
  '/wallet',
  '/orders',
  '/search',
  '/wishlist',
  '/auth',
]);

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

function openSpaScreen(screen: string): void {
  const safe = WARMPAWZ_HOME_RESUME_SCREENS.has(screen) ? screen : 'home';
  if (safe === 'shop') {
    window.location.assign('/shop');
    return;
  }
  sessionStorage.setItem(WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY, safe);
  window.location.assign('/');
}

/** @param data FCM `data` map (all string values). */
export function navigateFromPushPayload(data: Record<string, string | undefined>): void {
  if (typeof window === 'undefined') return;

  const payload = normalizePushData(data);
  const deepLink = (payload.deep_link || payload.deepLink || '').trim();
  const type = (payload.type || payload.eventType || '').toLowerCase();
  const bookingId = payload.booking_id || payload.bookingId;

  console.log('[push-navigation] customer tap navigate', { type, deepLink, bookingId });

  if (type.includes('vaccination') && !deepLink) {
    openSpaScreen('vet');
    return;
  }

  if (bookingId && (type.includes('video') || deepLink.includes('video'))) {
    window.location.assign(`/video?bookingId=${encodeURIComponent(bookingId)}`);
    return;
  }

  if (bookingId || type.includes('booking')) {
    openSpaScreen('my-bookings');
    return;
  }

  if (!deepLink) {
    window.location.assign('/');
    return;
  }

  if (/^https?:\/\//i.test(deepLink)) {
    window.location.assign(deepLink);
    return;
  }

  const path = deepLink.startsWith('/') ? deepLink : `/${deepLink}`;
  const pathOnly = path.split('?')[0].split('#')[0];

  if (pathOnly === '/booking' || pathOnly === '/bookings' || pathOnly === '/my-bookings') {
    openSpaScreen('my-bookings');
    return;
  }

  if (pathOnly === '/notifications') {
    openSpaScreen('home');
    return;
  }

  if (isSafeInternalPath(pathOnly) && CUSTOMER_FULL_ROUTES.has(pathOnly)) {
    window.location.assign(path);
    return;
  }

  if (
    isSafeInternalPath(pathOnly) &&
    (pathOnly.startsWith('/shop') ||
      pathOnly.startsWith('/orders') ||
      pathOnly.startsWith('/track') ||
      pathOnly.startsWith('/packages'))
  ) {
    navigateCustomerDeepLink(path);
    return;
  }

  if (isSafeInternalPath(pathOnly) && pathOnly !== '/') {
    const dest = resolveFeaturedVendorDestination({ cta_link: pathOnly });
    if (dest.kind === 'external') {
      window.location.assign(dest.url);
      return;
    }
    if (dest.kind === 'router') {
      window.location.assign(dest.path);
      return;
    }
    openSpaScreen(dest.screen);
    return;
  }

  window.location.assign('/');
}
