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
  sort_order?: number;
};

export function normalizeOptionValues(
  raw: Record<string, unknown> | null | undefined,
): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const rawKey = String(k).trim().toLowerCase();
    const key = rawKey === 'colour' ? 'color' : rawKey;
    const val = String(v ?? '').trim();
    if (key && val) out[key] = val;
  }
  const sorted: Record<string, string> = {};
  for (const k of Object.keys(out).sort()) sorted[k] = out[k];
  return sorted;
}

export function parseClientSkuPrice(raw: unknown, fallback?: number): number {
  if (raw == null || raw === '') {
    return fallback ?? 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : (fallback ?? 0);
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

/** Default SKU: lowest sort_order among active rows (Phase 1). */
export function getDefaultProductSku(skus: ClientProductSku[]): ClientProductSku | null {
  const active = skus.filter((s) => s.is_active !== false);
  const ordered = [...active].sort((a, b) => {
    const ao = Number(a.sort_order);
    const bo = Number(b.sort_order);
    return (Number.isFinite(ao) ? ao : 0) - (Number.isFinite(bo) ? bo : 0);
  });
  return ordered[0] ?? null;
}

/** Selection key for a variation axis (prefer API option_key). */
export function variationSelectionKey(variation: {
  type: string;
  option_key?: string;
}): string {
  const key = variation.option_key?.trim();
  return key || variation.type;
}

/** Map API option_values to selection keys used by the detail UI. */
export function optionValuesToSelectedVariations(
  raw: Record<string, unknown> | null | undefined,
  variations?: Array<{ type: string; name: string; option_key?: string }>,
): Record<string, string> {
  const norm = normalizeOptionValues(raw);
  if (!variations?.length) {
    return { ...norm };
  }
  const out: Record<string, string> = {};
  for (const variation of variations) {
    const selKey = variationSelectionKey(variation);
    const typeKey = variation.type;
    const val =
      norm[selKey] ??
      norm[typeKey] ??
      (typeKey === 'color' ? norm.color : undefined) ??
      norm[variation.name.toLowerCase()] ??
      norm[variation.name.trim().toLowerCase()];
    if (val) out[selKey] = val;
  }
  return out;
}

/** Price for a hypothetical selection (used for option chips and detail header). */
export function resolveSkuPriceForSelection(
  skus: ClientProductSku[],
  selected: Record<string, string>,
  fallbackPrice?: number,
): number {
  if (skus.length === 0) return fallbackPrice ?? 0;
  const sku =
    resolveSkuFromSelection(skus, selected) ??
    resolveSkuFromSelection(skus, selected, { partial: true }) ??
    getDefaultProductSku(skus);
  if (!sku) return fallbackPrice ?? 0;
  return parseClientSkuPrice(sku.price, fallbackPrice);
}
