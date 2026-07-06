/**
 * E-commerce product pricing.
 *
 * Single-price model: `price` is the one canonical price vendors set.
 * `compare_at_price` is reserved for the promotion engine — it is set only when
 * a vendor or admin promotion is active, to drive the strikethrough UI on the
 * storefront. Vendors no longer set MRP / compare_at_price directly.
 */

export type NormalizedEcommercePricing = {
  /** Stored in products.price — the single canonical price (amount charged at checkout). */
  price: number;
};

export type PricingNormalizeFailure = {
  ok: false;
  field: 'price';
  message: string;
};

export type PricingNormalizeSuccess = {
  ok: true;
  pricing: NormalizedEcommercePricing;
};

export function parsePositiveMoney(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = parseFloat(String(raw).replace(/,/g, '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Resolve the single canonical price from any field the vendor or bulk CSV might send.
 * Accepts: price, selling_price, sp, sellingPrice, compare_at_price (legacy), mrp (legacy),
 * original_price (legacy). All map to the one price field.
 */
export function getPriceFromRecord(record: Record<string, unknown>): number | null {
  const meta =
    record.metadata != null && typeof record.metadata === 'object' && !Array.isArray(record.metadata)
      ? (record.metadata as Record<string, unknown>)
      : null;

  return (
    parsePositiveMoney(record.price) ??
    parsePositiveMoney(record.selling_price) ??
    parsePositiveMoney(record.sellingPrice) ??
    parsePositiveMoney(record.sp) ??
    // Legacy bulk CSV / single-form fields — accepted as the canonical price.
    parsePositiveMoney(record.compare_at_price) ??
    parsePositiveMoney(record.original_price) ??
    parsePositiveMoney(record.mrp) ??
    parsePositiveMoney(record.compareAtPrice) ??
    parsePositiveMoney(record.originalPrice) ??
    parsePositiveMoney(meta?.price) ??
    parsePositiveMoney(meta?.selling_price) ??
    parsePositiveMoney(meta?.compare_at_price)
  );
}

/**
 * @deprecated Use getPriceFromRecord — kept so callers referencing getMrpFromRecord compile.
 * Returns the same single canonical price as getPriceFromRecord.
 */
export function getMrpFromRecord(record: Record<string, unknown>): number | null {
  return getPriceFromRecord(record);
}

/**
 * @deprecated Use getPriceFromRecord — kept for backward compatibility.
 */
export function getSellingFromRecord(record: Record<string, unknown>): number | null {
  return parsePositiveMoney(record.price) ?? parsePositiveMoney(record.selling_price) ?? null;
}

/**
 * Normalize the price field for DB writes and validation.
 * Accepts any of the legacy field names; all resolve to a single `price` value.
 */
export function normalizeEcommerceProductPricing(
  record: Record<string, unknown>,
): PricingNormalizeSuccess | PricingNormalizeFailure {
  const price = getPriceFromRecord(record);

  if (price == null) {
    return { ok: false, field: 'price', message: 'Price is required and must be greater than 0' };
  }

  return { ok: true, pricing: { price } };
}

/** Discount percentage when a promotion is active (compare_at_price set by promotion engine). */
export function productDiscountPercent(compareAtPrice: number, sellingPrice: number): number {
  if (!compareAtPrice || compareAtPrice <= sellingPrice) return 0;
  return Math.round(((compareAtPrice - sellingPrice) / compareAtPrice) * 100);
}

/**
 * Write the normalized pricing to the DB payload.
 * Only writes `price`; compare_at_price is managed exclusively by the promotion engine.
 */
export function applyNormalizedPricingToDbPayload(
  pricing: NormalizedEcommercePricing,
  payload: Record<string, unknown>,
  cols: Set<string>,
): void {
  payload.price = pricing.price;
  // Single-price model: clear legacy MRP/compare_at whenever vendor price is saved.
  clearLegacyCompareAtFromDbPayload(payload, cols);
}

/** Null out compare_at_price so stale MRP rows do not show fake discounts on the storefront. */
export function clearLegacyCompareAtFromDbPayload(
  payload: Record<string, unknown>,
  cols: Set<string>,
): void {
  if (cols.has('compare_at_price')) {
    payload.compare_at_price = null;
  }
}

/** Remove list-price fields from customer-facing product JSON (SP only until promo read-time is wired). */
export function stripStorefrontListPriceFields(row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row };
  delete out.compare_at_price;
  delete out.original_price;
  delete out.min_compare_at_price;
  return out;
}
