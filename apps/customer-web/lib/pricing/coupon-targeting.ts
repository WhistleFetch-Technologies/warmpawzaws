import { promotionCategoriesMatch } from '@/lib/promotion-banner-filter';

export type { PromotionFilterInput } from '@/lib/promotion-banner-filter';

function parseCouponMetadata(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

export function parseCouponVendorIds(row: {
  vendor_ids?: unknown;
  vendorIds?: unknown;
  metadata?: unknown;
}): string[] {
  const meta = parseCouponMetadata(row.metadata);
  const selected =
    (meta.selectedTargets as Record<string, unknown> | undefined) ??
    (meta.selected_targets as Record<string, unknown> | undefined) ??
    {};
  const fromTargets = Array.isArray(selected.vendors)
    ? selected.vendors.map((x) => String(x).trim()).filter(Boolean)
    : [];
  const topLevel = row.vendor_ids ?? row.vendorIds ?? meta.vendorIds ?? meta.vendor_ids;
  const fromTop = Array.isArray(topLevel)
    ? topLevel.map((x) => String(x).trim()).filter(Boolean)
    : [];
  return Array.from(new Set([...fromTargets, ...fromTop]));
}

/** Mirrors backend couponRowMatchesVendor. */
export function couponOfferMatchesVendor(
  row: { vendor_ids?: unknown; vendorIds?: unknown; metadata?: unknown },
  vendorId?: string
): boolean {
  const vendorIds = parseCouponVendorIds(row);
  if (vendorIds.length === 0) return true;
  if (!vendorId) return false;
  return vendorIds.includes(String(vendorId).trim());
}

export function parseCouponApplicableServices(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
    } catch {
      return [raw.trim()].filter(Boolean);
    }
  }
  return [];
}

function isUuidToken(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

/**
 * Whether a coded offer row applies to the checkout service bucket (vet, grooming, …).
 * Mirrors backend couponRowMatchesService — UUID-only targeting passes the bucket filter;
 * apply / validate-code enforce the concrete service match with serviceIds.
 */
export function couponOfferMatchesService(
  row: {
    applicable_services?: unknown;
    service_category?: string;
    applicable_to?: string;
  },
  serviceCategory?: string
): boolean {
  if (!serviceCategory || serviceCategory === 'all') return true;

  const bucket = serviceCategory.trim().toLowerCase();
  const applicable = parseCouponApplicableServices(row.applicable_services);
  const category = String(row.service_category ?? '').trim().toLowerCase();
  const applicableTo = String(row.applicable_to ?? 'all').trim().toLowerCase();

  if (applicableTo === 'products' && bucket !== 'shop' && bucket !== 'product') {
    return false;
  }

  if (applicable.length === 0 && (!category || category === 'all')) return true;

  const categoryTokens = applicable.filter(
    (token) => !token.startsWith('style:') && !isUuidToken(token)
  );
  const hasServiceIdTargets = applicable.some(isUuidToken);

  if (categoryTokens.some((token) => promotionCategoriesMatch(bucket, token))) return true;
  if (category && category !== 'all' && promotionCategoriesMatch(bucket, category)) return true;

  // UUID-only (or style+UUID) targeting: cannot resolve category from IDs here.
  if (categoryTokens.length === 0 && hasServiceIdTargets) {
    return !category || category === 'all';
  }

  return false;
}
