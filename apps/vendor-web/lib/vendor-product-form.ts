/**
 * Shared vendor product form types, validation, and API payload builder.
 * Canonical UX: Seller Hub ProductCatalogManagement ProductModal.
 */

import {
  normalizeDeliveryRegionsList,
  formatPetTypeForVendor,
  resolveVendorPetTypeInput,
  PET_TYPE_CUSTOMER_LABEL_ALL_PETS,
  RESERVED_SPEC_KEYS,
  MAX_VARIANT_ATTRIBUTES,
  MAX_SKUS_PER_PRODUCT,
  type VariantPresetSuggestion,
} from '@warmpawz/shared-types';

export type ProductMode = 'simple' | 'multi';

/** Standard pet type options in the vendor product form select. */
export const VENDOR_PET_TYPE_SUGGESTIONS = ['Dog', 'Cat', PET_TYPE_CUSTOMER_LABEL_ALL_PETS] as const;

/** Select value when vendor enters a custom pet type (not Dog/Cat/All pets). */
export const PET_TYPE_SELECT_OTHER = '__other__';

export function isStandardVendorPetTypeInput(input: string): boolean {
  const trimmed = input.trim();
  return trimmed !== '' && (VENDOR_PET_TYPE_SUGGESTIONS as readonly string[]).includes(trimmed);
}

/** Map stored petTypeInput → `<select>` value (native select avoids datalist prefill bugs). */
export function petTypeSelectValueFromInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (isStandardVendorPetTypeInput(trimmed)) return trimmed;
  return PET_TYPE_SELECT_OTHER;
}

export type VendorCategoryOption = {
  id: string;
  name: string;
  parent_category_id?: string | null;
};

/** Resolve category_id for form select (trim UUID, fallback from legacy name fields). Coerces child → parent. */
export function categoryIdForForm(
  product: Record<string, unknown> | null | undefined,
  categories: VendorCategoryOption[] = [],
): string {
  const coerceToParent = (id: string): string => {
    const cat = categories.find((c) => String(c.id) === id);
    if (cat?.parent_category_id) {
      const parent = categories.find((c) => String(c.id) === String(cat.parent_category_id));
      if (parent) return String(parent.id);
      return String(cat.parent_category_id);
    }
    return id;
  };

  const rawId = String(product?.category_id ?? '').trim();
  if (rawId && categories.some((c) => String(c.id) === rawId)) {
    return coerceToParent(rawId);
  }
  const nameHint = String(product?.category_name ?? product?.category ?? '')
    .trim()
    .toLowerCase();
  if (nameHint) {
    const match = categories.find((c) => c.name.trim().toLowerCase() === nameHint);
    if (match) return coerceToParent(String(match.id));
  }
  return rawId ? coerceToParent(rawId) : '';
}

export type SpecKvRow = { id: string; key: string; value: string };
export type VariantAxisPreset = 'size' | 'color' | 'weight' | 'pack' | 'custom';
export type VariantAxisConfig = {
  key: string;
  label: string;
  preset?: VariantAxisPreset;
};
/** @deprecated Use VariantAxisConfig — kept for imports */
export type VariantAxis = VariantAxisConfig;

export type VariantRow = {
  id: string;
  skuRowId?: string;
  optionValues: Record<string, string>;
  /** @deprecated synced from optionValues.size */
  size?: string;
  /** @deprecated synced from optionValues.color */
  color?: string;
  /** Single canonical price for this variant (no separate MRP field). */
  price: string;
  stock: string;
  images: string[];
  isDefault: boolean;
  systemSku?: string;
  barcode?: string;
};

export type ProductFormState = {
  name: string;
  description: string;
  category_id: string;
  hsn_code: string;
  gst_rate: string;
  emoji: string;
  status: string;
  /** Single canonical price (replaces the old baseMrp / basePrice dual-field). */
  basePrice: string;
  brand: string;
  listingOwnership: '' | 'own_brand' | 'third_party';
  keyFeatures: string;
  weightKg: string;
  lengthCm: string;
  breadthCm: string;
  heightCm: string;
  petTypeInput: string;
  manufacturingDetails: string;
};

export type SimpleSkuDraft = {
  /** Single canonical price (replaces the old mrp / price dual-field). */
  price: string;
  stock: string;
  images: string[];
  barcode: string;
};

export type VendorProductPayload = {
  name: string;
  description: string;
  category_id: string;
  emoji: string;
  status: string;
  /** Single canonical price — the only price field vendors set. */
  price: number;
  stock?: number;
  hsn_code: string;
  gst_rate: number;
  vendor_id: string;
  images: string[];
  brand?: string;
  weight?: number | null;
  barcode?: string | null;
  specifications?: Record<string, unknown>;
  skus: Array<{
    id?: string;
    option_values: Record<string, string>;
    /** Per-SKU price (single canonical). */
    price: number;
    stock: number;
    images: string[];
    barcode?: string | null;
  }>;
  delivery_regions: string[] | null;
  listing_ownership?: 'own_brand' | 'third_party';
  metadata?: {
    variant_axes?: Array<{ key: string; label: string; preset?: VariantAxisPreset }>;
    product_group_id?: string;
  };
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GST_SLABS = [0, 5, 12, 18, 28] as const;

/** Map stored/API gst_rate to a select option value (handles 18.00, gstRate alias). */
export function gstRateForForm(product: Record<string, unknown> | null | undefined): string {
  if (!product) return '';
  const raw = product.gst_rate ?? product.gstRate;
  if (raw === undefined || raw === null || raw === '') return '';
  const n = parseFloat(String(raw).replace(/,/g, '').trim());
  if (!Number.isFinite(n)) return '';
  const exact = GST_SLABS.find((slab) => Math.abs(slab - n) < 0.001);
  if (exact !== undefined) return String(exact);
  const rounded = Math.round(n);
  if (GST_SLABS.includes(rounded as (typeof GST_SLABS)[number])) return String(rounded);
  return '';
}

function parseSpecificationsObject(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return { ...(raw as Record<string, unknown>) };
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

export function deliveryRegionsFromProduct(
  product: Record<string, unknown> | null | undefined,
): string[] {
  if (!product) return [];
  if (Array.isArray(product.delivery_regions)) {
    return normalizeDeliveryRegionsList(product.delivery_regions);
  }
  const meta = product.metadata as Record<string, unknown> | undefined;
  if (meta?.delivery_regions != null) {
    return normalizeDeliveryRegionsList(meta.delivery_regions);
  }
  return [];
}

export function customSpecRowsFromProduct(
  product: Record<string, unknown> | null | undefined,
): SpecKvRow[] {
  const specs = parseSpecificationsObject(product?.specifications);
  const rows: SpecKvRow[] = [];
  let idx = 0;
  for (const [key, value] of Object.entries(specs)) {
    const normKey = key.toLowerCase().replace(/\s+/g, '_');
    if (RESERVED_SPEC_KEYS.has(normKey)) continue;
    if (value == null || String(value).trim() === '') continue;
    rows.push({
      id: `spec-${idx++}`,
      key,
      value: String(value),
    });
  }
  return rows;
}

export function specificationsObjectFromForm(
  form: ProductFormState,
  customSpecs: SpecKvRow[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const row of customSpecs) {
    const k = row.key.trim();
    const v = row.value.trim();
    if (!k || !v) continue;
    const normKey = k.toLowerCase().replace(/\s+/g, '_');
    if (RESERVED_SPEC_KEYS.has(normKey)) continue;
    out[k] = v;
  }
  if (form.keyFeatures.trim()) out.key_features = form.keyFeatures.trim();
  const resolvedPet = resolveVendorPetTypeInput(form.petTypeInput);
  if (resolvedPet.pet_type) {
    out.pet_type = resolvedPet.pet_type;
    if (resolvedPet.pet_type === 'other' && resolvedPet.pet_type_other) {
      out.pet_type_other = resolvedPet.pet_type_other;
    }
  }
  if (form.manufacturingDetails.trim()) {
    out.manufacturing_details = form.manufacturingDetails.trim();
  }
  const length = parsePositiveDimension(form.lengthCm);
  const breadth = parsePositiveDimension(form.breadthCm);
  const height = parsePositiveDimension(form.heightCm);
  if (length != null) out.length_cm = length;
  if (breadth != null) out.breadth_cm = breadth;
  if (height != null) out.height_cm = height;
  return out;
}

function parseOptionalNum(raw: string): number | null {
  const t = String(raw ?? '').trim();
  if (!t) return null;
  const n = parseFloat(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Dimensions must be strictly positive — 0 means "not provided". */
function parsePositiveDimension(raw: string): number | null {
  const t = String(raw ?? '').trim();
  if (!t) return null;
  const n = parseFloat(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function appendListingOwnershipToPayload(
  payload: VendorProductPayload,
  form: ProductFormState,
): void {
  if (form.listingOwnership === 'own_brand' || form.listingOwnership === 'third_party') {
    payload.listing_ownership = form.listingOwnership;
  }
}

function appendProductExtrasToPayload(
  payload: VendorProductPayload,
  form: ProductFormState,
  customSpecs: SpecKvRow[],
  simpleBarcode?: string,
): void {
  if (form.brand.trim()) payload.brand = form.brand.trim();
  const weight = parseOptionalNum(form.weightKg);
  if (weight != null) payload.weight = weight;
  const specs = specificationsObjectFromForm(form, customSpecs);
  if (Object.keys(specs).length > 0) payload.specifications = specs;
  if (simpleBarcode?.trim()) payload.barcode = simpleBarcode.trim();
}

const PRESET_AXIS_LABELS: Record<string, { label: string; preset: VariantAxisPreset }> = {
  size: { label: 'Size', preset: 'size' },
  color: { label: 'Color', preset: 'color' },
  weight: { label: 'Weight', preset: 'weight' },
  pack: { label: 'Pack', preset: 'pack' },
};

export function slugifyVariantKey(label: string): string {
  const raw = String(label ?? '')
    .trim()
    .toLowerCase();
  if (!raw) return '';
  if (PRESET_AXIS_LABELS[raw]) return raw;
  const norm = raw.replace(/\s+/g, ' ');
  const compact = raw.replace(/\s+/g, '');
  if (norm === 'pack size' || compact === 'packsize') return 'pack';
  return raw
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

export function presetVariantAxes(preset: 'size' | 'color' | 'size_color' | 'pack' | 'weight'): VariantAxisConfig[] {
  if (preset === 'size') return [{ key: 'size', label: 'Size', preset: 'size' }];
  if (preset === 'color') return [{ key: 'color', label: 'Color', preset: 'color' }];
  if (preset === 'pack') return [{ key: 'pack', label: 'Pack', preset: 'pack' }];
  if (preset === 'weight') return [{ key: 'weight', label: 'Weight', preset: 'weight' }];
  return [
    { key: 'size', label: 'Size', preset: 'size' },
    { key: 'color', label: 'Color', preset: 'color' },
  ];
}

export function customVariantAxis(label: string): VariantAxisConfig | null {
  const trimmed = String(label ?? '').trim();
  if (!trimmed) return null;
  const key = slugifyVariantKey(trimmed);
  if (!key) return null;
  const presetEntry = PRESET_AXIS_LABELS[key];
  if (presetEntry) {
    return { key, label: presetEntry.label, preset: presetEntry.preset };
  }
  return { key, label: trimmed, preset: 'custom' };
}

/** Map shared category preset suggestion to vendor form axis config. */
export function variantAxesFromPresetSuggestion(
  suggestion: VariantPresetSuggestion,
): VariantAxisConfig[] {
  return suggestion.axes.map((axis) => {
    const presetEntry = PRESET_AXIS_LABELS[axis.key];
    if (presetEntry) {
      return { key: axis.key, label: axis.label || presetEntry.label, preset: presetEntry.preset };
    }
    return {
      key: axis.key,
      label: axis.label,
      preset: (axis.preset as VariantAxisPreset | undefined) ?? 'custom',
    };
  });
}

export function syncVariantRowLegacyFields(row: VariantRow): VariantRow {
  return {
    ...row,
    size: row.optionValues.size ?? row.size ?? '',
    color: row.optionValues.color ?? row.color ?? '',
  };
}

export function variantRowOptionValues(row: VariantRow, axes: VariantAxisConfig[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const axis of axes) {
    const val =
      row.optionValues[axis.key]?.trim() ||
      (axis.key === 'size' ? row.size?.trim() : undefined) ||
      (axis.key === 'color' ? row.color?.trim() : undefined) ||
      '';
    if (val) out[axis.key] = val;
  }
  return out;
}

function optionValuesKey(ov: Record<string, string>): string {
  return JSON.stringify(
    Object.keys(ov)
      .sort()
      .map((k) => [k, ov[k]]),
  );
}

export function isSkuUuid(value: string | undefined): boolean {
  return Boolean(value && UUID_RE.test(value));
}

export function skuImageUrlsFromApi(raw: unknown): string[] {
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
      if (Array.isArray(parsed)) return skuImageUrlsFromApi(parsed);
    } catch {
      return [raw.trim()];
    }
  }
  return [];
}

export function sellingPriceForForm(product: {
  price?: number;
  original_price?: number;
  compare_at_price?: number;
} | null | undefined): string {
  if (product?.price == null) return '';
  const priceNum = Number(product.price);
  if (!Number.isFinite(priceNum) || priceNum <= 0) return '';
  return String(priceNum);
}

function inferAxesFromOptionKeys(keys: string[]): VariantAxisConfig[] {
  const unique = [...new Set(keys.filter(Boolean))].sort();
  return unique.slice(0, MAX_VARIANT_ATTRIBUTES).map((key) => {
    const preset = PRESET_AXIS_LABELS[key];
    if (preset) {
      return { key, label: preset.label, preset: preset.preset };
    }
    return {
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
      preset: 'custom' as const,
    };
  });
}

export function inferVariantAxesFromProduct(
  product: Record<string, unknown> | null | undefined,
  variants: VariantRow[],
): VariantAxisConfig[] {
  const meta = product?.metadata as Record<string, unknown> | undefined;
  const saved = meta?.variant_axes;
  if (Array.isArray(saved) && saved.length > 0) {
    return saved
      .map((a) => {
        const row = a as Record<string, unknown>;
        const key = String(row.key ?? '').trim();
        const label = String(row.label ?? key).trim();
        if (!key) return null;
        return {
          key,
          label: label || key,
          preset: row.preset as VariantAxisPreset | undefined,
        };
      })
      .filter(Boolean) as VariantAxisConfig[];
  }
  return inferVariantAxes(variants);
}

export function inferVariantAxes(variants: VariantRow[]): VariantAxisConfig[] {
  const keys = new Set<string>();
  for (const v of variants) {
    for (const [k, val] of Object.entries(v.optionValues ?? {})) {
      if (String(val ?? '').trim()) keys.add(k);
    }
    if (v.size?.trim()) keys.add('size');
    if (v.color?.trim()) keys.add('color');
  }
  if (keys.size === 0) {
    return presetVariantAxes('size_color');
  }
  return inferAxesFromOptionKeys([...keys]);
}

export function variantsFromProduct(
  product: Record<string, unknown> | null | undefined,
): VariantRow[] {
  if (!product) return [];

  const mapSkuRow = (
    s: Record<string, unknown>,
    idx: number,
  ): VariantRow => {
    const ov = (s.option_values as Record<string, string>) || {};
    const optionValues: Record<string, string> = {};
    for (const [k, val] of Object.entries(ov)) {
      if (val == null || !String(val).trim()) continue;
      const key = k === 'colour' ? 'color' : k;
      optionValues[key] = String(val).trim();
    }
    const rawSkuId = s.id != null ? String(s.id) : '';
    // Single-price model: prefer `price`; fall back to compare_at_price for legacy rows.
    const rowPrice = String(s.price ?? s.compare_at_price ?? '');
    return {
      id: isSkuUuid(rawSkuId) ? rawSkuId : `sku-${idx}`,
      skuRowId: isSkuUuid(rawSkuId) ? rawSkuId : undefined,
      optionValues,
      size: optionValues.size ?? '',
      color: optionValues.color ?? '',
      price: rowPrice,
      stock: String(s.stock ?? ''),
      images: skuImageUrlsFromApi(s.images),
      isDefault: false,
      systemSku: s.sku ? String(s.sku) : undefined,
      barcode: s.barcode ? String(s.barcode) : '',
    };
  };

  const skus = product.skus as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(skus) && skus.length > 0) {
    const sorted = [...skus].sort((a, b) => {
      const ao = Number(a.sort_order);
      const bo = Number(b.sort_order);
      return (Number.isFinite(ao) ? ao : 0) - (Number.isFinite(bo) ? bo : 0);
    });
    return sorted.map((s, idx) => ({
      ...mapSkuRow(s, idx),
      isDefault: false,
    }));
  }

  const meta = product.metadata as Record<string, unknown> | undefined;
  const legacy = (meta?.variants ?? product.variants) as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(legacy) && legacy.length > 0) {
    return legacy.map((v, idx) => {
      const size = String(v.size ?? '').trim();
      const color = String(v.color ?? '').trim();
      const optionValues: Record<string, string> = {};
      if (size) optionValues.size = size;
      if (color) optionValues.color = color;
      return {
        id: `legacy-${idx}`,
        skuRowId: undefined,
        optionValues,
        size,
        color,
        price: '',
        stock: String(v.stock ?? ''),
        images: skuImageUrlsFromApi(v.images),
        isDefault: idx === 0,
        systemSku: v.sku ? String(v.sku) : undefined,
      };
    });
  }
  return [];
}

export function initialProductFormState(
  product: Record<string, unknown> | null | undefined,
): ProductFormState {
  const specs = parseSpecificationsObject(product?.specifications);
  return {
    name: String(product?.name ?? ''),
    description: String(product?.description ?? ''),
    category_id: String(product?.category_id ?? '').trim(),
    hsn_code: String(product?.hsn_code ?? product?.hsnCode ?? ''),
    gst_rate: gstRateForForm(product),
    emoji: String(product?.emoji ?? '📦'),
    status: String(product?.status ?? 'pending'),
    basePrice: sellingPriceForForm(
      product as { price?: number; original_price?: number; compare_at_price?: number },
    ),
    brand: String(product?.brand ?? ''),
    listingOwnership:
      product?.listing_ownership === 'own_brand' || product?.listing_ownership === 'third_party'
        ? product.listing_ownership
        : '',
    keyFeatures: String(specs.key_features ?? product?.key_features ?? ''),
    weightKg:
      product?.weight != null && product.weight !== '' && Number(product.weight) > 0
        ? String(product.weight)
        : '',
    lengthCm:
      specs.length_cm != null && Number(specs.length_cm) > 0 ? String(specs.length_cm) : '',
    breadthCm:
      specs.breadth_cm != null && Number(specs.breadth_cm) > 0 ? String(specs.breadth_cm) : '',
    heightCm:
      specs.height_cm != null && Number(specs.height_cm) > 0 ? String(specs.height_cm) : '',
    petTypeInput: formatPetTypeForVendor(
      specs.pet_type ?? product?.pet_type,
      specs.pet_type_other ?? product?.pet_type_other,
    ),
    manufacturingDetails: String(
      specs.manufacturing_details ?? product?.manufacturing_details ?? '',
    ),
  };
}

export function initialSimpleSkuFromProduct(
  product: Record<string, unknown> | null | undefined,
): SimpleSkuDraft {
  return {
    price: sellingPriceForForm(
      product as { price?: number; original_price?: number; compare_at_price?: number },
    ),
    stock: String(product?.stock ?? ''),
    images: skuImageUrlsFromApi(product?.images),
    barcode: product?.barcode ? String(product.barcode) : '',
  };
}

function isPhantomSingleSkuRow(sku: unknown): boolean {
  const row = sku as Record<string, unknown>;
  const ov = row?.option_values;
  if (ov == null || typeof ov !== 'object' || Array.isArray(ov)) return true;
  const keys = Object.keys(ov as Record<string, unknown>).filter((k) =>
    String((ov as Record<string, unknown>)[k] ?? '').trim(),
  );
  return keys.length === 0;
}

export function detectProductMode(product: Record<string, unknown> | null | undefined): ProductMode {
  const meta = product?.metadata as Record<string, unknown> | undefined;
  const legacy = meta?.variants ?? product?.variants;
  if (Array.isArray(legacy) && legacy.length > 0) return 'multi';

  const skus = product?.skus;
  if (Array.isArray(skus) && skus.length > 0) {
    if (skus.length === 1 && isPhantomSingleSkuRow(skus[0])) return 'simple';
    return 'multi';
  }
  return 'simple';
}

/**
 * @deprecated — kept only for computeListingPreviewFromVariants backward compatibility.
 * In the single-price model, there is no separate MRP. Returns the variant price.
 */
export function effectiveVariantMrp(row: VariantRow): number {
  return effectiveVariantPrice(row);
}

export function effectiveVariantPrice(row: VariantRow): number {
  const parsed = parseFloat(String(row.price ?? '').trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function pickListingVariantRow(
  variants: VariantRow[],
  variantAxes: VariantAxisConfig[],
): VariantRow | null {
  if (variants.length === 0) return null;
  const scored = variants.map((v) => ({
    row: v,
    stock: parseInt(String(v.stock), 10) || 0,
    price: effectiveVariantPrice(v),
  }));
  const inStock = scored.filter((s) => s.stock > 0);
  const candidates = inStock.length > 0 ? inStock : scored;
  let best = candidates[0];
  for (const c of candidates) {
    if (c.price > 0 && c.price <= best.price) best = c;
  }
  return best?.row ?? variants[0];
}

export function computeListingPreviewFromVariants(
  variants: VariantRow[],
  variantAxes: VariantAxisConfig[],
): { price: number; mrp: number; totalStock: number } {
  const listing = pickListingVariantRow(variants, variantAxes);
  const totalStock = variants.reduce(
    (sum, v) => sum + (parseInt(String(v.stock), 10) || 0),
    0,
  );
  if (!listing) return { price: 0, mrp: 0, totalStock };
  return {
    price: effectiveVariantPrice(listing),
    mrp: effectiveVariantMrp(listing),
    totalStock,
  };
}

export function productGroupIdFromProduct(
  product: Record<string, unknown> | null | undefined,
): string {
  if (!product) return '';
  const meta = product.metadata as Record<string, unknown> | undefined;
  const fromMeta = meta?.product_group_id;
  if (fromMeta != null && String(fromMeta).trim()) return String(fromMeta).trim();
  return '';
}

export type ValidateProductFormInput = {
  form: ProductFormState;
  mode: ProductMode;
  variants: VariantRow[];
  simpleSku: SimpleSkuDraft;
  variantAxes: VariantAxisConfig[];
  deliveryRegions?: string[];
  customSpecs?: SpecKvRow[];
};

export function validateProductForm(input: ValidateProductFormInput): string | null {
  const { form, mode, variants, simpleSku, variantAxes } = input;

  if (!form.name?.trim()) return 'Product name is required';
  if (!form.category_id) return 'Category is required';

  if (!form.listingOwnership) {
    return 'Listing ownership is required — select Own brand or Third party';
  }

  for (const field of [
    { label: 'Weight', val: form.weightKg },
    { label: 'Length', val: form.lengthCm },
    { label: 'Breadth', val: form.breadthCm },
    { label: 'Height', val: form.heightCm },
  ]) {
    const t = String(field.val ?? '').trim();
    if (t) {
      const n = parseFloat(t);
      if (!Number.isFinite(n) || n < 0) return `${field.label} must be a number ≥ 0`;
    }
  }

  const hsn = String(form.hsn_code ?? '').trim();
  if (!/^\d{4,8}$/.test(hsn)) return 'HSN is required (4–8 digits)';

  const gstNum = parseFloat(form.gst_rate);
  if (!GST_SLABS.includes(gstNum as (typeof GST_SLABS)[number])) {
    return 'Tax (GST %) is required — choose 0, 5, 12, 18, or 28';
  }

  const basePrice = parseFloat(String(form.basePrice ?? '').trim());

  if (mode !== 'simple') {
    if (variants.length === 0) return 'Add at least one variant or switch to single product mode';

    if (variantAxes.length > MAX_VARIANT_ATTRIBUTES) {
      return `Maximum ${MAX_VARIANT_ATTRIBUTES} variant attributes per product`;
    }
    if (variants.length > MAX_SKUS_PER_PRODUCT) {
      return `Maximum ${MAX_SKUS_PER_PRODUCT} variant rows (SKUs) per product`;
    }

    const seen = new Set<string>();
    for (const v of variants) {
      for (const axis of variantAxes) {
        const val = variantRowOptionValues(v, variantAxes)[axis.key]?.trim();
        if (!val) {
          return `Each variant needs a ${axis.label} value`;
        }
      }
      const key = optionValuesKey(variantRowOptionValues(v, variantAxes));
      if (seen.has(key)) return 'Duplicate variant — option combination must be unique';
      seen.add(key);

      const stockNum = parseInt(String(v.stock), 10);
      if (!Number.isInteger(stockNum) || stockNum < 0) {
        return 'Each variant stock must be a whole number ≥ 0';
      }
      if (v.images.length === 0) return 'Each variant needs at least one image';

      const vPrice = effectiveVariantPrice(v);
      if (vPrice <= 0) return 'Each variant needs a price greater than 0';
    }
    return null;
  }

  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    return 'Price is required and must be greater than 0';
  }

  const stockNum = parseInt(String(simpleSku.stock), 10);
  if (!Number.isInteger(stockNum) || stockNum < 0) {
    return 'Stock quantity must be a whole number ≥ 0';
  }
  if (simpleSku.images.length === 0) return 'At least one product image is required';
  return null;
}

export function buildVendorProductPayload(
  input: ValidateProductFormInput & {
    sellerId: string;
    stripImageUrl: (url: string) => string;
    productGroupId?: string;
  },
): VendorProductPayload {
  const { form, mode, variants, simpleSku, sellerId, stripImageUrl, variantAxes } = input;
  const customSpecs = input.customSpecs ?? [];

  const basePriceNum = parseFloat(String(form.basePrice ?? '').trim()) || 0;

  if (mode === 'simple') {
    const payload: VendorProductPayload = {
      name: form.name.trim(),
      description: form.description,
      category_id: form.category_id,
      emoji: form.emoji,
      status: form.status,
      price: basePriceNum,
      stock: parseInt(String(simpleSku.stock), 10) || 0,
      hsn_code: String(form.hsn_code).trim(),
      gst_rate: parseFloat(form.gst_rate),
      vendor_id: sellerId,
      images: simpleSku.images.map(stripImageUrl),
      skus: [],
      delivery_regions:
        input.deliveryRegions && input.deliveryRegions.length > 0
          ? input.deliveryRegions
          : null,
    };
    appendProductExtrasToPayload(payload, form, customSpecs, simpleSku.barcode);
    appendListingOwnershipToPayload(payload, form);
    return payload;
  }

  const listingPreview = computeListingPreviewFromVariants(variants, variantAxes);
  const listingVariant = pickListingVariantRow(variants, variantAxes);
  const listingImages = listingVariant?.images.map(stripImageUrl) ?? [];
  const productGroupId = input.productGroupId?.trim() || undefined;

  const payload: VendorProductPayload = {
    name: form.name.trim(),
    description: form.description,
    category_id: form.category_id,
    emoji: form.emoji,
    status: form.status,
    price: listingPreview.price,
    stock: listingPreview.totalStock,
    hsn_code: String(form.hsn_code).trim(),
    gst_rate: parseFloat(form.gst_rate),
    vendor_id: sellerId,
    images: listingImages,
    skus: variants.map((v) => {
      return {
        ...(isSkuUuid(v.skuRowId) ? { id: v.skuRowId } : {}),
        option_values: variantRowOptionValues(v, variantAxes),
        price: effectiveVariantPrice(v),
        stock: parseInt(String(v.stock), 10) || 0,
        images: v.images.map(stripImageUrl),
        ...(v.barcode?.trim() ? { barcode: v.barcode.trim() } : {}),
      };
    }),
    metadata: {
      variant_axes: variantAxes.map(({ key, label, preset }) => ({ key, label, preset })),
      ...(productGroupId ? { product_group_id: productGroupId } : {}),
    },
    delivery_regions:
      input.deliveryRegions && input.deliveryRegions.length > 0
        ? input.deliveryRegions
        : null,
  };
  appendProductExtrasToPayload(payload, form, customSpecs);
  appendListingOwnershipToPayload(payload, form);
  return payload;
}

export function createEmptyVariant(variantAxes: VariantAxisConfig[]): VariantRow {
  const optionValues: Record<string, string> = {};
  for (const axis of variantAxes) {
    optionValues[axis.key] = '';
  }
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    optionValues,
    price: '',
    stock: '',
    images: [],
    isDefault: false,
    barcode: '',
  };
}

export function updateVariantOptionValue(
  variants: VariantRow[],
  variantId: string,
  axisKey: string,
  value: string,
): VariantRow[] {
  return variants.map((v) => {
    if (v.id !== variantId) return v;
    const optionValues = { ...v.optionValues, [axisKey]: value };
    return syncVariantRowLegacyFields({ ...v, optionValues });
  });
}

export function migrateSimpleSkuToFirstVariant(
  simpleSku: SimpleSkuDraft,
  variantAxes: VariantAxisConfig[],
): VariantRow {
  const optionValues: Record<string, string> = {};
  for (const axis of variantAxes) {
    optionValues[axis.key] = '';
  }
  return {
    id: `${Date.now()}-migrated`,
    optionValues,
    price: simpleSku.price,
    stock: simpleSku.stock,
    images: [...simpleSku.images],
    isDefault: true,
  };
}
