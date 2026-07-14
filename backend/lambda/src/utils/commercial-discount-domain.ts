/**
 * Durable commercial domain for platform promotions & coupons (Phase E1).
 * New rows always persist SERVICE | ECOMMERCE. Legacy NULL uses fallbacks.
 */

export type CommercialDiscountDomain = 'SERVICE' | 'ECOMMERCE';

const ECOMMERCE_CATEGORY_HINTS = new Set([
  'shop',
  'ecommerce',
  'product',
  'retail',
  'marketplace',
  'pet-shop',
  'pet_shop',
  'petshop',
]);

function parseProductList(raw: unknown): unknown[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Normalize API / wizard body into SERVICE | ECOMMERCE | null (unset). */
export function parseDiscountDomainInput(raw: unknown): CommercialDiscountDomain | null {
  if (raw == null || raw === '') return null;
  const value = String(raw).trim().toUpperCase();
  if (value === 'SERVICE' || value === 'SERVICES' || value === 'BOOKING' || value === 'BOOKINGS') {
    return 'SERVICE';
  }
  if (
    value === 'ECOMMERCE' ||
    value === 'PRODUCT' ||
    value === 'PRODUCTS' ||
    value === 'SHOP' ||
    value === 'MARKETPLACE'
  ) {
    return 'ECOMMERCE';
  }
  return null;
}

/**
 * Infer domain for legacy rows missing discount_domain.
 * Prefer explicit column / metadata when present.
 */
export function inferLegacyDiscountDomain(row: Record<string, unknown>): CommercialDiscountDomain {
  const explicit = parseDiscountDomainInput(
    row.discount_domain ?? row.discountDomain ?? row.domain
  );
  if (explicit) return explicit;

  const meta =
    row.metadata && typeof row.metadata === 'object'
      ? (row.metadata as Record<string, unknown>)
      : {};
  const metaDomain = parseDiscountDomainInput(
    meta.discount_domain ?? meta.discountDomain ?? meta.domain ?? meta.surface
  );
  if (metaDomain) return metaDomain;

  const products = parseProductList(
    row.applicable_products ?? row.applicableProducts ?? meta.applicableProducts
  );
  if (products.length > 0) return 'ECOMMERCE';

  if (row.seller_id || row.sellerId || meta.sellerId) return 'ECOMMERCE';

  const applicableTo = String(
    row.applicable_to ?? row.applicableTo ?? meta.applicableTo ?? ''
  )
    .trim()
    .toLowerCase();
  if (applicableTo === 'products') return 'ECOMMERCE';
  if (applicableTo === 'bookings' || applicableTo === 'services') return 'SERVICE';

  const targetScopes = parseProductList(meta.targetScopes ?? row.target_scopes);
  const scopeStr = targetScopes.map((s) => String(s).toLowerCase());
  if (scopeStr.includes('products') || scopeStr.includes('all_products')) return 'ECOMMERCE';
  if (
    scopeStr.some((s) =>
      ['services', 'packages', 'meal_plans', 'styles', 'entire_platform'].includes(s)
    )
  ) {
    return 'SERVICE';
  }

  const cat = String(row.service_category ?? row.serviceCategory ?? meta.serviceCategory ?? '')
    .trim()
    .toLowerCase();
  if (ECOMMERCE_CATEGORY_HINTS.has(cat)) return 'ECOMMERCE';

  const promoType = String(row.promotion_type ?? row.type ?? '').toLowerCase();
  if (promoType.includes('product') || promoType.includes('seller')) return 'ECOMMERCE';

  // Default legacy → SERVICE (Marketing / booking world)
  return 'SERVICE';
}

export function resolvePersistedDiscountDomain(
  body: Record<string, unknown>,
  fallback: CommercialDiscountDomain = 'SERVICE'
): CommercialDiscountDomain {
  return (
    parseDiscountDomainInput(
      body.discount_domain ?? body.discountDomain ?? body.domain ?? body.surface
    ) ?? fallback
  );
}

/**
 * SQL fragment helpers for admin / customer list queries.
 * Includes NULL discount_domain rows that legacy-infer to the requested domain
 * only when includeLegacyFallback is true (default for customer/admin lists).
 */
export function appendDiscountDomainFilter(opts: {
  queryStr: string;
  params: unknown[];
  paramIndex: number;
  domain: CommercialDiscountDomain;
  /** When true, also include rows with NULL discount_domain that look like this domain via applicable_to / service_category. */
  includeLegacyHeuristics?: boolean;
}): { queryStr: string; params: unknown[]; paramIndex: number } {
  const { domain, includeLegacyHeuristics = true } = opts;
  let { queryStr, params, paramIndex } = opts;

  queryStr += ` AND (UPPER(COALESCE(discount_domain, '')) = $${paramIndex}`;
  params.push(domain);
  paramIndex++;

  if (includeLegacyHeuristics) {
    if (domain === 'ECOMMERCE') {
      queryStr += ` OR (
        (discount_domain IS NULL OR TRIM(COALESCE(discount_domain, '')) = '')
        AND (
          LOWER(COALESCE(applicable_to, '')) = 'products'
          OR LOWER(COALESCE(service_category, '')) IN ('shop','ecommerce','product','retail','marketplace','pet-shop','pet_shop','petshop')
        )
      )`;
    } else {
      queryStr += ` OR (
        (discount_domain IS NULL OR TRIM(COALESCE(discount_domain, '')) = '')
        AND (
          applicable_to IS NULL
          OR LOWER(COALESCE(applicable_to, '')) IN ('all','bookings','services')
        )
        AND (
          service_category IS NULL
          OR LOWER(COALESCE(service_category, '')) NOT IN ('shop','ecommerce','product','retail','marketplace','pet-shop','pet_shop','petshop')
        )
      )`;
    }
  }

  queryStr += `)`;
  return { queryStr, params, paramIndex };
}

export function rowMatchesDiscountDomain(
  row: Record<string, unknown>,
  domain: CommercialDiscountDomain
): boolean {
  return inferLegacyDiscountDomain(row) === domain;
}
