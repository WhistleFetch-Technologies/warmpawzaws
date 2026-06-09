/** Resolve product id for /shop/[productId] when CloudFront serves placeholder.html. */
export function normalizeShopProductId(value?: string | null): string {
  const s = String(value || '').trim();
  if (!s || s === 'placeholder' || s === '_') return '';
  return s;
}

export function resolveShopProductIdFromLocation(
  routeParam?: string | null
): string {
  if (typeof window !== 'undefined') {
    const fromPath = window.location.pathname.match(/\/shop\/([^/?]+)/)?.[1];
    const normalized = normalizeShopProductId(fromPath);
    if (normalized) return normalized;
  }
  return normalizeShopProductId(routeParam);
}
