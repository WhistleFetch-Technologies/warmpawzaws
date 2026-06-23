/**
 * Normalize product rows for storefront / vendor API responses.
 */

import {
  normalizeDeliveryRegionsList,
  parseOptionalPositiveNumber,
  type StorefrontDimensions,
} from '@warmpawz/shared-types';

function parseSpecificationsObject(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
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

export function extractDeliveryRegionsFromRow(
  row: Record<string, unknown>,
): string[] {
  if (Array.isArray(row.delivery_regions)) {
    return normalizeDeliveryRegionsList(row.delivery_regions);
  }
  const meta =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null;
  if (meta && meta.delivery_regions != null) {
    return normalizeDeliveryRegionsList(meta.delivery_regions);
  }
  const specs = parseSpecificationsObject(row.specifications);
  if (specs.delivery_regions != null) {
    return normalizeDeliveryRegionsList(specs.delivery_regions);
  }
  return [];
}

export function buildStorefrontDimensions(
  row: Record<string, unknown>,
): StorefrontDimensions | null {
  const specs = parseSpecificationsObject(row.specifications);
  const length =
    parseOptionalPositiveNumber(specs.length_cm) ??
    parseOptionalPositiveNumber(specs.length);
  const breadth =
    parseOptionalPositiveNumber(specs.breadth_cm) ??
    parseOptionalPositiveNumber(specs.breadth);
  const height =
    parseOptionalPositiveNumber(specs.height_cm) ??
    parseOptionalPositiveNumber(specs.height);
  const weight = parseOptionalPositiveNumber(row.weight);

  if (length == null && breadth == null && height == null && weight == null) {
    return null;
  }

  return {
    length: length ?? 0,
    width: breadth ?? 0,
    height: height ?? 0,
    weight: weight ?? 0,
  };
}

/** Flatten metadata + build PDP-friendly fields on a product row. */
export function flattenProductForApiResponse(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  const regions = extractDeliveryRegionsFromRow(row);
  out.delivery_regions = regions.length > 0 ? regions : [];

  const dims = buildStorefrontDimensions(row);
  if (dims) {
    out.dimensions = dims;
  }

  const specs = parseSpecificationsObject(row.specifications);
  if (specs.key_features != null && !out.key_features) {
    out.key_features = specs.key_features;
  }
  if (specs.pet_type != null && !out.pet_type) {
    out.pet_type = specs.pet_type;
  }
  if (specs.pet_type_other != null && !out.pet_type_other) {
    out.pet_type_other = specs.pet_type_other;
  }
  if (specs.manufacturing_details != null && !out.manufacturing_details) {
    out.manufacturing_details = specs.manufacturing_details;
  }

  return out;
}
