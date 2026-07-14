export interface PromotionFilterInput {
  applicable_services?: unknown;
  service_category?: string;
  serviceCategory?: string;
  target_category?: string;
  targetCategory?: string;
  metadata?: Record<string, unknown>;
  code?: string;
  source?: string;
  promotion_type?: string;
}

/** Coded offers and platform coupons are checkout-only — never discovery/auto-apply. */
export function isPlatformCouponPromotion(promo: PromotionFilterInput): boolean {
  if (String(promo.source ?? '').trim().toLowerCase() === 'platform_coupon') return true;
  const type = String(promo.promotion_type ?? '').trim().toLowerCase();
  if (type === 'coupon' || type === 'platform_coupon') return true;
  const code = String(promo.code ?? '').trim();
  if (code.length > 0) return true;
  return false;
}

export function isDiscoveryAutoApplyPromotion(promo: PromotionFilterInput): boolean {
  return !isPlatformCouponPromotion(promo);
}

const VALID_CUSTOMER_SERVICES = new Set([
  'vet',
  'grooming',
  'training',
  'shop',
  'walker',
  'boarding',
  'adoption',
  'cafes',
  'photography',
  'insurance',
  'breeder',
  'ambulance',
  'nutritionist',
  'relocation',
  'resort',
  'holiday',
  'sunset',
  'sitter',
]);

/** Admin catalogue slugs → customer service buckets (mirrors backend catalog-category-customer-service-map). */
const SLUG_TO_CUSTOMER_SERVICES: Record<string, string[]> = {
  veterinary: ['vet'],
  'vet-care': ['vet'],
  diagnostic: ['vet'],
  pharmacy: ['vet'],
  emergency: ['vet', 'ambulance'],
  wellness: ['vet', 'nutritionist'],
  specialty: ['vet'],
  walking: ['walker'],
  ecommerce: ['shop'],
  'pet-shop': ['shop'],
  store: ['shop'],
  boarding: ['boarding', 'sitter'],
  'pet-boarding': ['boarding'],
  sitter: ['sitter'],
  'pet-sitter': ['sitter'],
  cafe: ['cafes'],
};

function customerServicesForCatalogCategorySlug(slug: string): string[] {
  const s = slug.trim().toLowerCase();
  if (!s) return [];
  if (VALID_CUSTOMER_SERVICES.has(s)) return [s];
  const mapped = SLUG_TO_CUSTOMER_SERVICES[s];
  if (mapped?.length) {
    return [...new Set(mapped.filter((x) => VALID_CUSTOMER_SERVICES.has(x)))];
  }
  return [];
}

export function promotionCategoriesMatch(
  requestCategory: string,
  promoCategoryOrToken: string
): boolean {
  const req = requestCategory.trim().toLowerCase();
  const promo = promoCategoryOrToken.trim().toLowerCase();
  if (!promo || promo === 'all') return true;
  if (!req) return true;
  if (req === promo) return true;

  const fromPromo = customerServicesForCatalogCategorySlug(promo);
  if (fromPromo.includes(req)) return true;

  const fromReq = customerServicesForCatalogCategorySlug(req);
  if (fromReq.includes(promo)) return true;

  return false;
}

function normalizeToken(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, '_');
}

export function parsePromotionApplicableServices(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((x) => normalizeToken(x)).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((x) => normalizeToken(x)).filter(Boolean);
    } catch {
      return [normalizeToken(raw)].filter(Boolean);
    }
  }
  return [];
}

export function shouldIncludePromotionForService(promo: PromotionFilterInput, service: string): boolean {
  const contextService = normalizeToken(service);
  const applicable = parsePromotionApplicableServices(promo.applicable_services);
  const nonStyleTokens = applicable.filter((x) => !x.startsWith('style:'));
  const category = normalizeToken(
    promo.service_category ??
    promo.serviceCategory ??
    promo.target_category ??
    promo.targetCategory ??
    (promo.metadata as any)?.serviceCategory ??
    (promo.metadata as any)?.promotionTarget?.serviceCategory
  );

  if (contextService === 'all') return true;
  if (nonStyleTokens.length === 0 && (!category || category === 'all')) return true;

  if (nonStyleTokens.some((token) => promotionCategoriesMatch(contextService, token))) {
    return true;
  }
  if (category && category !== 'all' && promotionCategoriesMatch(contextService, category)) {
    return true;
  }
  return false;
}
