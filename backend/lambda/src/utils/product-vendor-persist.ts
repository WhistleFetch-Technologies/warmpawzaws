/**
 * Shared vendor product field persistence — single upload + bulk upload.
 */

import { query } from '../database/rds-connection';
import {
  normalizeDeliveryRegionsList,
  normalizePetType,
  parseOptionalPositiveNumber,
  parseSpecificationsCsv,
  RESERVED_SPEC_KEYS,
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

export function buildSpecificationsFromVendorInput(
  input: VendorProductExtrasInput,
  existingSpecs?: Record<string, unknown> | null,
): Record<string, unknown> {
  const base =
    existingSpecs && typeof existingSpecs === 'object' && !Array.isArray(existingSpecs)
      ? { ...existingSpecs }
      : {};

  if (input.specifications != null && typeof input.specifications === 'object' && !Array.isArray(input.specifications)) {
    for (const [k, v] of Object.entries(input.specifications as Record<string, unknown>)) {
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

  const length = parseOptionalPositiveNumber(input.length_cm);
  const breadth = parseOptionalPositiveNumber(input.breadth_cm);
  const height = parseOptionalPositiveNumber(input.height_cm);
  if (length != null) base.length_cm = length;
  if (breadth != null) base.breadth_cm = breadth;
  if (height != null) base.height_cm = height;

  if (input.key_features != null && String(input.key_features).trim()) {
    base.key_features = String(input.key_features).trim();
  }

  const petType = normalizePetType(input.pet_type);
  if (petType) {
    base.pet_type = petType;
    if (petType === 'other' && input.pet_type_other != null && String(input.pet_type_other).trim()) {
      base.pet_type_other = String(input.pet_type_other).trim();
    } else if (petType !== 'other') {
      delete base.pet_type_other;
    }
  }

  if (input.manufacturing_details != null && String(input.manufacturing_details).trim()) {
    base.manufacturing_details = String(input.manufacturing_details).trim();
  }

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
    const list = normalizeDeliveryRegionsList(deliveryRegions);
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

  if (
    (!partial || input.brand !== undefined) &&
    input.brand != null &&
    String(input.brand).trim() &&
    cols.has('brand')
  ) {
    payload.brand = String(input.brand).trim();
  }

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
