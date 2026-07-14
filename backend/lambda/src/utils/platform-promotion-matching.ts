import { customerServicesForCatalogCategorySlug } from './catalog-category-customer-service-map';

/**
 * Admin catalogue category slugs (e.g. veterinary) vs customer booking category (e.g. vet).
 */
export function promotionCategoriesMatch(
  requestCategory: string | undefined | null,
  promoCategoryOrToken: string | undefined | null
): boolean {
  const req = String(requestCategory ?? '').trim().toLowerCase();
  const promo = String(promoCategoryOrToken ?? '').trim().toLowerCase();
  if (!promo || promo === 'all') return true;
  if (!req) return true;
  if (req === promo) return true;

  const fromPromo = customerServicesForCatalogCategorySlug(promo);
  if (fromPromo.includes(req)) return true;

  const fromReq = customerServicesForCatalogCategorySlug(req);
  if (fromReq.includes(promo)) return true;

  return false;
}

export function parsePromotionServicesList(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((x) => String(x).trim()).filter(Boolean) : [];
    } catch {
      return [raw.trim()].filter(Boolean);
    }
  }
  return [];
}

export function promotionServiceTokensMatch(
  requestServiceIds: string[],
  promoTokens: string[],
  requestCategory?: string
): boolean {
  const nonStyle = promoTokens.filter((s) => !s.startsWith('style:'));
  if (nonStyle.length === 0) return true;

  if (requestServiceIds.length > 0) {
    const match = requestServiceIds.some((id) => nonStyle.includes(id));
    if (match) return true;
  }

  if (requestCategory) {
    return nonStyle.some((token) => promotionCategoriesMatch(requestCategory, token));
  }

  return requestServiceIds.length === 0;
}

export function platformPromotionAppliesToBooking(row: Record<string, unknown>): boolean {
  const domain = String(row.discount_domain ?? row.discountDomain ?? '').trim().toUpperCase();
  if (domain === 'ECOMMERCE' || domain === 'PRODUCT') return false;

  const applicableTo = String(row.applicable_to ?? '').trim().toLowerCase();
  if (applicableTo === 'products') return false;

  const meta =
    row.metadata && typeof row.metadata === 'object'
      ? (row.metadata as Record<string, unknown>)
      : {};
  const metaDomain = String(meta.discount_domain ?? meta.domain ?? meta.surface ?? '')
    .trim()
    .toLowerCase();
  if (metaDomain === 'ecommerce' || metaDomain === 'product') return false;

  const metaApplicableTo = String(meta.applicableTo ?? '').trim().toLowerCase();
  if (metaApplicableTo === 'products') return false;

  const targetScopes = parsePromotionServicesList(meta.targetScopes);
  if (
    targetScopes.length > 0 &&
    targetScopes.every((s) => s === 'products' || s === 'all_products')
  ) {
    return false;
  }

  return true;
}

/** Expand catalog service tokens to vendor_services.id for a vendor (all publishers of that catalogue service). */
export async function expandPromotionServiceTokensForVendor(
  vendorId: string,
  tokens: string[],
  queryFn: (text: string, params?: unknown[]) => Promise<{ rows?: Record<string, unknown>[] }>
): Promise<Set<string>> {
  const expanded = new Set(tokens.map((t) => String(t)));
  const candidates = tokens
    .map((t) => String(t).trim())
    .filter((t) => t && !t.startsWith('style:'));
  if (!vendorId || candidates.length === 0) return expanded;

  try {
    const res = await queryFn(
      `SELECT vs.id::text AS vendor_service_id,
              vs.service_id::text AS catalog_service_id,
              sc.service_id::text AS catalog_service_code
       FROM vendor_services vs
       LEFT JOIN service_catalog sc ON sc.id = vs.service_id
       WHERE vs.vendor_id = $1::uuid
         AND (
           vs.id::text = ANY($2::text[])
           OR vs.service_id::text = ANY($2::text[])
           OR sc.id::text = ANY($2::text[])
           OR sc.service_id = ANY($2::text[])
         )`,
      [vendorId, candidates]
    );
    for (const row of res.rows || []) {
      const vsId = String(row.vendor_service_id || '');
      const catalogId = row.catalog_service_id ? String(row.catalog_service_id) : '';
      const catalogCode = row.catalog_service_code ? String(row.catalog_service_code) : '';
      if (vsId) expanded.add(vsId);
      if (catalogId) expanded.add(catalogId);
      if (catalogCode) expanded.add(catalogCode);
    }
  } catch {
    /* keep original tokens */
  }

  return expanded;
}

export function platformPromoMatchesBookingContext(
  row: Record<string, unknown>,
  params: {
    category?: string;
    serviceStyle?: string;
    serviceIds: string[];
    amount: number;
    expandedServiceTokens?: Set<string>;
  },
  normalizeStyle: (raw: unknown) => string
): boolean {
  if (!platformPromotionAppliesToBooking(row)) return false;

  const now = new Date();
  const start = row.start_date ? new Date(String(row.start_date)) : null;
  const end = row.end_date ? new Date(String(row.end_date)) : null;
  if (start && now < start) return false;
  if (end && now > end) return false;
  if (row.published === false) return false;

  const minOrder = row.min_order_amount != null ? parseFloat(String(row.min_order_amount)) : 0;
  if (minOrder > 0 && params.amount > 0 && params.amount < minOrder) return false;

  const category = String(params.category || '').trim().toLowerCase();
  const style = normalizeStyle(params.serviceStyle);
  const services = params.expandedServiceTokens
    ? Array.from(params.expandedServiceTokens)
    : parsePromotionServicesList(row.applicable_services);
  const rowCategory = String(row.service_category ?? row.target_category ?? '')
    .trim()
    .toLowerCase();
  const rowStyle = normalizeStyle(row.service_style ?? row.target_service_style ?? '');

  if (rowCategory && category && rowCategory !== 'all') {
    if (!promotionCategoriesMatch(category, rowCategory)) {
      const inServices = services.some(
        (s) => !s.startsWith('style:') && promotionCategoriesMatch(category, s)
      );
      if (!inServices) return false;
    }
  }

  if (rowStyle && style && rowStyle !== 'all' && rowStyle !== style) {
    const styleToken = services.find((s) => s.startsWith('style:'));
    if (styleToken) {
      const fromToken = normalizeStyle(styleToken.replace(/^style:/, ''));
      if (fromToken && fromToken !== style) return false;
    } else if (rowStyle !== style) {
      return false;
    }
  }

  if (services.length > 0) {
    const styleTokens = services.filter((s) => s.startsWith('style:'));
    const nonStyle = services.filter((s) => !s.startsWith('style:'));
    if (nonStyle.length > 0 && !promotionServiceTokensMatch(params.serviceIds, nonStyle, category)) {
      return false;
    }
    if (styleTokens.length > 0 && style) {
      const allowed = styleTokens.map((t) => normalizeStyle(t.replace(/^style:/, ''))).filter(Boolean);
      if (allowed.length > 0 && !allowed.includes(style)) return false;
    }
  }

  return true;
}

/** Coded rows in `promotions` are checkout-only — not auto-apply (legacy Plat Coupon pattern). */
export function isAutoApplyPlatformPromotionRow(row: Record<string, unknown>): boolean {
  const type = String(row.promotion_type ?? '').trim().toLowerCase();
  if (type === 'coupon' || type === 'platform_coupon') return false;
  const code = String(row.code ?? '').trim();
  if (code.length > 0) return false;
  return true;
}
