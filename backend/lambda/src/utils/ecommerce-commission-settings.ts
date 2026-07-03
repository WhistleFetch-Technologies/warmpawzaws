/**
 * Helpers for ecommerce_commission_settings read/write and seller_rates normalization.
 */

export function normalizeCommissionRate(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

/** Parse category commission from admin payload (supports legacy field names). */
export function parseCategoryCommissionRate(item: Record<string, unknown>): number | null {
  const raw =
    item.default_commission_rate ??
    item.defaultCommissionRate ??
    item.commissionRate ??
    item.commission_rate;
  return normalizeCommissionRate(raw);
}

/** Extract vendor-wide default from seller_rates entry (flat number or { default }). */
export function parseSellerRateOverride(entry: unknown): number | null {
  if (entry == null) return null;
  if (typeof entry === 'number' || typeof entry === 'string') {
    return normalizeCommissionRate(entry);
  }
  if (typeof entry === 'object' && !Array.isArray(entry)) {
    const obj = entry as Record<string, unknown>;
    return normalizeCommissionRate(obj.default ?? obj.rate ?? obj.commissionRate);
  }
  return null;
}

/** Normalize seller_rates for API responses (keeps flat numbers as-is for backward compat). */
export function normalizeSellerRatesForResponse(
  raw: unknown
): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      return normalizeSellerRatesForResponse(JSON.parse(raw));
    } catch {
      return {};
    }
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

export function buildCommissionSettingsResponse(row: Record<string, unknown>) {
  const rulesRaw = row.rules;
  const rules =
    typeof rulesRaw === 'string'
      ? (JSON.parse(rulesRaw) as unknown[])
      : Array.isArray(rulesRaw)
        ? rulesRaw
        : [];

  const sellerRates = normalizeSellerRatesForResponse(row.seller_rates);

  return {
    defaultRate: parseFloat(String(row.default_rate ?? 15)) || 15,
    rules,
    sellerRates,
  };
}
