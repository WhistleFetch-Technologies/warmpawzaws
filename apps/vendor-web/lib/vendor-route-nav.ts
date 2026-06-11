import { isNativeCapacitorShell } from '@/lib/notification-display-policy';

type RouterLike = { push: (href: string) => void };

/** Routes that load large lazy chunks — SPA nav on Android keeps stale webpack manifests. */
export function isChunkHeavyVendorRoute(href: string): boolean {
  const path = href.split('?')[0].split('#')[0];
  return (
    path === '/settings' ||
    path.startsWith('/settings/') ||
    path === '/services' ||
    path.startsWith('/services/')
  );
}

export function shouldUseHardDocumentNavigation(): boolean {
  if (typeof window === 'undefined') return false;
  if (isNativeCapacitorShell()) return true;
  return /Android/i.test(navigator.userAgent);
}

/**
 * On Android / Capacitor, use a full document navigation so the route HTML shell
 * and chunk manifest match the latest deploy (fixes "Loading chunk N failed").
 */
export function vendorNavigate(href: string, router?: RouterLike): void {
  if (typeof window === 'undefined') return;

  if (shouldUseHardDocumentNavigation() && isChunkHeavyVendorRoute(href)) {
    const url = new URL(href, window.location.origin);
    url.searchParams.set('_v', String(Date.now()));
    window.location.assign(url.pathname + url.search + url.hash);
    return;
  }

  if (router) {
    router.push(href);
    return;
  }

  window.location.assign(href);
}
