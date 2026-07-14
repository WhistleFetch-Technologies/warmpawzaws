/**
 * Admin UI domain separation — Marketing (services) vs E-Commerce (marketplace).
 * Prefer persisted `discount_domain`; heuristics are legacy fallback only.
 */
import type { PromotionManagementScope, PromotionTargetCatalog } from '@warmpawz/promotion-management-ui';
import type { AnalyticsDomainFilter } from '@/lib/marketing-analytics/types';
import type { CommercialCampaignRecord } from '@/lib/commercial-campaign/types';

export type AdminPromoSurface = 'marketing' | 'ecommerce';

export type DiscountDomain = 'SERVICE' | 'ECOMMERCE';

const ECOMMERCE_CATEGORY_HINTS = new Set(['shop', 'ecommerce', 'product', 'retail', 'marketplace']);

export function discountDomainForSurface(surface: AdminPromoSurface): DiscountDomain {
  return surface === 'ecommerce' ? 'ECOMMERCE' : 'SERVICE';
}

function readDiscountDomain(row: Record<string, unknown>): DiscountDomain | null {
  const raw = row.discount_domain ?? row.discountDomain ?? row.domain;
  if (raw == null || raw === '') return null;
  const domain = String(raw).toUpperCase();
  if (domain === 'ECOMMERCE' || domain === 'PRODUCT') return 'ECOMMERCE';
  if (domain === 'SERVICE' || domain === 'SERVICES' || domain === 'BOOKING') return 'SERVICE';
  return null;
}

/** Legacy heuristics — used only when `discount_domain` is absent. */
export function isEcommercePromotionRow(row: Record<string, unknown>): boolean {
  const products = row.applicable_products ?? row.applicableProducts;
  if (Array.isArray(products) && products.length > 0) return true;
  if (row.seller_id || row.sellerId) return true;
  const domain = String(row.domain ?? row.discount_domain ?? '').toUpperCase();
  if (domain === 'PRODUCT' || domain === 'ECOMMERCE') return true;
  const cat = String(row.service_category ?? row.serviceCategory ?? '').toLowerCase();
  if (ECOMMERCE_CATEGORY_HINTS.has(cat)) return true;
  const promoType = String(row.promotion_type ?? row.type ?? '').toLowerCase();
  if (promoType.includes('product') || promoType.includes('seller')) return true;
  return false;
}

export function isMarketingPromotionRow(row: Record<string, unknown>): boolean {
  if (isEcommercePromotionRow(row)) return false;
  return true;
}

export function isEcommerceCouponRow(row: Record<string, unknown>): boolean {
  const scope = String(row.scope ?? row.applicable_scope ?? row.target_scope ?? '').toLowerCase();
  if (scope.includes('product') || scope.includes('shop') || scope.includes('seller')) return true;
  const domain = String(row.domain ?? row.discount_domain ?? '').toUpperCase();
  if (domain === 'PRODUCT' || domain === 'ECOMMERCE') return true;
  const products = row.applicable_products ?? row.applicableProducts;
  if (Array.isArray(products) && products.length > 0) return true;
  if (row.seller_id || row.sellerId) return true;
  return false;
}

export function isMarketingCouponRow(row: Record<string, unknown>): boolean {
  if (isEcommerceCouponRow(row)) return false;
  return true;
}

function rowMatchesSurface(
  row: Record<string, unknown>,
  surface: AdminPromoSurface,
  legacyIsEcommerce: (r: Record<string, unknown>) => boolean
): boolean {
  const expected = discountDomainForSurface(surface);
  const persisted = readDiscountDomain(row);
  if (persisted) return persisted === expected;
  const inferredEcommerce = legacyIsEcommerce(row);
  return surface === 'ecommerce' ? inferredEcommerce : !inferredEcommerce;
}

export function filterPromotionRows<T extends { raw?: Record<string, unknown> }>(
  rows: T[],
  surface: AdminPromoSurface
): T[] {
  return rows.filter((r) => rowMatchesSurface(r.raw ?? {}, surface, isEcommercePromotionRow));
}

export function filterCouponRows<T extends { raw?: Record<string, unknown> }>(
  rows: T[],
  surface: AdminPromoSurface
): T[] {
  return rows.filter((r) => rowMatchesSurface(r.raw ?? {}, surface, isEcommerceCouponRow));
}

const ECOMMERCE_CAMPAIGN_TYPES = new Set([
  'vendor_sponsored',
  'marketplace',
  'product_launch',
  'seller_promo',
  'black_friday',
]);

export function filterCampaigns(
  campaigns: CommercialCampaignRecord[],
  surface: AdminPromoSurface
): CommercialCampaignRecord[] {
  const expected = discountDomainForSurface(surface);
  return campaigns.filter((c) => {
    const row = c as CommercialCampaignRecord & { discount_domain?: string };
    const persisted = readDiscountDomain({
      discountDomain: c.discountDomain,
      discount_domain: row.discount_domain,
      domain: c.metadata?.domain,
    });
    if (persisted) return persisted === expected;
    if (c.surface === 'ecommerce' || c.surface === 'marketing') {
      return c.surface === surface;
    }

    const metaDomain = String(c.metadata?.domain ?? c.metadata?.surface ?? '').toLowerCase();
    if (metaDomain === 'ecommerce' || metaDomain === 'product') {
      return surface === 'ecommerce';
    }
    if (metaDomain === 'service' || metaDomain === 'marketing' || metaDomain === 'services') {
      return surface === 'marketing';
    }
    const isEcommerce =
      ECOMMERCE_CAMPAIGN_TYPES.has(c.campaignType) ||
      Boolean(c.vendorId && c.metadata?.marketplace);
    return surface === 'ecommerce' ? isEcommerce : !isEcommerce;
  });
}

export const MARKETING_PROMOTION_SCOPE: PromotionManagementScope = {
  mode: 'platform',
  title: 'Platform Promotions & Coupons',
  subtitle: 'Veterinary, grooming, training, boarding, meal plans, packages & service vendors',
  canManageCoupons: true,
  canManagePlatformTargets: true,
  domains: ['service', 'package', 'meal', 'booking'],
  smartTargetSurface: 'marketing',
};

export const ECOMMERCE_PROMOTION_SCOPE: PromotionManagementScope = {
  mode: 'platform',
  title: 'Promotions & Coupons',
  subtitle: 'Marketplace sellers, products, categories & cart coupons',
  canManageCoupons: true,
  canManagePlatformTargets: true,
  domains: ['product'],
  smartTargetSurface: 'ecommerce',
};

export function scopeForSurface(surface: AdminPromoSurface): PromotionManagementScope {
  return surface === 'ecommerce' ? ECOMMERCE_PROMOTION_SCOPE : MARKETING_PROMOTION_SCOPE;
}

export function catalogForSurface(catalog: PromotionTargetCatalog, surface: AdminPromoSurface): PromotionTargetCatalog {
  if (surface === 'ecommerce') {
    return {
      categories: catalog.categories,
      vendors: catalog.vendors,
    };
  }
  return {
    categories: catalog.categories,
    styles: catalog.styles,
    vendors: catalog.vendors,
  };
}

export function defaultAnalyticsDomain(surface: AdminPromoSurface): AnalyticsDomainFilter {
  return surface === 'ecommerce' ? 'PRODUCT' : 'SERVICE';
}

export function analyticsDomainOptions(surface: AdminPromoSurface): AnalyticsDomainFilter[] {
  if (surface === 'ecommerce') {
    return ['PRODUCT'];
  }
  return ['SERVICE', 'PACKAGE', 'MEAL', 'PHARMACY'];
}

export const MARKETING_CAMPAIGN_TITLE = 'Service Campaigns';
export const ECOMMERCE_CAMPAIGN_TITLE = 'Marketplace Campaigns';

export const MARKETING_ANALYTICS_TITLE = 'Marketing Analytics';
export const ECOMMERCE_ANALYTICS_TITLE = 'E-Commerce Promotion Analytics';
