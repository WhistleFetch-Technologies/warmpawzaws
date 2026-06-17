/**
 * Client-side SKU resolution for product detail and cart (mirrors backend product-sku-resolve).
 */

export type ClientProductSku = {
  id: string;
  sku?: string;
  option_values?: Record<string, string>;
  price?: number;
  compare_at_price?: number | null;
  stock?: number;
  images?: string[];
  is_active?: boolean;
};

export function normalizeOptionValues(
  raw: Record<string, unknown> | null | undefined,
): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = String(k).trim().toLowerCase();
    const val = String(v ?? '').trim();
    if (key && val) out[key] = val;
  }
  const sorted: Record<string, string> = {};
  for (const k of Object.keys(out).sort()) sorted[k] = out[k];
  return sorted;
}

export function resolveSkuFromSelection(
  skus: ClientProductSku[],
  selected: Record<string, string>,
  opts?: { partial?: boolean },
): ClientProductSku | null {
  const active = skus.filter((s) => s.is_active !== false);
  const normSel = normalizeOptionValues(selected);

  const exact = active.find((s) => {
    const ov = normalizeOptionValues(s.option_values as Record<string, unknown>);
    const keys = Object.keys(ov);
    if (keys.length === 0) return Object.keys(normSel).length === 0;
    if (Object.keys(normSel).length !== keys.length) return false;
    return keys.every((k) => normSel[k] === ov[k]);
  });
  if (exact) return exact;

  if (opts?.partial && Object.keys(normSel).length > 0) {
    return (
      active.find((s) => {
        const ov = normalizeOptionValues(s.option_values as Record<string, unknown>);
        return Object.entries(normSel).every(([k, v]) => ov[k] === v);
      }) ?? null
    );
  }
  return null;
}

export function skuImages(sku: ClientProductSku | null | undefined): string[] {
  if (!sku?.images) return [];
  return sku.images.filter((u) => typeof u === 'string' && u.trim());
}

export function cartLineKey(productId: string, productSkuId?: string | null): string {
  return productSkuId ? `${productId}::${productSkuId}` : productId;
}

export function parseCartLineKey(lineKey: string): { productId: string; productSkuId?: string } {
  const parts = String(lineKey).split('::');
  if (parts.length >= 2 && parts[1]) {
    return { productId: parts[0], productSkuId: parts[1] };
  }
  return { productId: lineKey };
}
