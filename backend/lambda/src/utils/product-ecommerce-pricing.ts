/**
 * E-commerce product pricing: MRP (compare_at_price) is required; selling price (price) is optional.
 * When selling price is omitted, it defaults to MRP (no discount).
 */

export type NormalizedEcommercePricing = {
  /** Stored in products.compare_at_price */
  mrp: number;
  /** Stored in products.price — amount charged at checkout */
  sellingPrice: number;
};

export type PricingNormalizeFailure = {
  ok: false;
  field: 'compare_at_price' | 'price';
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

/** MRP / list price from API or bulk row. */
export function getMrpFromRecord(record: Record<string, unknown>): number | null {
  const meta =
    record.metadata != null && typeof record.metadata === 'object' && !Array.isArray(record.metadata)
      ? (record.metadata as Record<string, unknown>)
      : null;

  return (
    parsePositiveMoney(record.compare_at_price) ??
    parsePositiveMoney(record.original_price) ??
    parsePositiveMoney(record.mrp) ??
    parsePositiveMoney(record.compareAtPrice) ??
    parsePositiveMoney(record.originalPrice) ??
    parsePositiveMoney(meta?.compare_at_price) ??
    parsePositiveMoney(meta?.original_price) ??
    parsePositiveMoney(meta?.mrp)
  );
}

/** Explicit selling price from API or bulk row (may be absent). */
export function getSellingFromRecord(record: Record<string, unknown>): number | null {
  return (
    parsePositiveMoney(record.selling_price) ??
    parsePositiveMoney(record.sellingPrice) ??
    parsePositiveMoney(record.sp) ??
    parsePositiveMoney(record.price)
  );
}

/**
 * Normalize MRP + selling price for DB writes and validation.
 * Legacy rows with only `price` and no MRP: treat `price` as MRP (no discount until MRP column is filled).
 */
export function normalizeEcommerceProductPricing(
  record: Record<string, unknown>,
): PricingNormalizeSuccess | PricingNormalizeFailure {
  let mrp = getMrpFromRecord(record);
  let selling = getSellingFromRecord(record);

  if (mrp == null && selling != null) {
    mrp = selling;
    selling = null;
  }

  if (mrp == null) {
    return { ok: false, field: 'compare_at_price', message: 'MRP is required' };
  }

  const sellingPrice = selling ?? mrp;
  if (sellingPrice > mrp) {
    return {
      ok: false,
      field: 'price',
      message: 'Selling price cannot exceed MRP',
    };
  }

  return { ok: true, pricing: { mrp, sellingPrice } };
}

export function productDiscountPercent(mrp: number, sellingPrice: number): number {
  if (!mrp || mrp <= sellingPrice) return 0;
  return Math.round(((mrp - sellingPrice) / mrp) * 100);
}

export function applyNormalizedPricingToDbPayload(
  pricing: NormalizedEcommercePricing,
  payload: Record<string, unknown>,
  cols: Set<string>,
): void {
  payload.price = pricing.sellingPrice;
  if (cols.has('compare_at_price')) {
    payload.compare_at_price = pricing.mrp;
  }
}
