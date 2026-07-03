/**
 * Admin UI domain separation — Marketing (services) vs E-Commerce (marketplace).
 * Client-side filtering only; same APIs and Discount Engine V2.
 */
import type { PromotionManagementScope, PromotionTargetCatalog } from '@warmpawz/promotion-management-ui';
import type { AnalyticsDomainFilter } from '@/lib/marketing-analytics/types';
import type { CommercialCampaignRecord } from '@/lib/commercial-campaign/types';

export type AdminPromoSurface = 'marketing' | 'ecommerce';

const ECOMMERCE_CATEGORY_HINTS = new Set(['shop', 'ecommerce', 'product', 'retail', 'marketplace']);

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

export function filterPromotionRows<T extends { raw?: Record<string, unknown> }>(
  rows: T[],
  surface: AdminPromoSurface
): T[] {
  return rows.filter((r) => {
    const raw = r.raw ?? {};
    return surface === 'ecommerce' ? isEcommercePromotionRow(raw) : isMarketingPromotionRow(raw);
  });
}

export function filterCouponRows<T extends { raw?: Record<string, unknown> }>(
  rows: T[],
  surface: AdminPromoSurface
): T[] {
  return rows.filter((r) => {
    const raw = r.raw ?? {};
    return surface === 'ecommerce' ? isEcommerceCouponRow(raw) : isMarketingCouponRow(raw);
  });
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
  return campaigns.filter((c) => {
    const metaDomain = String(c.metadata?.domain ?? c.metadata?.surface ?? '').toLowerCase();
    const isEcommerce =
      ECOMMERCE_CAMPAIGN_TYPES.has(c.campaignType) ||
      metaDomain === 'ecommerce' ||
      metaDomain === 'product' ||
      Boolean(c.vendorId && c.metadata?.marketplace);
    return surface === 'ecommerce' ? isEcommerce : !isEcommerce;
  });
}

export const MARKETING_PROMOTION_SCOPE: PromotionManagementScope = {
  mode: 'platform',
  title: 'Service Promotions',
  subtitle: 'Veterinary, grooming, training, boarding, meal plans, packages & service vendors',
  canManageCoupons: true,
  canManagePlatformTargets: true,
  domains: ['service', 'package', 'meal', 'booking'],
  enabledTargetScopes: ['entire_platform', 'vendors', 'categories', 'services', 'packages', 'meal_plans', 'styles'],
};

export const ECOMMERCE_PROMOTION_SCOPE: PromotionManagementScope = {
  mode: 'platform',
  title: 'Seller & Product Promotions',
  subtitle: 'Marketplace sellers, products, categories & collections',
  canManageCoupons: true,
  canManagePlatformTargets: true,
  domains: ['product'],
  enabledTargetScopes: ['entire_platform', 'vendors', 'categories', 'products'],
};

export function scopeForSurface(surface: AdminPromoSurface): PromotionManagementScope {
  return surface === 'ecommerce' ? ECOMMERCE_PROMOTION_SCOPE : MARKETING_PROMOTION_SCOPE;
}

export function catalogForSurface(catalog: PromotionTargetCatalog, surface: AdminPromoSurface): PromotionTargetCatalog {
  if (surface === 'ecommerce') {
    return {
      categories: catalog.categories,
      products: catalog.products,
      vendors: catalog.vendors,
    };
  }
  return {
    categories: catalog.categories,
    services: catalog.services,
    packages: catalog.packages,
    mealPlans: catalog.mealPlans,
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
