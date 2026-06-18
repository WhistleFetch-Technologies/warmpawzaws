import { navigateFromPushPayload } from '@/lib/push-navigation';
import { parseInternalPathFromUrl } from './deep-link-stack';
import { ensureDeepLinkBackStack } from './deep-link-stack';

function isSafeInternalPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  return !path.includes('://');
}

/**
 * Navigate to an internal path from App Link / push / universal link.
 * Uses assign so Capacitor WebView reloads the route consistently.
 */
export function navigateCustomerDeepLink(pathOrUrl: string): void {
  if (typeof window === 'undefined') return;

  const trimmed = pathOrUrl.trim();
  if (!trimmed) return;

  if (/^https?:\/\//i.test(trimmed)) {
    const internal = parseInternalPathFromUrl(trimmed);
    if (internal && isSafeInternalPath(internal.split('?')[0])) {
      window.location.assign(internal);
      return;
    }
    window.location.assign(trimmed);
    return;
  }

  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (!isSafeInternalPath(path.split('?')[0])) return;

  window.location.assign(path);
}

/** After navigation lands, call from page clients to fix Back stack on cold open. */
export function applyDeepLinkBackStackForCurrentPath(): void {
  if (typeof window === 'undefined') return;
  ensureDeepLinkBackStack(window.location.pathname);
}

/** Capacitor `appUrlOpen` — same-origin paths only. */
export function handleCapacitorAppUrlOpen(url: string): void {
  const internal = parseInternalPathFromUrl(url);
  if (internal) {
    navigateCustomerDeepLink(internal);
    return;
  }
  navigateCustomerDeepLink(url);
}

/** Push notification data map → existing push navigation (unchanged behavior). */
export function handlePushDeepLink(data: Record<string, string | undefined>): void {
  navigateFromPushPayload(data);
}
