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
    const selKeys = Object.keys(normSel);
    if (selKeys.length === 0) return Object.keys(ov).length === 0;
    return selKeys.every((k) => ov[k] === normSel[k]);
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

/** Listing SKU: lowest in-stock SP, tie-break sort_order; else lowest SP any stock. */
function pickListingSkuFromCandidates(candidates: ClientProductSku[]): ClientProductSku | null {
  const priced = candidates.filter((s) => {
    const p = Number(s.price);
    return Number.isFinite(p) && p > 0;
  });
  if (priced.length === 0) return null;
  const minPrice = Math.min(...priced.map((s) => Number(s.price)));
  const atMin = sortClientSkusByDefaultOrder(priced).filter(
    (s) => Number(s.price).toFixed(2) === minPrice.toFixed(2),
  );
  return atMin[0] ?? null;
}

export function getListingProductSku(skus: ClientProductSku[]): ClientProductSku | null {
  const active = skus.filter((s) => s.is_active !== false);
  const inStock = active.filter((s) => (Number(s.stock) || 0) > 0);
  return pickListingSkuFromCandidates(inStock) ?? pickListingSkuFromCandidates(active);
}

/** @deprecated Use getListingProductSku — listing SKU is the storefront featured variant. */
export function getDefaultProductSku(skus: ClientProductSku[]): ClientProductSku | null {
  return getListingProductSku(skus);
}

export function sortClientSkusByDefaultOrder(skus: ClientProductSku[]): ClientProductSku[] {
  return [...skus].sort((a, b) => {
    const ao = Number(a.sort_order);
    const bo = Number(b.sort_order);
    return (Number.isFinite(ao) ? ao : 0) - (Number.isFinite(bo) ? bo : 0);
  });
}

/** First in-stock SKU by sort_order among active rows. */
export function getFirstInStockProductSku(skus: ClientProductSku[]): ClientProductSku | null {
  const ordered = sortClientSkusByDefaultOrder(skus.filter((s) => s.is_active !== false));
  return ordered.find((s) => (Number(s.stock) || 0) > 0) ?? null;
}

/** PDP initial selection: listing SKU (lowest in-stock selling price). */
export function getInitialProductSku(skus: ClientProductSku[]): ClientProductSku | null {
  return getListingProductSku(skus);
}

/** True when selection does not resolve to a full SKU match. */
export function hasIncompleteVariantSelection(
  skus: ClientProductSku[],
  selected: Record<string, string>,
): boolean {
  if (skus.length === 0) return false;
  return resolveSkuFromSelection(skus, selected) == null;
}

function activeSkusWithOptionValues(skus: ClientProductSku[]): ClientProductSku[] {
  return skus.filter((s) => {
    if (s.is_active === false) return false;
    const ov = normalizeOptionValues(s.option_values as Record<string, unknown>);
    return Object.keys(ov).length > 0;
  });
}

function upstreamAxisKeysForAvailability(
  axisKey: string,
  selected: Record<string, string>,
  variationAxes?: Array<{ type: string; option_key?: string }>,
): string[] {
  if (variationAxes?.length) {
    const axisOrder = variationAxes.map((a) => variationSelectionKey(a));
    const idx = axisOrder.indexOf(axisKey);
    if (idx >= 0) {
      return axisOrder.slice(0, idx);
    }
  }
  return Object.keys(normalizeOptionValues(selected)).filter((k) => k !== axisKey);
}

/**
 * True if some active, in-stock SKU matches current selection + this axis value.
 * Requires stock > 0 so that out-of-stock variants render as disabled chips on the PDP.
 * Downstream axes are not constrained — they are cleared/snapped when the user picks this value.
 */
export function isOptionValueAvailable(
  skus: ClientProductSku[],
  selected: Record<string, string>,
  axisKey: string,
  optionValue: string,
  variationAxes?: Array<{ type: string; option_key?: string }>,
): boolean {
  const normSel = normalizeOptionValues(selected);
  const upstreamKeys = upstreamAxisKeysForAvailability(axisKey, normSel, variationAxes);
  return activeSkusWithOptionValues(skus).some((s) => {
    const ov = normalizeOptionValues(s.option_values as Record<string, unknown>);
    if (ov[axisKey] !== optionValue) return false;
    if ((Number(s.stock) || 0) <= 0) return false;
    return upstreamKeys.every((k) => {
      const selVal = normSel[k];
      if (!selVal) return true;
      if (!(k in ov)) return true;
      return ov[k] === selVal;
    });
  });
}

/** Distinct values for an axis that remain compatible with the current partial selection. */
export function getAvailableOptionValues(
  skus: ClientProductSku[],
  selected: Record<string, string>,
  axisKey: string,
  variationAxes?: Array<{ type: string; option_key?: string }>,
): string[] {
  const seen = new Set<string>();
  const normSel = normalizeOptionValues(selected);
  const upstreamKeys = upstreamAxisKeysForAvailability(axisKey, normSel, variationAxes);
  for (const s of activeSkusWithOptionValues(skus)) {
    const ov = normalizeOptionValues(s.option_values as Record<string, unknown>);
    const val = ov[axisKey];
    if (!val) continue;
    if ((Number(s.stock) || 0) <= 0) continue;
    const matchesPartial = upstreamKeys.every((k) => {
      const selVal = normSel[k];
      if (!selVal) return true;
      if (!(k in ov)) return true;
      return ov[k] === selVal;
    });
    if (matchesPartial) seen.add(val);
  }
  return [...seen].sort();
}

/** All variation axes have a value but no exact SKU exists. */
export function hasInvalidVariantSelection(
  skus: ClientProductSku[],
  selected: Record<string, string>,
  variationAxes?: Array<{ type: string; option_key?: string }>,
): boolean {
  if (skus.length === 0) return false;
  const withOpts = activeSkusWithOptionValues(skus);
  if (withOpts.length === 0) return false;

  if (variationAxes?.length) {
    for (const axis of variationAxes) {
      const key = variationSelectionKey(axis);
      if (!selected[key]?.trim()) return false;
    }
    return resolveSkuFromSelection(skus, selected) == null;
  }

  const refKeys = new Set<string>();
  for (const s of withOpts) {
    Object.keys(normalizeOptionValues(s.option_values as Record<string, unknown>)).forEach((k) =>
      refKeys.add(k),
    );
  }
  for (const k of refKeys) {
    if (!selected[k]?.trim()) return false;
  }
  return resolveSkuFromSelection(skus, selected) == null;
}

/** Exact SKU when fully selected; partial only while selection is incomplete. */
export function resolveDisplaySku(
  skus: ClientProductSku[],
  selected: Record<string, string>,
  variationAxes?: Array<{ type: string; option_key?: string }>,
): ClientProductSku | null {
  if (skus.length === 0) return null;
  const exact = resolveSkuFromSelection(skus, selected);
  if (exact) return exact;

  const incomplete =
    Boolean(variationAxes?.length) &&
    variationAxes!.some((a) => !selected[variationSelectionKey(a)]?.trim());
  if (incomplete) {
    return resolveSkuFromSelection(skus, selected, { partial: true });
  }
  return null;
}

/** After changing one axis, clear invalid downstream picks and snap to a valid SKU when possible. */
export function sanitizeVariantSelection(
  skus: ClientProductSku[],
  selected: Record<string, string>,
  changedAxisKey: string,
  newValue: string,
  variationAxes: Array<{ type: string; option_key?: string }>,
): Record<string, string> {
  let next: Record<string, string> = { ...selected, [changedAxisKey]: newValue };
  const axisOrder = variationAxes.map((a) => variationSelectionKey(a));
  const changedIdx = axisOrder.indexOf(changedAxisKey);
  if (changedIdx >= 0) {
    for (let i = changedIdx + 1; i < axisOrder.length; i++) {
      delete next[axisOrder[i]];
    }
  }

  if (resolveSkuFromSelection(skus, next)) return next;

  const partial = resolveSkuFromSelection(skus, next, { partial: true });
  if (partial?.option_values) {
    const ov = optionValuesToSelectedVariations(
      partial.option_values as Record<string, unknown>,
      variationAxes.map((a) => ({ type: a.type, name: a.type, option_key: a.option_key })),
    );
    next = { ...next, ...ov };
  }
  return next;
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
  variationAxes?: Array<{ type: string; option_key?: string }>,
): number {
  if (skus.length === 0) return fallbackPrice ?? 0;
  const sku =
    resolveDisplaySku(skus, selected, variationAxes) ?? getListingProductSku(skus);
  if (!sku) return fallbackPrice ?? 0;
  return parseClientSkuPrice(sku.price, fallbackPrice);
}
