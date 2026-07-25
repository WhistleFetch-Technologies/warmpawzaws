import { resolvePersistedDiscountDomain } from './commercial-discount-domain';
import { promotionCategoriesMatch } from './platform-promotion-matching';

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

function parseCouponMetadata(row: Record<string, unknown>): Record<string, unknown> {
  const meta = row.metadata;
  if (meta && typeof meta === 'object') return meta as Record<string, unknown>;
  if (typeof meta === 'string') {
    try {
      return JSON.parse(meta) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

/** Vendor allow-list from admin wizard metadata or vendor_ids on the row. */
export function parseCouponVendorIds(row: Record<string, unknown>): string[] {
  const meta = parseCouponMetadata(row);
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

/**
 * Whether a platform coupon applies to the checkout vendor.
 * Vendor-scoped coupons are hidden/rejected when vendorId is missing.
 */
export function couponRowMatchesVendor(
  row: Record<string, unknown>,
  vendorId?: string
): boolean {
  const vendorIds = parseCouponVendorIds(row);
  if (vendorIds.length === 0) return true;
  if (!vendorId) return false;
  return vendorIds.includes(String(vendorId).trim());
}

/**
 * Whether a platform coupon row applies to a customer service bucket (vet, grooming, …).
 * Service-UUID tokens in applicable_services are not category slugs — the active-list
 * endpoint has no selected service IDs, so UUID-only targeting passes the bucket filter
 * and eligibility / apply enforce the concrete service match.
 */
export function couponRowMatchesService(
  row: Record<string, unknown>,
  serviceBucket: string | undefined
): boolean {
  if (!serviceBucket || serviceBucket === 'all') return true;

  const bucket = serviceBucket.trim().toLowerCase();
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

export function buildCouponTargetingFromAdminBody(body: Record<string, unknown>): {
  applicable_to: string;
  service_category: string | null;
  applicable_services: string[] | null;
  discount_domain: 'SERVICE' | 'ECOMMERCE';
  metadata: Record<string, unknown>;
} {
  const applicableServices = body.applicable_services ?? body.applicableServices;
  const parsedServices = parseCouponApplicableServices(applicableServices);
  const serviceCategory =
    body.service_category ??
    body.serviceCategory ??
    (body.selected_targets as any)?.categories?.[0] ??
    (body.selectedTargets as any)?.categories?.[0];

  const discountDomain = resolvePersistedDiscountDomain(body, 'SERVICE');
  let applicableTo =
    String(body.applicable_to ?? body.applicableTo ?? 'all').trim().toLowerCase() || 'all';
  if (discountDomain === 'ECOMMERCE') {
    if (!applicableTo || applicableTo === 'all' || applicableTo === 'bookings' || applicableTo === 'services') {
      applicableTo = 'products';
    }
  }

  const selectedTargetsRaw =
    body.selected_targets ?? body.selectedTargets;
  const selectedTargets =
    selectedTargetsRaw && typeof selectedTargetsRaw === 'object'
      ? (selectedTargetsRaw as Record<string, unknown>)
      : {};
  const vendorIdsFromBody = Array.isArray(body.vendor_ids)
    ? body.vendor_ids.map((x) => String(x).trim()).filter(Boolean)
    : Array.isArray(body.vendorIds)
      ? body.vendorIds.map((x) => String(x).trim()).filter(Boolean)
      : Array.isArray(selectedTargets.vendors)
        ? selectedTargets.vendors.map((x) => String(x).trim()).filter(Boolean)
        : [];

  const metadata: Record<string, unknown> = {
    ...(typeof body.metadata === 'object' && body.metadata ? (body.metadata as Record<string, unknown>) : {}),
    targetScopes: body.target_scopes ?? body.targetScopes,
    selectedTargets: selectedTargetsRaw ?? body.selectedTargets,
    vendorIds: vendorIdsFromBody.length > 0 ? vendorIdsFromBody : undefined,
    serviceCategory: serviceCategory ?? null,
    discount_domain: discountDomain,
    domain: discountDomain === 'ECOMMERCE' ? 'ecommerce' : 'service',
    surface: discountDomain === 'ECOMMERCE' ? 'ecommerce' : 'marketing',
  };

  return {
    applicable_to: applicableTo,
    service_category: serviceCategory ? String(serviceCategory) : null,
    applicable_services: parsedServices.length > 0 ? parsedServices : null,
    discount_domain: discountDomain,
    metadata,
  };
}
