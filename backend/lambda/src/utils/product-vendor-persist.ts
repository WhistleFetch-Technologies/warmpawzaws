/**
 * Shared vendor product field persistence — single upload + bulk upload.
 */

import { query } from '../database/rds-connection';
import {
  normalizeDeliveryRegionsList,
  parseOptionalPositiveNumber,
  parseSpecificationsCsv,
  resolveVendorPetTypeInput,
  RESERVED_SPEC_KEYS,
  resolveCityToCanonical,
} from '@warmpawz/shared-types';

/** Cached products column set for bulk + vendor persist. */
const PRODUCTS_COLUMN_CACHE: { until: number; cols: Set<string> | null } = { until: 0, cols: null };
const PRODUCTS_COLUMN_CACHE_TTL_MS = 60_000;

export async function getProductsColumnSet(): Promise<Set<string>> {
  const now = Date.now();
  if (PRODUCTS_COLUMN_CACHE.cols && now < PRODUCTS_COLUMN_CACHE.until) {
    return PRODUCTS_COLUMN_CACHE.cols;
  }
  const r = await query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products'`,
  );
  const cols = new Set<string>((r.rows || []).map((row: { column_name: string }) => row.column_name));
  PRODUCTS_COLUMN_CACHE.cols = cols;
  PRODUCTS_COLUMN_CACHE.until = now + PRODUCTS_COLUMN_CACHE_TTL_MS;
  return cols;
}

/** Drop payload keys that are not real products columns (prevents RDS errors on older schemas). */
export function filterProductPayloadToColumns(
  payload: Record<string, unknown>,
  cols: Set<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (cols.has(key)) out[key] = value;
  }
  return out;
}

export type VendorProductExtrasInput = {
  brand?: unknown;
  weight?: unknown;
  length_cm?: unknown;
  breadth_cm?: unknown;
  height_cm?: unknown;
  key_features?: unknown;
  pet_type?: unknown;
  pet_type_other?: unknown;
  manufacturing_details?: unknown;
  specifications?: unknown;
  specifications_csv?: unknown;
  barcode?: unknown;
  delivery_regions?: unknown;
};

function nestedSpecificationsObject(
  input: VendorProductExtrasInput,
): Record<string, unknown> | null {
  if (
    input.specifications != null &&
    typeof input.specifications === 'object' &&
    !Array.isArray(input.specifications)
  ) {
    return input.specifications as Record<string, unknown>;
  }
  return null;
}

function pickVendorSpecField(
  topLevel: unknown,
  nestedSpecs: Record<string, unknown> | null,
  nestedKey: string,
): unknown {
  if (topLevel !== undefined) return topLevel;
  if (nestedSpecs) return nestedSpecs[nestedKey];
  return undefined;
}

function applyPositiveDimensionField(
  base: Record<string, unknown>,
  key: 'length_cm' | 'breadth_cm' | 'height_cm',
  raw: unknown,
  specsObjectProvided: boolean,
): void {
  if (raw === undefined) {
    if (specsObjectProvided) delete base[key];
    return;
  }
  const n = parseOptionalPositiveNumber(raw);
  if (n != null && n > 0) base[key] = n;
  else delete base[key];
}

function applyTrimmedSpecField(
  base: Record<string, unknown>,
  key: string,
  raw: unknown,
  specsObjectProvided: boolean,
): void {
  if (raw === undefined) {
    if (specsObjectProvided) delete base[key];
    return;
  }
  const trimmed = String(raw).trim();
  if (trimmed) base[key] = trimmed;
  else delete base[key];
}

export function buildSpecificationsFromVendorInput(
  input: VendorProductExtrasInput,
  existingSpecs?: Record<string, unknown> | null,
): Record<string, unknown> {
  const base =
    existingSpecs && typeof existingSpecs === 'object' && !Array.isArray(existingSpecs)
      ? { ...existingSpecs }
      : {};

  const nestedSpecs = nestedSpecificationsObject(input);
  const specsObjectProvided = nestedSpecs !== null;

  if (nestedSpecs) {
    for (const [k, v] of Object.entries(nestedSpecs)) {
      const normKey = k.toLowerCase().replace(/\s+/g, '_');
      if (RESERVED_SPEC_KEYS.has(normKey)) continue;
      if (v != null && String(v).trim() !== '') base[k] = v;
    }
  }

  if (input.specifications_csv != null && String(input.specifications_csv).trim()) {
    const parsed = parseSpecificationsCsv(String(input.specifications_csv));
    for (const [k, v] of Object.entries(parsed)) {
      base[k] = v;
    }
  }

  applyPositiveDimensionField(
    base,
    'length_cm',
    pickVendorSpecField(input.length_cm, nestedSpecs, 'length_cm'),
    specsObjectProvided,
  );
  applyPositiveDimensionField(
    base,
    'breadth_cm',
    pickVendorSpecField(input.breadth_cm, nestedSpecs, 'breadth_cm'),
    specsObjectProvided,
  );
  applyPositiveDimensionField(
    base,
    'height_cm',
    pickVendorSpecField(input.height_cm, nestedSpecs, 'height_cm'),
    specsObjectProvided,
  );

  applyTrimmedSpecField(
    base,
    'key_features',
    pickVendorSpecField(input.key_features, nestedSpecs, 'key_features'),
    specsObjectProvided,
  );

  const resolvedPet = resolveVendorPetTypeInput(
    pickVendorSpecField(input.pet_type, nestedSpecs, 'pet_type'),
    pickVendorSpecField(input.pet_type_other, nestedSpecs, 'pet_type_other'),
  );
  if (resolvedPet.pet_type) {
    base.pet_type = resolvedPet.pet_type;
    if (resolvedPet.pet_type === 'other' && resolvedPet.pet_type_other) {
      base.pet_type_other = resolvedPet.pet_type_other;
    } else {
      delete base.pet_type_other;
    }
  } else if (specsObjectProvided) {
    delete base.pet_type;
    delete base.pet_type_other;
  }

  applyTrimmedSpecField(
    base,
    'manufacturing_details',
    pickVendorSpecField(input.manufacturing_details, nestedSpecs, 'manufacturing_details'),
    specsObjectProvided,
  );

  return base;
}

export function buildMetadataWithDeliveryRegions(
  existingMeta: Record<string, unknown> | null | undefined,
  deliveryRegions: unknown,
): Record<string, unknown> {
  const meta = existingMeta && typeof existingMeta === 'object' ? { ...existingMeta } : {};
  if (deliveryRegions === null) {
    delete meta.delivery_regions;
    return meta;
  }
  if (deliveryRegions !== undefined) {
    // Canonicalize each city through the alias map so "Bangalore" is stored as "bengaluru".
    const list = normalizeDeliveryRegionsList(deliveryRegions).map((city) =>
      resolveCityToCanonical(city),
    );
    if (list.length > 0) {
      meta.delivery_regions = list;
    } else {
      delete meta.delivery_regions;
    }
  }
  return meta;
}

export function applyVendorProductExtrasToPayload(
  payload: Record<string, unknown>,
  input: VendorProductExtrasInput,
  cols: Set<string>,
  existingSpecs?: Record<string, unknown> | null,
  existingMeta?: Record<string, unknown> | null,
  opts?: { partial?: boolean },
): void {
  const partial = opts?.partial ?? false;
  const brandTrimmed =
    input.brand != null && String(input.brand).trim() ? String(input.brand).trim() : '';

  if ((!partial || input.weight !== undefined) && cols.has('weight')) {
    if (input.weight === null || input.weight === '') {
      payload.weight = null;
    } else {
      const weight = parseOptionalPositiveNumber(input.weight);
      if (weight != null) payload.weight = weight;
    }
  }

  if (
    (!partial || input.barcode !== undefined) &&
    input.barcode != null &&
    String(input.barcode).trim() &&
    cols.has('barcode')
  ) {
    payload.barcode = String(input.barcode).trim();
  }

  const specsInput: VendorProductExtrasInput = partial
    ? {
        ...(input.length_cm !== undefined ? { length_cm: input.length_cm } : {}),
        ...(input.breadth_cm !== undefined ? { breadth_cm: input.breadth_cm } : {}),
        ...(input.height_cm !== undefined ? { height_cm: input.height_cm } : {}),
        ...(input.key_features !== undefined ? { key_features: input.key_features } : {}),
        ...(input.pet_type !== undefined ? { pet_type: input.pet_type } : {}),
        ...(input.pet_type_other !== undefined ? { pet_type_other: input.pet_type_other } : {}),
        ...(input.manufacturing_details !== undefined
          ? { manufacturing_details: input.manufacturing_details }
          : {}),
        ...(input.specifications !== undefined ? { specifications: input.specifications } : {}),
        ...(input.specifications_csv !== undefined
          ? { specifications_csv: input.specifications_csv }
          : {}),
      }
    : input;

  const hasSpecInput =
    !partial ||
    input.length_cm !== undefined ||
    input.breadth_cm !== undefined ||
    input.height_cm !== undefined ||
    input.key_features !== undefined ||
    input.pet_type !== undefined ||
    input.pet_type_other !== undefined ||
    input.manufacturing_details !== undefined ||
    input.specifications !== undefined ||
    input.specifications_csv !== undefined;

  if (hasSpecInput && cols.has('specifications')) {
    const specs = buildSpecificationsFromVendorInput(specsInput, existingSpecs ?? null);
    if (Object.keys(specs).length > 0 || !partial) {
      payload.specifications = specs;
    }
  }

  if ((!partial || input.delivery_regions !== undefined) && cols.has('metadata')) {
    const currentMeta =
      (payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)
        ? (payload.metadata as Record<string, unknown>)
        : null) ??
      existingMeta ??
      {};
    payload.metadata = buildMetadataWithDeliveryRegions(currentMeta, input.delivery_regions);
  }

  if ((!partial || input.brand !== undefined) && brandTrimmed) {
    if (cols.has('brand')) {
      payload.brand = brandTrimmed;
    } else if (cols.has('specifications')) {
      const existing =
        payload.specifications &&
        typeof payload.specifications === 'object' &&
        !Array.isArray(payload.specifications)
          ? { ...(payload.specifications as Record<string, unknown>) }
          : {};
      existing.brand = brandTrimmed;
      payload.specifications = existing;
    }
  }
}

/** Map bulk parsed row to vendor extras input. */
export function vendorExtrasFromBulkRow(row: Record<string, unknown>): VendorProductExtrasInput {
  return {
    brand: row.brand,
    weight: row.weight,
    length_cm: row.length_cm ?? row.dim_len_cm,
    breadth_cm: row.breadth_cm ?? row.dim_breadth_cm,
    height_cm: row.height_cm ?? row.dim_height_cm,
    key_features: row.key_features,
    pet_type: row.pet_type,
    pet_type_other: row.pet_type_other,
    manufacturing_details: row.manufacturing_details,
    specifications_csv: row.specifications_csv ?? row.product_specifications,
    barcode: row.barcode,
    delivery_regions: row.delivery_regions,
  };
}
