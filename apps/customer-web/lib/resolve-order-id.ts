/** Resolve order id for /orders/[id]/… when CloudFront serves placeholder.html. */
export function normalizeOrderId(value?: string | null): string {
  const s = String(value || '').trim();
  if (!s || s === 'placeholder' || s === '_') return '';
  return s;
}

export function resolveOrderIdFromLocation(routeParam?: string | null): string {
  if (typeof window !== 'undefined') {
    const fromPath = window.location.pathname.match(/\/orders\/([^/?]+)/)?.[1];
    const normalized = normalizeOrderId(fromPath);
    if (normalized) return normalized;
  }
  return normalizeOrderId(routeParam);
}
