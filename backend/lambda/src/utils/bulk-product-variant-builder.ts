/**
 * Bulk upload variant grouping — one row = one SKU.
 * Warmpawz Product ID or upload-scoped Product Group ID groups rows in memory only.
 */

import { MAX_VARIANT_ATTRIBUTES, MAX_SKUS_PER_PRODUCT } from '@warmpawz/shared-types';
import { normalizeOptionValues } from './product-sku-resolve';
import type { SkuInput } from './product-sku-service';
import { parseProductImageList } from './product-ecommerce-validation';
import { resolveBulkUploadGroupKey } from './product-group-identity';

export type BulkVariantRow = Record<string, unknown> & {
  name: string;
  category?: string | null;
  warmpawz_product_id?: string | null;
  product_group_id?: string | null;
  price: number;
  compare_at_price?: number | null;
  stock_quantity: number;
  hsn_code?: string | null;
  gst_rate?: number | null;
  images?: string | null;
  rowNum?: number;
  size_variant?: string | null;
  colour?: string | null;
  variant_attr_1?: string | null;
  variant_value_1?: string | null;
  variant_attr_2?: string | null;
  variant_value_2?: string | null;
  variant_attr_3?: string | null;
  variant_value_3?: string | null;
  barcode?: string | null;
  brand?: string | null;
  listing_ownership?: string | null;
};

export type BulkProductGroup = {
  groupKey: string;
  warmpawz_product_id?: string;
  product_group_id?: string;
  name: string;
  category: string;
  parent: {
    description?: string | null;
    price: number;
    compare_at_price?: number | null;
    hsn_code?: string | null;
    gst_rate?: number | null;
    weight?: number | null;
    dimensions?: string | null;
    material?: string | null;
    brand?: string | null;
    tags?: string | null;
    barcode?: string | null;
    key_features?: string | null;
    length_cm?: string | number | null;
    breadth_cm?: string | number | null;
    height_cm?: string | number | null;
    pet_type?: string | null;
    pet_type_other?: string | null;
    manufacturing_details?: string | null;
    delivery_regions?: unknown;
    product_specifications?: string | null;
    listing_ownership?: string | null;
  };
  variants: BulkVariantRow[];
  rowNums: number[];
};

const PRESET_ATTR_KEYS: Record<string, string> = {
  size: 'size',
  color: 'color',
  colour: 'color',
  weight: 'weight',
  pack: 'pack',
  'pack size': 'pack',
  packsize: 'pack',
};

export function slugifyVariantKey(label: string): string {
  const raw = String(label ?? '')
    .trim()
    .toLowerCase()
    .replace(/\u00a0/g, ' ');
  if (!raw) return '';
  const preset = PRESET_ATTR_KEYS[raw.replace(/\s+/g, ' ')] ?? PRESET_ATTR_KEYS[raw.replace(/\s+/g, '')];
  if (preset) return preset;
  return raw
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

/** @deprecated Use resolveBulkGroupKey — title+category only grouping removed. */
export function normalizeProductGroupKey(title: string, categoryName: string): string {
  return `${String(title ?? '').trim().toLowerCase()}::${String(categoryName ?? '').trim().toLowerCase()}`;
}

function attrKeyFromLabel(label: string): string {
  const trimmed = String(label ?? '').trim();
  if (!trimmed) return '';
  const norm = trimmed.toLowerCase().replace(/\s+/g, ' ');
  return PRESET_ATTR_KEYS[norm] ?? PRESET_ATTR_KEYS[norm.replace(/\s+/g, '')] ?? slugifyVariantKey(trimmed);
}

/** Parse option_values from a bulk row (legacy size/colour + variant attr columns). */
export function parseBulkRowOptionValues(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, unknown> = {};

  const sizeVariant = row.size_variant ?? row.size;
  const colour = row.colour ?? row.color;
  if (sizeVariant != null && String(sizeVariant).trim()) {
    out.size = String(sizeVariant).trim();
  }
  if (colour != null && String(colour).trim()) {
    out.color = String(colour).trim();
  }

  const pairs: Array<[unknown, unknown]> = [
    [row.variant_attr_1, row.variant_value_1],
    [row.variant_attr_2, row.variant_value_2],
    [row.variant_attr_3, row.variant_value_3],
  ];
  for (const [attrRaw, valRaw] of pairs) {
    const attrLabel = String(attrRaw ?? '').trim();
    const val = String(valRaw ?? '').trim();
    if (!attrLabel || !val) continue;
    const key = attrKeyFromLabel(attrLabel);
    if (key) out[key] = val;
  }

  return normalizeOptionValues(out);
}

export function rowHasVariantAxes(row: Record<string, unknown>): boolean {
  return Object.keys(parseBulkRowOptionValues(row)).length > 0;
}

function trimStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function dimVal(v: unknown): string | number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).trim();
  return s || null;
}

/** Product-level fields from first bulk row for persist / vendorExtrasFromBulkRow. */
function parentFieldsFromBulkRow(row: BulkVariantRow): BulkProductGroup['parent'] {
  return {
    description: trimStr(row.description),
    price: Number(row.price) || rowSpFromBulkRow(row) || 0,
    hsn_code: trimStr(row.hsn_code),
    gst_rate: row.gst_rate != null ? Number(row.gst_rate) : null,
    weight: row.weight != null ? Number(row.weight) : null,
    dimensions: trimStr(row.dimensions),
    material: trimStr(row.material),
    brand: trimStr(row.brand),
    tags: trimStr(row.tags),
    barcode: trimStr(row.barcode),
    key_features: trimStr(row.key_features),
    length_cm: dimVal(row.length_cm),
    breadth_cm: dimVal(row.breadth_cm),
    height_cm: dimVal(row.height_cm),
    pet_type: trimStr(row.pet_type),
    pet_type_other: trimStr(row.pet_type_other),
    manufacturing_details: trimStr(row.manufacturing_details),
    delivery_regions: row.delivery_regions ?? null,
    product_specifications: trimStr(row.product_specifications),
    listing_ownership: trimStr(row.listing_ownership),
  };
}

/** Merged row for vendorExtrasFromBulkRow — parent + first variant (full validated row). */
export function bulkGroupExtrasSource(group: BulkProductGroup): Record<string, unknown> {
  const first = group.variants[0];
  return {
    ...group.parent,
    ...(first ?? {}),
  } as Record<string, unknown>;
}

export function groupBulkRows(rows: BulkVariantRow[]): BulkProductGroup[] {
  const map = new Map<string, BulkProductGroup>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = String(row.name ?? '').trim();
    const category = String(row.category ?? '').trim();
    if (!name || !category) continue;

    const rowNum = row.rowNum != null ? Number(row.rowNum) : i + 1;
    const groupKey = resolveBulkUploadGroupKey({ ...row, rowNum });
    const wpid = String(row.warmpawz_product_id ?? '').trim();
    const pgid = String(row.product_group_id ?? '').trim();

    let group = map.get(groupKey);
    if (!group) {
      group = {
        groupKey,
        warmpawz_product_id: wpid || undefined,
        product_group_id: pgid || undefined,
        name,
        category,
        parent: parentFieldsFromBulkRow(row),
        variants: [],
        rowNums: [],
      };
      map.set(groupKey, group);
    } else {
      if (wpid && !group.warmpawz_product_id) group.warmpawz_product_id = wpid;
      if (pgid && !group.product_group_id) group.product_group_id = pgid;
    }

    group.variants.push({ ...row, rowNum });
    group.rowNums.push(rowNum);
  }

  return [...map.values()];
}

function optionValuesKey(ov: Record<string, string>): string {
  return JSON.stringify(
    Object.keys(ov)
      .sort()
      .map((k) => [k, ov[k]]),
  );
}

function rowMrpFromBulkRow(row: BulkVariantRow): number {
  const mrp = Number(row.compare_at_price);
  return Number.isFinite(mrp) && mrp > 0 ? mrp : 0;
}

function rowSpFromBulkRow(row: BulkVariantRow): number {
  const spRaw = row.price;
  const mrp = rowMrpFromBulkRow(row);
  if (spRaw != null && String(spRaw).trim() !== '') {
    const sp = Number(spRaw);
    if (Number.isFinite(sp) && sp > 0) return sp;
  }
  return mrp;
}

export function buildSkuInputsFromGroup(group: BulkProductGroup): SkuInput[] {
  if (group.variants.length === 0) return [];

  const withOv = group.variants.map((row) => ({
    row,
    option_values: parseBulkRowOptionValues(row),
  }));

  withOv.sort((a, b) => (a.row.rowNum ?? 0) - (b.row.rowNum ?? 0));

  return withOv.map((entry, idx) => {
    const { row, option_values } = entry;
    const images = parseProductImageList(row.images ?? row.image_urls);
    const stock = Math.max(0, Math.floor(Number(row.stock_quantity) || 0));
    const selling = rowSpFromBulkRow(row);

    return {
      option_values,
      price: selling,
      compare_at_price: null,
      stock,
      images,
      barcode: row.barcode ? String(row.barcode).trim() : null,
      sort_order: idx,
      sku: null,
      is_active: true,
    };
  });
}

export type VariantGroupValidationError = {
  row?: number;
  field: string;
  message: string;
};

function parentFieldsMustMatch(
  group: BulkProductGroup,
  field: keyof BulkProductGroup['parent'],
  label: string,
  errors: VariantGroupValidationError[],
): void {
  const ref = group.parent[field];
  const refStr = ref == null ? '' : String(ref).trim();
  for (const row of group.variants) {
    const rowVal = (row as Record<string, unknown>)[field];
    const rowStr = rowVal == null ? '' : String(rowVal).trim();
    if (rowStr && refStr && rowStr !== refStr) {
      errors.push({
        field,
        message: `${label} must match across all rows in the product group`,
        row: row.rowNum,
      });
    }
  }
}

export function validateVariantGroup(group: BulkProductGroup): VariantGroupValidationError[] {
  const errors: VariantGroupValidationError[] = [];
  const push = (field: string, message: string, row?: number) =>
    errors.push({ field, message, row });

  if (group.variants.length === 0) {
    push('variants', 'Product group has no variant rows');
    return errors;
  }

  const axisKeysPerRow = group.variants.map((row) => {
    const ov = parseBulkRowOptionValues(row);
    return { row, ov, keys: Object.keys(ov) };
  });

  const hasVariantAxes = axisKeysPerRow.some((r) => r.keys.length > 0);
  const isMultiRow = group.variants.length > 1;
  const wpid =
    group.warmpawz_product_id ?? String(group.variants[0]?.warmpawz_product_id ?? '').trim();
  const pgid = group.product_group_id ?? String(group.variants[0]?.product_group_id ?? '').trim();

  const wpids = new Set(
    group.variants
      .map((r) => String(r.warmpawz_product_id ?? '').trim())
      .filter(Boolean),
  );
  if (wpids.size > 1) {
    push(
      'warmpawz_product_id',
      'Warmpawz Product ID must match across all rows in the product group',
      group.rowNums[0],
    );
  }

  if (!group.parent.brand?.trim()) {
    push('brand', 'Brand is required', group.rowNums[0]);
  }

  if (hasVariantAxes || isMultiRow) {
    if (!pgid && !wpid) {
      push(
        'product_group_id',
        'Product Group ID is required for multi-row or variant products (unless Warmpawz Product ID is provided for updates)',
        group.rowNums[0],
      );
    }
  }

  parentFieldsMustMatch(group, 'hsn_code', 'HSN', errors);
  parentFieldsMustMatch(group, 'gst_rate', 'Tax (GST)', errors);

  const isSimple = axisKeysPerRow.every((r) => r.keys.length === 0);
  if (isSimple) {
    if (group.variants.length > 1) {
      push(
        'variants',
        'Multiple rows with the same identity but no variant attributes — add variant columns or unique Product Group IDs',
      );
    }
    const row = group.variants[0];
    const sp = rowSpFromBulkRow(row);
    if (sp <= 0) push('price', 'Price must be greater than 0', row.rowNum);
    return errors;
  }

  const referenceKeys = [...axisKeysPerRow.find((r) => r.keys.length > 0)?.keys ?? []].sort();
  if (referenceKeys.length > MAX_VARIANT_ATTRIBUTES) {
    push(
      'variants',
      `Maximum ${MAX_VARIANT_ATTRIBUTES} variant attributes per product`,
    );
  }

  if (group.variants.length > MAX_SKUS_PER_PRODUCT) {
    push(
      'variants',
      `Maximum ${MAX_SKUS_PER_PRODUCT} variant rows (SKUs) per product group`,
    );
  }

  const seen = new Set<string>();
  for (const { row, ov, keys } of axisKeysPerRow) {
    const rowNum = row.rowNum;
    if (keys.length === 0) {
      push('option_values', 'Variant row must specify at least one variant attribute value', rowNum);
      continue;
    }
    const sortedRef = [...referenceKeys].sort();
    const sortedKeys = [...keys].sort();
    if (sortedRef.length > 0 && sortedKeys.join(',') !== sortedRef.join(',')) {
      push(
        'option_values',
        `Variant attributes must match across rows (expected: ${sortedRef.join(', ')})`,
        rowNum,
      );
    }
    const dupKey = optionValuesKey(ov);
    if (seen.has(dupKey)) {
      push('option_values', 'Duplicate variant combination in product group', rowNum);
    }
    seen.add(dupKey);

    const stock = Number(row.stock_quantity);
    if (!Number.isInteger(stock) || stock < 0) {
      push('stock_quantity', 'Quantity must be a whole number ≥ 0', rowNum);
    }

    const images = parseProductImageList(row.images ?? row.image_urls);
    if (images.length === 0) {
      push('images', 'Each variant row needs at least one image URL', rowNum);
    }

    const sp = rowSpFromBulkRow(row);
    if (sp <= 0) {
      push('price', 'Price must be greater than 0', rowNum);
    }
  }

  return errors;
}

export function aggregateGroupStock(group: BulkProductGroup): number {
  return group.variants.reduce(
    (sum, row) => sum + Math.max(0, Math.floor(Number(row.stock_quantity) || 0)),
    0,
  );
}

/** Listing row images for parent provisional payload (before sync). */
export function pickGroupParentImages(group: BulkProductGroup): string[] {
  const listingRow = pickListingRowFromGroup(group);
  if (!listingRow) return [];
  return parseProductImageList(listingRow.images ?? listingRow.image_urls);
}

function pickListingRowFromGroup(group: BulkProductGroup): BulkVariantRow | null {
  const withStock = group.variants.filter((r) => (Number(r.stock_quantity) || 0) > 0);
  const candidates = withStock.length > 0 ? withStock : group.variants;
  let best: BulkVariantRow | null = null;
  let bestPrice = Infinity;
  for (const row of candidates) {
    const sp = rowSpFromBulkRow(row);
    if (sp > 0 && sp <= bestPrice) {
      bestPrice = sp;
      best = row;
    }
  }
  return best ?? group.variants[0] ?? null;
}

export function listingPriceFromGroup(group: BulkProductGroup): {
  price: number;
  compare_at_price: number | null;
} {
  const row = pickListingRowFromGroup(group);
  if (!row) return { price: 0, compare_at_price: null };
  const mrp = rowMrpFromBulkRow(row);
  const sp = rowSpFromBulkRow(row);
  return { price: sp, compare_at_price: null };
}
