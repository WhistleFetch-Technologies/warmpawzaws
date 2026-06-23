/**
 * Bulk upload variant grouping — mirrors Seller Hub multi-variant rules.
 * One spreadsheet row = one SKU; rows with same title+category = one product.
 */

import { normalizeOptionValues } from './product-sku-resolve';
import type { SkuInput } from './product-sku-service';
import { parseProductImageList } from './product-ecommerce-validation';

export type BulkVariantRow = Record<string, unknown> & {
  name: string;
  category?: string | null;
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
  is_default?: boolean | string | null;
  variant_sp?: number | string | null;
  variant_mrp?: number | string | null;
  barcode?: string | null;
};

export type BulkProductGroup = {
  groupKey: string;
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

export function normalizeProductGroupKey(title: string, categoryName: string): string {
  return `${String(title ?? '').trim().toLowerCase()}::${String(categoryName ?? '').trim().toLowerCase()}`;
}

function parseBoolDefault(raw: unknown): boolean {
  if (raw === true || raw === 1) return true;
  const s = String(raw ?? '').trim().toLowerCase();
  return s === 'yes' || s === 'y' || s === 'true' || s === '1' || s === 'default';
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

/** Product-level fields from first bulk row for persist / vendorExtrasFromBulkRow. */
function parentFieldsFromBulkRow(row: BulkVariantRow): BulkProductGroup['parent'] {
  const trimStr = (v: unknown): string | null => {
    if (v == null) return null;
    const s = String(v).trim();
    return s || null;
  };
  const dimVal = (v: unknown): string | number | null => {
    if (v == null || v === '') return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const s = String(v).trim();
    return s || null;
  };
  return {
    description: trimStr(row.description),
    price: Number(row.price) || 0,
    compare_at_price: row.compare_at_price != null ? Number(row.compare_at_price) : null,
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

    const groupKey = normalizeProductGroupKey(name, category);
    const rowNum = row.rowNum != null ? Number(row.rowNum) : i + 1;

    let group = map.get(groupKey);
    if (!group) {
      group = {
        groupKey,
        name,
        category,
        parent: parentFieldsFromBulkRow(row),
        variants: [],
        rowNums: [],
      };
      map.set(groupKey, group);
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

export function buildSkuInputsFromGroup(
  group: BulkProductGroup,
  parentDefaults: { price: number; compare_at_price?: number | null },
): SkuInput[] {
  if (group.variants.length === 0) return [];

  const withOv = group.variants.map((row) => ({
    row,
    option_values: parseBulkRowOptionValues(row),
    isDefault: parseBoolDefault(row.is_default),
  }));

  const hasAnyDefault = withOv.some((v) => v.isDefault);
  withOv.sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;
    return (a.row.rowNum ?? 0) - (b.row.rowNum ?? 0);
  });
  if (!hasAnyDefault && withOv.length > 0) {
    withOv[0].isDefault = true;
  }

  return withOv.map((entry, idx) => {
    const { row, option_values } = entry;
    const images = parseProductImageList(row.images ?? row.image_urls);
    const stock = Math.max(0, Math.floor(Number(row.stock_quantity) || 0));

    const variantSpRaw = row.variant_sp;
    const variantMrpRaw = row.variant_mrp;
    const hasSpOverride =
      variantSpRaw !== undefined &&
      variantSpRaw !== null &&
      String(variantSpRaw).trim() !== '';
    const hasMrpOverride =
      variantMrpRaw !== undefined &&
      variantMrpRaw !== null &&
      String(variantMrpRaw).trim() !== '';

    const spOverride = hasSpOverride ? Number(variantSpRaw) : NaN;
    const mrpOverride = hasMrpOverride ? Number(variantMrpRaw) : NaN;

    return {
      option_values,
      price: hasSpOverride && Number.isFinite(spOverride) && spOverride > 0 ? spOverride : undefined,
      compare_at_price:
        hasMrpOverride && Number.isFinite(mrpOverride) && mrpOverride > 0 ? mrpOverride : null,
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

  const isSimple = axisKeysPerRow.every((r) => r.keys.length === 0);
  if (isSimple) {
    if (group.variants.length > 1) {
      push(
        'variants',
        'Multiple rows with the same title but no variant attributes — use variant columns or unique titles',
      );
    }
    return errors;
  }

  const referenceKeys = [...axisKeysPerRow.find((r) => r.keys.length > 0)?.keys ?? []].sort();
  if (referenceKeys.length > 2) {
    push('variants', 'Maximum 2 variant attributes per product');
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

    const baseMrp = Number(group.parent.compare_at_price ?? group.parent.price) || 0;
    const baseSp = Number(group.parent.price) || baseMrp;
    const vSpRaw = row.variant_sp;
    const vMrpRaw = row.variant_mrp;
    const vSp =
      vSpRaw != null && String(vSpRaw).trim()
        ? Number(vSpRaw)
        : baseSp;
    const vMrp =
      vMrpRaw != null && String(vMrpRaw).trim()
        ? Number(vMrpRaw)
        : baseMrp;
    if (Number.isFinite(vSp) && Number.isFinite(vMrp) && vSp > vMrp) {
      push('variant_sp', 'Variant selling price cannot exceed variant MRP', rowNum);
    }
  }

  return errors;
}

export function aggregateGroupStock(group: BulkProductGroup): number {
  return group.variants.reduce(
    (sum, row) => sum + (Math.max(0, Math.floor(Number(row.stock_quantity) || 0))),
    0,
  );
}

export function pickGroupParentImages(group: BulkProductGroup): string[] {
  const defaultRow =
    group.variants.find((r) => parseBoolDefault(r.is_default)) ?? group.variants[0];
  if (!defaultRow) return [];
  return parseProductImageList(defaultRow.images ?? defaultRow.image_urls);
}
