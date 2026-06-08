import { CUSTOMER_ROUTES, productPath } from './route-registry';

const DEEP_LINK_SEED_PREFIX = 'warmpawz_dl_seeded_';

function normalizePathname(pathname: string): string {
  const p = pathname.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  return p;
}

/** Parent route when cold-opening a deep link (no prior history). */
export function getDeepLinkBackFallback(pathname: string): string {
  const path = normalizePathname(pathname);

  if (/^\/shop\/[^/]+$/.test(path)) return CUSTOMER_ROUTES.shop.path;
  if (/^\/orders\/[^/]+\/tracking$/.test(path)) return CUSTOMER_ROUTES.orders.path;
  if (path === CUSTOMER_ROUTES.checkout.path) return CUSTOMER_ROUTES.cart.path;
  if (path === CUSTOMER_ROUTES.cart.path) return CUSTOMER_ROUTES.shop.path;
  if (path === CUSTOMER_ROUTES.wishlist.path) return CUSTOMER_ROUTES.shop.path;
  if (path === CUSTOMER_ROUTES.bookings.path) return CUSTOMER_ROUTES.home.path;
  if (path.startsWith('/orders')) return CUSTOMER_ROUTES.home.path;
  if (path.startsWith('/shop')) return CUSTOMER_ROUTES.home.path;

  return CUSTOMER_ROUTES.home.path;
}

/**
 * Cold start on e.g. `/shop/abc`: seed `[ /shop, /shop/abc ]` so hardware/browser Back
 * returns to shop instead of exiting the app.
 */
export function ensureDeepLinkBackStack(pathname: string): void {
  if (typeof window === 'undefined') return;

  const path = normalizePathname(pathname);
  const productMatch = path.match(/^\/shop\/([^/]+)$/);
  if (!productMatch) return;

  const seedKey = DEEP_LINK_SEED_PREFIX + path;
  if (sessionStorage.getItem(seedKey) === '1') return;

  // Shallow history typical of App Link / notification cold open.
  if (window.history.length > 2) {
    sessionStorage.setItem(seedKey, '1');
    return;
  }

  const productId = decodeURIComponent(productMatch[1]);
  const productUrl = productPath(productId);
  const shopUrl = `${window.location.origin}${CUSTOMER_ROUTES.shop.path}`;

  window.history.replaceState({ warmpawz: 'shop-root' }, '', CUSTOMER_ROUTES.shop.path);
  window.history.pushState({ warmpawz: 'product', productId }, '', productUrl);

  sessionStorage.setItem(seedKey, '1');
}

export function parseInternalPathFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://customer.warmpawz.com');
    const host = parsed.hostname.toLowerCase();
    const allowed =
      host === 'customer.warmpawz.com' ||
      host === 'localhost' ||
      host.endsWith('.cloudfront.net');
    if (!allowed) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}
