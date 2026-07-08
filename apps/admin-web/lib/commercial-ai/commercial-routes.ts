/** Routes where Commercial AI Copilot is shown (admin commercial surfaces only). */

const COMMERCIAL_ROUTE_PREFIXES = [
  '/promotion-center',
  '/promotions',
  '/policy-center',
  '/marketing',
  '/ecommerce',
  '/finance',
  '/settlements',
  '/notification-engine',
  '/notifications',
];

export function isCommercialAdminRoute(pathname: string): boolean {
  const p = pathname.toLowerCase();
  return COMMERCIAL_ROUTE_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

export function tabFromSearchParams(search: string): string | undefined {
  if (!search) return undefined;
  return new URLSearchParams(search).get('tab') ?? undefined;
}
