/**
 * Normalize product rows for storefront / vendor API responses.
 */

import {
  normalizeDeliveryRegionsList,
  parseOptionalPositiveNumber,
  formatPetTypeForCustomer,
  RESERVED_SPEC_KEYS,
  type StorefrontDimensions,
} from '@warmpawz/shared-types';
import { stripStorefrontListPriceFields } from './product-ecommerce-pricing';

export function parseSpecificationsObject(raw: unknown): Record<string, unknown> {
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

/** Parse a dimension value — returns null when the value is missing or 0 (not meaningful). */
function parseStrictPositiveDim(val: unknown): number | null {
  const n = parseOptionalPositiveNumber(val);
  return n != null && n > 0 ? n : null;
}

export function buildStorefrontDimensions(
  row: Record<string, unknown>,
): StorefrontDimensions | null {
  const specs = parseSpecificationsObject(row.specifications);
  const length =
    parseStrictPositiveDim(specs.length_cm) ??
    parseStrictPositiveDim(specs.length);
  const breadth =
    parseStrictPositiveDim(specs.breadth_cm) ??
    parseStrictPositiveDim(specs.breadth);
  const height =
    parseStrictPositiveDim(specs.height_cm) ??
    parseStrictPositiveDim(specs.height);
  const weight = parseStrictPositiveDim(row.weight);

  // Return null (no dimensions block) when every value is absent or 0.
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

  out.pet_type_display = formatPetTypeForCustomer(out.pet_type, out.pet_type_other);

  return out;
}

/** Custom vendor spec keys only — excludes internal reserved keys. */
export function customerSpecificationsFromRow(
  specs: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(specs)) {
    const normKey = k.toLowerCase().replace(/\s+/g, '_');
    if (RESERVED_SPEC_KEYS.has(normKey)) continue;
    if (v == null || String(v).trim() === '') continue;
    out[k] = String(v);
  }
  return out;
}

/** Strip seller identity and internal fields from public storefront product JSON. */
export function sanitizeStorefrontProductForCustomer(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };

  delete out.vendor_name;
  delete out.vendor_city;
  delete out.business_name;
  delete out.barcode;
  delete out.hsn_code;
  delete out.gst_rate;
  delete out.sku;
  delete out.cost_price;
  delete out.metadata;
  if (out.pet_type_display == null) {
    out.pet_type_display = formatPetTypeForCustomer(out.pet_type, out.pet_type_other);
  }
  delete out.pet_type_other;

  const specs = parseSpecificationsObject(out.specifications);
  out.specifications = customerSpecificationsFromRow(specs);

  return stripStorefrontListPriceFields(out);
}
