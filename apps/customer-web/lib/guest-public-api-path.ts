/**
 * Rewrite JWT-gated browse paths to /public/* aliases when the user is a guest.
 */

import { getStoredCustomerJwtForSession } from './session-utils';

function hasJwt(): boolean {
  try {
    return !!getStoredCustomerJwtForSession();
  } catch {
    return false;
  }
}

/**
 * Map authenticated browse endpoints to public-read aliases for guests.
 * Write/customer-owned paths are left unchanged (still 401 without JWT).
 */
export function resolveGuestPublicApiPath(path: string): string {
  if (!path || hasJwt()) return path;

  const qIndex = path.indexOf('?');
  const pathname = qIndex >= 0 ? path.slice(0, qIndex) : path;
  const q = qIndex >= 0 ? path.slice(qIndex) : '';

  if (pathname === '/customer/discover-services') {
    return `/public/discover-services${q}`;
  }

  if (pathname === '/customer/services/by-style') {
    return `/public/services/by-style${q}`;
  }

  if (pathname === '/customer/discovery/count') {
    return `/public/discovery/count${q}`;
  }

  if (pathname === '/customer/discovery/category-bootstrap') {
    return `/public/discovery/category-bootstrap${q}`;
  }

  if (pathname === '/config/service-launch/customer') {
    return `/public/config/service-launch/customer${q}`;
  }

  if (pathname === '/customer/warmpawz-appointments/discovery/by-style') {
    return `/public/warmpawz-appointments/discovery/by-style${q}`;
  }

  if (pathname === '/customer/warmpawz-appointments/discovery/by-category') {
    return `/public/warmpawz-appointments/discovery/by-category${q}`;
  }

  if (pathname === '/customer/vendors/search') {
    return `/public/vendors/search${q}`;
  }

  if (pathname === '/customer/services') {
    return `/public/services${q}`;
  }

  if (pathname === '/customer/discovery/meta') {
    return `/public/discovery/meta${q}`;
  }

  const vendorServicesMatch = pathname.match(/^\/customer\/vendor\/([^/]+)\/services$/);
  if (vendorServicesMatch) {
    return `/public/vendor/${vendorServicesMatch[1]}/services${q}`;
  }

  const vendorSlotsMatch = pathname.match(/^\/customer\/vendor\/([^/]+)\/available-slots$/);
  if (vendorSlotsMatch) {
    return `/public/vendor/${vendorSlotsMatch[1]}/available-slots${q}`;
  }

  const vendorProfileMatch = pathname.match(/^\/customer\/vendor\/([^/]+)$/);
  if (vendorProfileMatch) {
    return `/public/vendor/${vendorProfileMatch[1]}/profile${q}`;
  }

  if (pathname.startsWith('/customer/warmpawz-pay/vendors')) {
    return `${pathname.replace('/customer/warmpawz-pay/vendors', '/public/warmpawz-pay/vendors')}${q}`;
  }

  if (pathname === '/ecommerce/products' || pathname.startsWith('/ecommerce/products/')) {
    return `${pathname.replace('/ecommerce/products', '/public/ecommerce/products')}${q}`;
  }

  if (pathname === '/ecommerce/categories') {
    return `/public/ecommerce/categories${q}`;
  }

  if (pathname === '/products' || pathname.startsWith('/products/')) {
    return `${pathname.replace('/products', '/public/ecommerce/products')}${q}`;
  }

  if (pathname === '/customer/articles' || pathname.startsWith('/customer/articles/')) {
    return `${pathname.replace('/customer/articles', '/public/articles')}${q}`;
  }

  if (pathname === '/customer/banners/resolve-cta') {
    return `/public/banners/resolve-cta${q}`;
  }

  if (pathname === '/customer/banners') {
    return `/public/banners${q}`;
  }

  if (pathname === '/search' || pathname === '/search/autocomplete') {
    return `/public${pathname}${q}`;
  }

  return path;
}
