/** Navigation policy for a customer route. */
export type RoutePolicy = 'push' | 'replace' | 'reset' | 'focus';

export type CustomerTabId = 'home' | 'shop' | 'bookings' | 'profile' | 'warmpawz-pay';

/** Stable keys for duplicate-route prevention (shell + URL). */
export const routeKey = {
  product: (id: string) => `product:${String(id).trim()}`,
  vendor: (id: string) => `vendor:${String(id).trim()}`,
  order: (id: string) => `order:${String(id).trim()}`,
  booking: (id: string) => `booking:${String(id).trim()}`,
  clinic: (id: string) => `clinic:${String(id).trim()}`,
  doctor: (id: string) => `doctor:${String(id).trim()}`,
  pet: (id: string) => `pet:${String(id).trim()}`,
  packagePurchase: (vendorServiceId: string) =>
    `package:${String(vendorServiceId).trim()}`,
  problemFlow: (problemId: string) => `problem-flow:${String(problemId).trim()}`,
} as const;

export type CustomerRouteDef = {
  path: string;
  shell?: string;
  tabRoot?: boolean;
  policy?: RoutePolicy;
  key?: string;
};

export const CUSTOMER_ROUTES = {
  home: { path: '/', shell: 'home', tabRoot: true, policy: 'reset' } satisfies CustomerRouteDef,
  shop: { path: '/shop', shell: 'shop', tabRoot: true, policy: 'push' } satisfies CustomerRouteDef,
  bookings: { path: '/bookings', shell: 'my-bookings', tabRoot: true, policy: 'focus' } satisfies CustomerRouteDef,
  warmpawzPay: { path: '/warmpawz-pay', tabRoot: true, policy: 'focus' } satisfies CustomerRouteDef,
  cart: { path: '/cart', policy: 'push' } satisfies CustomerRouteDef,
  checkout: { path: '/checkout', shell: 'checkout', policy: 'push' } satisfies CustomerRouteDef,
  orders: { path: '/orders', shell: 'order_history', policy: 'replace' } satisfies CustomerRouteDef,
  auth: { path: '/auth', policy: 'replace' } satisfies CustomerRouteDef,
  wishlist: { path: '/wishlist', policy: 'push' } satisfies CustomerRouteDef,

  product: (productId: string): CustomerRouteDef => ({
    path: `/shop/${encodeURIComponent(String(productId).trim())}`,
    shell: 'product_detail',
    policy: 'push',
    key: routeKey.product(productId),
  }),

  orderTracking: (orderId: string): CustomerRouteDef => ({
    path: `/orders?expand=${encodeURIComponent(String(orderId).trim())}`,
    shell: 'order_history',
    policy: 'replace',
    key: routeKey.order(orderId),
  }),
} as const;

export function productPath(productId: string): string {
  return CUSTOMER_ROUTES.product(productId).path;
}

export function orderTrackingPath(orderId: string): string {
  return CUSTOMER_ROUTES.orderTracking(orderId).path;
}

export function isCurrentPath(pathname: string, targetPath: string): boolean {
  const norm = (p: string) => p.split('?')[0].replace(/\/+$/, '') || '/';
  return norm(pathname) === norm(targetPath);
}
