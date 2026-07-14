/**
 * E-commerce admin/platform-funded promotions ("Commercial Campaign Engine", ecom scope only).
 *
 * Server-side source of truth for the 'admin' promotion path at order creation.
 * Reads the canonical `ecommerce_admin_promotions` table plus, as a fallback
 * during the migration window, the legacy `promotions` table (product/shop-scoped
 * rows) so promos admins already created keep working. Reuses the exact same
 * discount-evaluation engine as vendor promotions (backend/lambda/src/utils/vendor-promotion-engine.ts)
 * so the math is identical and auditable.
 *
 * IMPORTANT: this module NEVER reads vendor_promotions and the vendor promotion
 * flow NEVER reads this module's tables — a single order can only be discounted
 * by exactly one source (see POST /ecommerce/orders strict promotionSource check).
 *
 * Scope note: this is UNRELATED to the meal-plan/subscription "Discount Engine V2"
 * (table `commercial_discount_campaigns`, branch feature-meal-ui-promotion). That
 * table already exists on shared dev RDS with an incompatible schema — this module
 * deliberately uses a differently-named table (`ecommerce_admin_promotions`) to
 * avoid any collision. Do not merge the two systems.
 */

import { insert, query } from '../database/rds-connection';
import {
  calculateBestCartPromotion,
  normalizePromotionRow,
  parseJsonbStringArray,
  type CartLineItem,
  type PromotionEvaluation,
  type PromotionRow,
} from './vendor-promotion-engine';
import { normalizeListingOwnershipScope } from './compute-listing-ownership';

/** Legacy `promotions` table uses different column names — translate into PromotionRow shape. */
function normalizeLegacyPlatformPromotionRow(row: Record<string, unknown>): PromotionRow {
  const discountTypeRaw = String(row.discount_type || 'percentage').trim().toLowerCase();
  const meta =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const selectedTargets =
    meta.selectedTargets && typeof meta.selectedTargets === 'object'
      ? (meta.selectedTargets as Record<string, unknown>)
      : {};
  const applicableProducts = parseJsonbStringArray(
    row.applicable_products ?? meta.applicableProducts ?? selectedTargets.products,
  );
  const applicableCategories = parseJsonbStringArray(
    row.applicable_categories ?? meta.applicableCategories ?? selectedTargets.categories,
  );

  return {
    id: String(row.id),
    vendor_id: undefined,
    name: String(row.name || row.title || 'Promotion'),
    description: row.description != null ? String(row.description) : undefined,
    code: row.code != null ? String(row.code) : null,
    promotion_type: String(row.promotion_type || 'flash_sale'),
    discount_type: discountTypeRaw === 'fixed' || discountTypeRaw === 'flat' ? 'fixed' : 'percentage',
    discount_value: parseFloat(String(row.discount_value ?? 0)) || 0,
    min_order_value:
      row.min_order_value != null
        ? parseFloat(String(row.min_order_value))
        : row.min_order_amount != null
          ? parseFloat(String(row.min_order_amount))
          : null,
    max_discount_amount:
      row.max_discount_amount != null ? parseFloat(String(row.max_discount_amount)) : null,
    start_date: String(row.start_date),
    end_date: String(row.end_date),
    is_active: row.is_active !== false,
    usage_limit:
      row.usage_limit != null
        ? parseInt(String(row.usage_limit), 10)
        : row.max_uses != null
          ? parseInt(String(row.max_uses), 10)
          : null,
    usage_count:
      row.usage_count != null
        ? parseInt(String(row.usage_count), 10)
        : row.used_count != null
          ? parseInt(String(row.used_count), 10)
          : 0,
    target_audience:
      row.target_audience != null ? String(row.target_audience) : 'all',
    applicable_products: applicableProducts,
    applicable_categories: applicableCategories,
    listing_ownership_scope: normalizeListingOwnershipScope(
      row.listing_ownership_scope ??
        row.listingOwnershipScope ??
        meta.listingOwnershipScope ??
        meta.listing_ownership_scope
    ),
  };
}

async function loadCanonicalCampaigns(): Promise<PromotionRow[]> {
  try {
    const res = await query(
      `SELECT * FROM ecommerce_admin_promotions
       WHERE is_active = true AND published = true
         AND start_date <= NOW() AND end_date >= NOW()
         AND (usage_limit IS NULL OR usage_count < usage_limit)`
    );
    return (res.rows || []).map((row: Record<string, unknown>) => normalizePromotionRow(row));
  } catch {
    return [];
  }
}

async function loadLegacyPlatformPromotions(): Promise<PromotionRow[]> {
  try {
    const now = new Date().toISOString().split('T')[0];
    const res = await query(
      `SELECT * FROM promotions
       WHERE is_active = true
         AND COALESCE(published, true) = true
         AND start_date <= $1
         AND (end_date IS NULL OR end_date >= $1)
         AND (
           COALESCE(discount_domain, '') = 'ECOMMERCE'
           OR COALESCE(metadata->>'discount_domain', '') = 'ECOMMERCE'
           OR COALESCE(metadata->>'domain', '') = 'ecommerce'
           OR COALESCE(applicable_to, '') IN ('products', 'product', 'shop', 'ecommerce')
           OR applicable_services IS NULL
           OR EXISTS (
             SELECT 1 FROM jsonb_array_elements_text(
               CASE WHEN jsonb_typeof(applicable_services) = 'array' THEN applicable_services ELSE '[]'::jsonb END
             ) AS svc(val)
             WHERE svc.val IN ('product', 'shop', 'ecom', 'ecommerce', 'products')
           )
         )`,
      [now]
    );
    return (res.rows || []).map((row: Record<string, unknown>) =>
      normalizeLegacyPlatformPromotionRow(row)
    );
  } catch {
    return [];
  }
}

export type CommercialCampaignRow = PromotionRow & { legacy: boolean };

async function loadAllActiveCampaigns(): Promise<{ promos: PromotionRow[]; legacyIds: Set<string> }> {
  const [canonical, legacy] = await Promise.all([
    loadCanonicalCampaigns(),
    loadLegacyPlatformPromotions(),
  ]);
  const legacyIds = new Set(legacy.map((p) => p.id));
  return { promos: [...canonical, ...legacy], legacyIds };
}

/** Active admin/platform ecommerce campaigns for cart and storefront promo enrichment. */
export async function getActiveCommercialCampaignPromotions(): Promise<{
  promos: PromotionRow[];
  legacyIds: Set<string>;
}> {
  return loadAllActiveCampaigns();
}

export type CommercialCampaignResolution = {
  discountAmount: number;
  promotionId: string | null;
  isLegacy: boolean;
  evaluation: PromotionEvaluation | null;
};

/**
 * Resolve the single best admin/platform campaign discount for a cart.
 * - manualCode set        -> validate that specific code (checkout / coupon field)
 * - promoId set (no code) -> validate that specific campaign id (customer picked it in CartPromotionSelect)
 * - neither set            -> auto-apply the best eligible campaign
 */
export async function resolveCommercialCampaignDiscount(params: {
  promoId?: string | null;
  couponCode?: string | null;
  cartLines: CartLineItem[];
  customerId?: string | null;
}): Promise<CommercialCampaignResolution> {
  const { promos, legacyIds } = await loadAllActiveCampaigns();
  if (promos.length === 0 || params.cartLines.length === 0) {
    return { discountAmount: 0, promotionId: null, isLegacy: false, evaluation: null };
  }

  const ctx = { customerId: params.customerId ?? undefined };

  if (params.couponCode) {
    const result = calculateBestCartPromotion(promos, params.cartLines, {
      ...ctx,
      manualCode: params.couponCode,
    });
    const best = result.bestPromotion;
    return {
      discountAmount: best?.discountAmount ?? 0,
      promotionId: best?.promotionId ?? null,
      isLegacy: best ? legacyIds.has(best.promotionId) : false,
      evaluation: best,
    };
  }

  if (params.promoId) {
    const match = promos.find((p) => p.id === params.promoId);
    if (!match) {
      return { discountAmount: 0, promotionId: null, isLegacy: false, evaluation: null };
    }
    const result = calculateBestCartPromotion([match], params.cartLines, ctx);
    const best = result.bestPromotion;
    return {
      discountAmount: best?.discountAmount ?? 0,
      promotionId: best?.promotionId ?? params.promoId,
      isLegacy: legacyIds.has(match.id),
      evaluation: best,
    };
  }

  const auto = calculateBestCartPromotion(promos, params.cartLines, ctx);
  const best = auto.bestPromotion;
  return {
    discountAmount: best?.discountAmount ?? 0,
    promotionId: best?.promotionId ?? null,
    isLegacy: best ? legacyIds.has(best.promotionId) : false,
    evaluation: best,
  };
}

/** Record usage on the winning campaign after a successful order. Mirrors recordVendorPromotionUsage. */
export async function recordCommercialCampaignUsage(params: {
  promotionId: string;
  isLegacy: boolean;
  orderId: string;
  customerId?: string | null;
  discountAmount: number;
  orderSubtotal: number;
}): Promise<void> {
  const table = params.isLegacy ? 'promotions' : 'ecommerce_admin_promotions';
  await query(
    `UPDATE ${table} SET usage_count = COALESCE(usage_count, 0) + 1, updated_at = NOW() WHERE id = $1::uuid`,
    [params.promotionId]
  ).catch(() => {});

  try {
    await insert('promotion_usages', {
      promotion_id: params.promotionId,
      promotion_type: params.isLegacy ? 'platform' : 'product',
      booking_id: null,
      order_id: params.orderId,
      customer_id: params.customerId || null,
      discount_amount: params.discountAmount,
      original_amount: params.orderSubtotal,
      final_amount: Math.max(0, params.orderSubtotal - params.discountAmount),
      created_at: new Date().toISOString(),
    });
  } catch {
    /* promotion_usages table may be missing in some envs */
  }
}
