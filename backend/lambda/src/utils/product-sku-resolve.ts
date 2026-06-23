/**
 * Product SKU resolution — option_values matching, variation axes, customer UI adapters.
 */

export type ProductSkuRow = {
  id?: string;
  sku?: string;
  option_values?: Record<string, string> | null;
  price?: number | string;
  compare_at_price?: number | string | null;
  stock?: number | string;
  barcode?: string | null;
  images?: unknown;
  is_active?: boolean;
  sort_order?: number;
};

export type VariationAxis = {
  key: string;
  name: string;
  type: 'color' | 'size' | 'weight' | 'other';
  values: string[];
};

export type CustomerVariationOption = {
  value: string;
  price?: number;
  price_modifier?: number;
  stock?: number;
  image?: string;
};

export type CustomerVariation = {
  id: string;
  option_key: string;
  name: string;
  type: 'color' | 'size' | 'weight' | 'other';
  options: CustomerVariationOption[];
};

const AXIS_LABELS: Record<string, { name: string; type: VariationAxis['type'] }> = {
  size: { name: 'Size', type: 'size' },
  color: { name: 'Color', type: 'color' },
  colour: { name: 'Color', type: 'color' },
  weight: { name: 'Weight', type: 'weight' },
  pack: { name: 'Pack', type: 'other' },
};

function axisMeta(key: string): { name: string; type: VariationAxis['type'] } {
  const k = key.toLowerCase().trim();
  return AXIS_LABELS[k] ?? { name: key.charAt(0).toUpperCase() + key.slice(1), type: 'other' };
}

/** Lowercase keys, trim values, stable key order for DB uniqueness. */
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
  for (const k of Object.keys(out).sort()) {
    sorted[k] = out[k];
  }
  return sorted;
}

export function optionValuesMatch(
  skuValues: Record<string, string>,
  selected: Record<string, string>,
  requireAllAxes = true,
): boolean {
  const normSku = normalizeOptionValues(skuValues);
  const normSel = normalizeOptionValues(selected);
  if (requireAllAxes) {
    const skuKeys = Object.keys(normSku);
    if (skuKeys.length === 0) return Object.keys(normSel).length === 0;
    if (Object.keys(normSel).length !== skuKeys.length) return false;
    return skuKeys.every((k) => normSel[k] === normSku[k]);
  }
  return Object.entries(normSel).every(([k, v]) => normSku[k] === v);
}

export function resolveSkuFromSelection(
  skus: ProductSkuRow[],
  selected: Record<string, string>,
  opts?: { partial?: boolean },
): ProductSkuRow | null {
  const active = skus.filter((s) => s.is_active !== false);
  const exact = active.find((s) =>
    optionValuesMatch(normalizeOptionValues(s.option_values as Record<string, string>), selected, true),
  );
  if (exact) return exact;
  if (opts?.partial && Object.keys(normalizeOptionValues(selected)).length > 0) {
    const partial = active.find((s) =>
      optionValuesMatch(
        normalizeOptionValues(s.option_values as Record<string, string>),
        selected,
        false,
      ),
    );
    return partial ?? null;
  }
  return null;
}

export function buildVariationAxes(skus: ProductSkuRow[]): VariationAxis[] {
  const valueSets: Record<string, Set<string>> = {};
  for (const sku of skus) {
    if (sku.is_active === false) continue;
    const ov = normalizeOptionValues(sku.option_values as Record<string, string>);
    for (const [k, v] of Object.entries(ov)) {
      if (!valueSets[k]) valueSets[k] = new Set();
      valueSets[k].add(v);
    }
  }
  return Object.keys(valueSets)
    .sort()
    .map((key) => {
      const meta = axisMeta(key);
      return {
        key,
        name: meta.name,
        type: meta.type,
        values: [...valueSets[key]].sort(),
      };
    });
}

export function aggregateParentStock(skus: ProductSkuRow[]): number {
  return skus
    .filter((s) => s.is_active !== false)
    .reduce((sum, s) => sum + (Number(s.stock) || 0), 0);
}

export function minSkuPrice(skus: ProductSkuRow[]): number | null {
  const prices = skus
    .filter((s) => s.is_active !== false)
    .map((s) => Number(s.price))
    .filter((p) => Number.isFinite(p) && p > 0);
  return prices.length ? Math.min(...prices) : null;
}

/** Active SKUs ordered by sort_order ASC (stable default-variant selection). */
export function sortSkusByDefaultOrder(skus: ProductSkuRow[]): ProductSkuRow[] {
  return [...skus]
    .filter((s) => s.is_active !== false)
    .sort((a, b) => {
      const ao = Number(a.sort_order);
      const bo = Number(b.sort_order);
      const aOrd = Number.isFinite(ao) ? ao : 0;
      const bOrd = Number.isFinite(bo) ? bo : 0;
      if (aOrd !== bOrd) return aOrd - bOrd;
      return 0;
    });
}

/** Default sellable SKU: lowest sort_order among active rows (Phase 1 — no is_default column). */
export function getDefaultProductSku(skus: ProductSkuRow[]): ProductSkuRow | null {
  const ordered = sortSkusByDefaultOrder(skus);
  return ordered[0] ?? null;
}

/** True when active SKUs have more than one distinct selling price. */
export function hasVariableSkuPricing(skus: ProductSkuRow[]): boolean {
  const prices = sortSkusByDefaultOrder(skus)
    .map((s) => Number(s.price))
    .filter((p) => Number.isFinite(p) && p > 0);
  if (prices.length <= 1) return false;
  const unique = new Set(prices.map((p) => p.toFixed(2)));
  return unique.size > 1;
}

export function mapSkusToCustomerVariations(
  skus: ProductSkuRow[],
  axes?: VariationAxis[],
): CustomerVariation[] {
  const variationAxes = axes ?? buildVariationAxes(skus);
  const active = skus.filter((s) => s.is_active !== false);
  const defaultSku = getDefaultProductSku(active);
  const refPrice = defaultSku ? Number(defaultSku.price) : 0;

  return variationAxes.map((axis, idx) => {
    const key = axis.key;

    const options: CustomerVariationOption[] = axis.values.map((value) => {
      const matching = active.filter((s) => {
        const ov = normalizeOptionValues(s.option_values as Record<string, string>);
        return ov[key] === value;
      });
      const sku = matching[0];
      const imgs = normalizeImagesArray(sku?.images);
      const optPrice = sku ? Number(sku.price) : NaN;
      const price = Number.isFinite(optPrice) && optPrice > 0 ? optPrice : undefined;
      const price_modifier =
        price != null && refPrice > 0 && price > refPrice
          ? Math.round(price - refPrice)
          : undefined;
      return {
        value,
        stock: matching.reduce((sum, s) => sum + (Number(s.stock) || 0), 0),
        image: imgs[0] ?? undefined,
        price,
        price_modifier,
      };
    });

    return {
      id: `axis-${idx}`,
      option_key: key,
      name: axis.name,
      type: axis.type,
      options,
    };
  });
}

export function normalizeImagesArray(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const o = item as Record<string, unknown>;
          return String(o.url ?? o.src ?? o.image_url ?? '').trim();
        }
        return '';
      })
      .filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return normalizeImagesArray(parsed);
    } catch {
      return [raw.trim()];
    }
  }
  return [];
}

/** Legacy flat variant from metadata.variants */
export function metadataVariantsToSkus(
  variants: unknown[],
  parentPrice?: number,
): Array<{
  option_values: Record<string, string>;
  price: number;
  compare_at_price?: number | null;
  stock: number;
  sku?: string | null;
  images: string[];
}> {
  if (!Array.isArray(variants)) return [];
  return variants.map((v) => {
    const row = v as Record<string, unknown>;
    const option_values = normalizeOptionValues({
      size: row.size,
      color: row.color ?? row.colour,
    });
    return {
      option_values,
      price: Number(row.price) || parentPrice || 0,
      compare_at_price: row.compare_at_price != null ? Number(row.compare_at_price) : null,
      stock: Number(row.stock) || 0,
      sku: row.sku ? String(row.sku) : null,
      images: normalizeImagesArray(row.images),
    };
  });
}

/**
 * When product_skus rows exist but images were left empty (e.g. migration 1033 backfill),
 * merge images from legacy metadata.variants by option_values match, then by sort index.
 */
export function mergeLegacyVariantImagesIntoSkus(
  skus: ProductSkuRow[],
  legacyVariants: unknown[],
): ProductSkuRow[] {
  if (!Array.isArray(skus) || skus.length === 0) return skus;
  if (!Array.isArray(legacyVariants) || legacyVariants.length === 0) return skus;

  const legacySkus = metadataVariantsToSkus(legacyVariants);

  return skus.map((sku, idx) => {
    const existing = normalizeImagesArray(sku.images);
    if (existing.length > 0) return sku;

    const byOptions = legacySkus.find((l) =>
      optionValuesMatch(l.option_values, sku.option_values ?? {}, true),
    );
    const fromMatch = byOptions ? normalizeImagesArray(byOptions.images) : [];
    const legacyRow = legacyVariants[idx] as Record<string, unknown> | undefined;
    const fromIndex = legacyRow ? normalizeImagesArray(legacyRow.images) : [];
    const merged = fromMatch.length > 0 ? fromMatch : fromIndex;

    if (merged.length === 0) return sku;
    return { ...sku, images: merged };
  });
}

export function buildGalleryImageUnion(parentImages: string[], skus: ProductSkuRow[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of parentImages) {
    const u = url.trim();
    if (u && !seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  for (const sku of skus) {
    if (sku.is_active === false) continue;
    for (const url of normalizeImagesArray(sku.images)) {
      if (!seen.has(url)) {
        seen.add(url);
        out.push(url);
      }
    }
  }
  return out;
}
