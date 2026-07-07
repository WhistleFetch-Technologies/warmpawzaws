/** Static export ships only `/shop/placeholder` — real id travels in query (see app/layout.tsx). */
export const SHOP_PRODUCT_PLACEHOLDER_PATH = '/shop/placeholder';

export function normalizeShopProductId(value?: string | null): string {
  const s = String(value || '').trim();
  if (!s || s === 'placeholder' || s === '_') return '';
  return s;
}

/** Client navigation + share links for product detail (CloudFront-safe). */
export function shopProductDetailPath(productId: string): string {
  const id = normalizeShopProductId(productId);
  if (!id) return SHOP_PRODUCT_PLACEHOLDER_PATH;
  const qs = new URLSearchParams();
  qs.set('productId', id);
  return `${SHOP_PRODUCT_PLACEHOLDER_PATH}?${qs.toString()}`;
}

/** Resolve product id for /shop/[productId] when CloudFront serves placeholder.html. */
export function resolveShopProductIdFromLocation(routeParam?: string | null): string {
  if (typeof window !== 'undefined') {
    const qs = new URLSearchParams(window.location.search);
    const fromQuery = normalizeShopProductId(qs.get('productId') || qs.get('product_id'));
    if (fromQuery) return fromQuery;

    const fromPath = window.location.pathname.match(/\/shop\/([^/?]+)/)?.[1];
    const normalized = normalizeShopProductId(fromPath);
    if (normalized) return normalized;
  }
  return normalizeShopProductId(routeParam);
}
