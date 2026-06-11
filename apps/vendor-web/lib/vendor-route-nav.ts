import { isNativeCapacitorShell } from '@/lib/notification-display-policy';

type RouterLike = { push: (href: string) => void };

/** Routes that load large lazy chunks — SPA nav keeps stale webpack manifests after deploy. */
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
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return true;
  // iOS WKWebView (no Safari token in UA)
  if (/iPhone|iPad|iPod/i.test(ua) && /AppleWebKit/i.test(ua) && !/Safari/i.test(ua)) return true;
  return /Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

/** Map Next.js static-export path to the matching .html shell on S3/CloudFront. */
export function toStaticExportHtmlPath(pathname: string): string {
  if (!pathname || pathname === '/') return '/index.html';
  if (pathname.endsWith('.html')) return pathname;
  return `${pathname.replace(/\/$/, '')}.html`;
}

/**
 * Use a full document load (with cache-bust) for service/settings routes so the
 * HTML shell and webpack chunk manifest always match the latest deploy.
 */
export function vendorNavigate(href: string, router?: RouterLike): void {
  if (typeof window === 'undefined') return;

  if (isChunkHeavyVendorRoute(href)) {
    const url = new URL(href, window.location.origin);
    url.pathname = toStaticExportHtmlPath(url.pathname);
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
