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

/** Whether a platform coupon row applies to a customer service bucket (vet, grooming, …). */
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

  if (applicable.some((token) => promotionCategoriesMatch(bucket, token))) return true;
  if (category && category !== 'all' && promotionCategoriesMatch(bucket, category)) return true;

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

  const metadata: Record<string, unknown> = {
    ...(typeof body.metadata === 'object' && body.metadata ? (body.metadata as Record<string, unknown>) : {}),
    targetScopes: body.target_scopes ?? body.targetScopes,
    selectedTargets: body.selected_targets ?? body.selectedTargets,
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
