/**
 * ============================================================================
 * E-COMMERCE ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles e-commerce features:
 * - Product catalog
 * - Shopping cart
 * - Order management
 * - Wishlist
 * 
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { randomUUID } from 'crypto';
import { select, insert, update, query, upsert } from '../../../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import {
  getTemporaryVendorSuppressionParams,
  sqlExcludeSuppressedSettlementRows,
} from '../../../utils/temporary-vendor-ui-suppression';
import { isValidUUID } from '../../../types/entities';
import { prepareStorefrontProductRow, prepareStorefrontProductRows, prepareStorefrontProductRowsForList, presignProductSkusForDisplay, presignProductImagesJsonb } from '../../../utils/s3-media-presign';
import { loadProductSkus, loadProductSkusForProducts } from '../../../utils/product-sku-service';
import {
  resolveEcommerceOrderLine,
  decrementSkuStock,
} from '../../../utils/product-sku-order';
import { assertProductDeliverableToCity } from '../../../utils/product-delivery-regions';
import {
  getProductsColumnSet,
  resolveStorefrontProductOrderBy,
  resolveStorefrontSafeOrderBy,
} from '../../../utils/products-table-columns';
import {
  buildVariationAxes,
  mapSkusToCustomerVariations,
  buildGalleryImageUnion,
  normalizeImagesArray,
  mergeLegacyVariantImagesIntoSkus,
  applyStorefrontSkuPricingFields,
} from '../../../utils/product-sku-resolve';
import { computeEcommerceDeliveryFee } from '../../../utils/ecommerce/delivery-fee';
import {
  calculateBestCartPromotion,
  calculateBestCartPromotionAsync,
  discountsWithinTolerance,
  normalizePromotionRow,
  type CartLineItem,
} from '../../../utils/vendor-promotion-engine';
import {
  countPriorVendorOrders,
  recordEcommercePlatformCouponUsage,
  recordVendorPromotionUsage,
} from '../../../utils/vendor-promotion-usage';
import {
  resolveCommercialCampaignDiscount,
  recordCommercialCampaignUsage,
} from '../../../utils/resolve-commercial-campaign';
import { selectEcommercePromotionWinnerAsync } from '../../../utils/ecommerce-promo-policy-winner';
import { buildEcommerceProductTaxItems } from '../../../utils/resolve-ecommerce-product-tax-item';
import { checkIdempotencyKey, storeIdempotencyKey } from '../../../utils/idempotency';
import {
  isEcommerceCategoryUuid,
  mapCategoryRowsForPublic,
  parseAdminCategoryPayloadItem,
} from '../../../utils/ecommerce-category-display';
import {
  buildCommissionSettingsResponse,
  normalizeCommissionRate,
  normalizeSellerRatesForResponse,
  parseSellerRateOverride,
} from '../../../utils/ecommerce-commission-settings';
import {
  getVendorCommissionConfigResponse,
  upsertVendorCommissionConfig,
  countProductsWithoutListingOwnership,
} from '../../../utils/ecommerce-commission-admin';
import {
  buildAdminEcommerceOrderCountSql,
  buildAdminEcommerceOrderListSql,
  buildAdminEcommerceOrderStatusCountsSql,
  buildAdminEcommerceOrderStatusCountsSqlForDays,
  enrichAdminEcommerceOrderDetail,
  normalizeAdminOrderStatusCounts,
  SQL_ADMIN_SHOP_ORDER_TYPE,
} from '../../../utils/admin-ecommerce-orders-sql';
import {
  buildDailyRevenueSql,
  buildEcommerceSellerStatsSql,
  buildPeriodStartDates,
  buildPeriodTotalsSql,
  buildPlatformPeriodGrowthSql,
  buildProductStatsSql,
  buildSellersWithOrdersSql,
  buildTopProductsSql,
  buildTopSellersSql,
  calcPeriodGrowthPercent,
  clampAnalyticsDays,
  stripAllStatusKey,
} from '../../../utils/admin-ecommerce-analytics-sql';
import {
  resolveOrderCommission,
  buildCommissionSnapshot,
  persistOrderItemCommission,
  loadOrderItemIds,
  forceApplyOrderCommissionAudit,
} from '../../../utils/resolve-ecommerce-commission-rate';
import { paymentHoldExpiresAt, expireShopPaymentHolds } from '../../../utils/shop-payment-hold';
import { reconcilePendingShopPayments } from '../../../utils/payments/shop-payment-reconciliation';
import { assertShopCheckoutPaymentAllowed } from '../../../utils/shop-checkout-payment-flags';
import { notifyShopOrderPaid } from '../../../utils/shop-order-notifications';
import {
  writeEcommerceOrderSettlementLedgerRow,
  syncEcommerceOrderSettlementLedgerRow,
} from '../../../utils/write-ecommerce-order-settlement';
import {
  productIdIsExcludedFromEcommerceStorefront,
  storefrontExcludeMealProductsSql,
} from '../../../utils/ecommerce-storefront-product-filter';
import { enrichStorefrontProductsWithPromoPricing } from '../../../utils/storefront-product-promo-pricing';
import { buildStorefrontCategoryFilter } from '../../../utils/storefront-category-filter';
import {
  storefrontProductWhereSql,
  storefrontProductBaseWhereSql,
  STOREFRONT_ACTIVE_CATEGORY_SQL,
  STOREFRONT_ACTIVE_STATUS_SQL,
} from '../../../utils/storefront-product-where';
import {
  sliceStorefrontListPage,
  storefrontListFetchLimit,
} from '../../../utils/storefront-products-pagination';
import {
  isStorefrontCardView,
  STOREFRONT_PLP_CARD_SELECT,
  STOREFRONT_PLP_FULL_SELECT,
} from '../../../utils/storefront-plp-select';

const ADMIN_CATEGORY_SELECT = `
  SELECT id::text AS id, name, description, display_order, is_active, image_url,
         default_commission_rate, parent_category_id::text AS parent_category_id, created_at
  FROM ecommerce_categories
  ORDER BY display_order ASC, name ASC`;

const ADMIN_CATEGORY_SELECT_NO_IMAGE = `
  SELECT id::text AS id, name, description, display_order, is_active, created_at,
         default_commission_rate, parent_category_id::text AS parent_category_id
  FROM ecommerce_categories
  ORDER BY display_order ASC, name ASC`;

const ADMIN_CATEGORY_SELECT_LEGACY = `
  SELECT id::text AS id, name, description, display_order, is_active, image_url, created_at,
         parent_category_id::text AS parent_category_id
  FROM ecommerce_categories
  ORDER BY display_order ASC, name ASC`;

const ADMIN_CATEGORY_SELECT_NO_PARENT = `
  SELECT id::text AS id, name, description, display_order, is_active, image_url,
         default_commission_rate, created_at
  FROM ecommerce_categories
  ORDER BY display_order ASC, name ASC`;

async function queryAdminCategories() {
  try {
    return await query(ADMIN_CATEGORY_SELECT);
  } catch (dbError: any) {
    if (dbError.message?.includes('parent_category_id') || dbError.code === '42703') {
      try {
        return await query(ADMIN_CATEGORY_SELECT_NO_PARENT);
      } catch (parentFallbackErr: any) {
        if (
          parentFallbackErr.message?.includes('default_commission_rate') ||
          parentFallbackErr.code === '42703'
        ) {
          return await query(
            `SELECT id::text AS id, name, description, display_order, is_active, created_at
             FROM ecommerce_categories
             ORDER BY display_order ASC, name ASC`
          );
        }
        throw parentFallbackErr;
      }
    }
    if (dbError.message?.includes('default_commission_rate') || dbError.code === '42703') {
      try {
        return await query(ADMIN_CATEGORY_SELECT_NO_IMAGE);
      } catch (inner: any) {
        if (inner.message?.includes('column "image_url"') || inner.code === '42703') {
          return await query(
            `SELECT id::text AS id, name, description, display_order, is_active, created_at,
                    parent_category_id::text AS parent_category_id
             FROM ecommerce_categories
             ORDER BY display_order ASC, name ASC`
          );
        }
        throw inner;
      }
    }
    if (dbError.message?.includes('column "image_url"') || dbError.code === '42703') {
      return await query(ADMIN_CATEGORY_SELECT_LEGACY);
    }
    throw dbError;
  }
}

function normalizeAdminProductLifecycleStatus(raw: unknown): { status: string; is_active: boolean } {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'approved' || s === 'approve') {
    return { status: 'active', is_active: true };
  }
  if (s === 'rejected' || s === 'reject') {
    return { status: 'rejected', is_active: false };
  }
  if (s === 'active') {
    return { status: 'active', is_active: true };
  }
  if (s === 'pending' || s === 'pending_approval' || s === 'draft') {
    return { status: s === 'draft' ? 'draft' : 'pending', is_active: false };
  }
  const legacy = String(raw ?? '').trim();
  return { status: legacy || 'pending', is_active: s === 'active' };
}

function normalizeTaxBreakdownForDb(raw: unknown): Record<string, unknown>[] | null {
  if (raw == null) return null;
  let data: unknown = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (Array.isArray(data)) {
    const items: Record<string, unknown>[] = [];
    for (const entry of data) {
      if (entry == null) continue;
      if (typeof entry === 'string') {
        try {
          const parsed = JSON.parse(entry);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            items.push(parsed as Record<string, unknown>);
          }
        } catch {
          // skip invalid entry
        }
      } else if (typeof entry === 'object' && !Array.isArray(entry)) {
        items.push(entry as Record<string, unknown>);
      }
    }
    return items.length > 0 ? items : null;
  }
  if (typeof data === 'object' && !Array.isArray(data)) {
    return [data as Record<string, unknown>];
  }
  return null;
}

/** Optional customer scope for storefront promo enrichment (query param). */
function resolveOptionalStorefrontCustomerId(c: { req: { query: (key: string) => string | undefined } }): string | null {
  const raw = c.req.query('customerId') ?? c.req.query('customer_id');
  if (!raw || !isValidUUID(String(raw).trim())) return null;
  return String(raw).trim();
}

/** Presign product rows and apply SKU listing pricing for variant products (single batch query). */
async function enrichStorefrontProductListRows(
  rows: Record<string, unknown>[],
  customerId?: string | null,
  cardView = false,
): Promise<Record<string, unknown>[]> {
  const signed = cardView
    ? await prepareStorefrontProductRowsForList(rows)
    : await prepareStorefrontProductRows(rows);
  const ids = signed.map((r) => String(r.id ?? '')).filter(Boolean);
  const skuMap = await loadProductSkusForProducts(ids);
  const withSkuPricing = signed.map((row) => {
    const pid = String(row.id ?? '');
    const skus = skuMap.get(pid) ?? [];
    if (skus.length === 0) return row;
    return applyStorefrontSkuPricingFields(row, skus);
  });
  return enrichStorefrontProductsWithPromoPricing(withSkuPricing, customerId);
}

export function registerEcommerceEndpoints(app: Hono) {
  /** Shared handler body for GET /products/:id and GET /ecommerce/products/:id */
  const handleGetPublicProductById = async (c: any, logLabel: string) => {
    try {
      const { productId } = c.req.param();
      if (!isValidUUID(String(productId))) {
        return c.json({ error: 'Product not found' }, 404);
      }
      console.log(`${logLabel} lookup product id=`, productId);

      const productWhere = await storefrontProductWhereSql();
      const products = await query(
        `SELECT p.*,
                v.business_name as vendor_name,
                v.city as vendor_city,
                v.state as vendor_state,
                v.pincode as vendor_pincode,
                v.shipping_origin_pincode as vendor_shipping_origin_pincode
         FROM products p
         LEFT JOIN vendors v ON p.vendor_id = v.id
         WHERE p.id = $1 AND ${productWhere}${STOREFRONT_ACTIVE_CATEGORY_SQL}`,
        [productId]
      );

      if (products.rows.length === 0) {
        return c.json({ error: 'Product not found' }, 404);
      }

      const row = products.rows[0] as Record<string, unknown>;
      const product = await prepareStorefrontProductRow(row, 'detail');

      let skusRaw = await loadProductSkus(productId);
      const meta =
        row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null;
      const legacyVariants =
        meta && Array.isArray(meta.variants) ? (meta.variants as unknown[]) : null;
      if (skusRaw.length > 0 && legacyVariants) {
        skusRaw = mergeLegacyVariantImagesIntoSkus(skusRaw, legacyVariants);
      }

      const skusPresigned = await presignProductSkusForDisplay(
        skusRaw.map((s) => ({
          ...s,
          images: normalizeImagesArray(s.images),
        })) as Record<string, unknown>[],
        'detail',
      );
      const variation_axes = buildVariationAxes(skusRaw);
      const variations = mapSkusToCustomerVariations(skusRaw, variation_axes);
      const parentImages = normalizeImagesArray(product.images);
      const galleryImages = buildGalleryImageUnion(parentImages, skusRaw);
      const galleryPresigned = normalizeImagesArray(
        await presignProductImagesJsonb(galleryImages.length > 0 ? galleryImages : parentImages),
      );

      product.images = galleryPresigned;
      if (skusRaw.length > 0) {
        Object.assign(product, applyStorefrontSkuPricingFields(product, skusRaw));
        product.variations = variations;
      } else {
        product.has_variants = false;
      }

      const customerId = resolveOptionalStorefrontCustomerId(c);
      const [enrichedProduct] = await enrichStorefrontProductsWithPromoPricing(
        [product as Record<string, unknown>],
        customerId,
      );
      const productOut = enrichedProduct ?? product;

      return c.json({
        success: true,
        product: productOut,
        skus: skusPresigned,
        variation_axes,
      });
    } catch (error: any) {
      console.error(`${logLabel} Error fetching product:`, error);
      return c.json({ error: error.message }, 500);
    }
  };

  // ============================================
  // PRODUCT CATALOG
  // ============================================

  /**
   * GET /products
   * Get products with filters
   */
  app.get("/products", async (c) => {
    try {
      const vendorId = c.req.query('vendorId');
      const category = c.req.query('category');
      const search = c.req.query('search');
      const featuredOnly =
        c.req.query('featured') === 'true' || c.req.query('featured') === '1';
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      const productWhere = await storefrontProductWhereSql();
      let productQuery = `
        SELECT p.*, v.business_name as vendor_name,
                v.state as vendor_state,
                v.pincode as vendor_pincode,
                v.shipping_origin_pincode as vendor_shipping_origin_pincode
        FROM products p
        LEFT JOIN vendors v ON p.vendor_id = v.id
        WHERE ${productWhere}${STOREFRONT_ACTIVE_CATEGORY_SQL}
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (featuredOnly) {
        productQuery += ` AND COALESCE(p.is_featured, false) = true`;
      }

      if (vendorId) {
        // Handle test IDs - return empty products
        if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
          return c.json({
            success: true,
            products: [],
            total: 0,
          });
        }
        productQuery += ` AND p.vendor_id = $${paramIndex}`;
        params.push(vendorId);
        paramIndex++;
      }

      if (category) {
        if (isValidUUID(category)) {
          productQuery += ` AND p.category_id = $${paramIndex}::uuid`;
        } else {
          productQuery += ` AND p.category = $${paramIndex}`;
        }
        params.push(category);
        paramIndex++;
      }

      if (search) {
        productQuery += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      productQuery += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      let products;
      try {
        products = await query(productQuery, params);
      } catch (error: any) {
        // Handle table not existing, column not existing, or invalid UUID
        if (error.message?.includes('invalid input syntax for type uuid') ||
          error.message?.includes('relation "products" does not exist') ||
          error.message?.includes('column') ||
          error.code === '42P01' || // undefined_table
          error.code === '42703') { // undefined_column
          return c.json({
            success: true,
            products: [],
            total: 0,
            message: 'No products available yet'
          });
        }
        throw error;
      }

      const rows = (products?.rows || []) as Record<string, unknown>[];
      const customerId = resolveOptionalStorefrontCustomerId(c);
      const signedProducts = await enrichStorefrontProductListRows(rows, customerId);

      return c.json({
        success: true,
        products: signedProducts,
        total: signedProducts.length,
      });
    } catch (error: any) {
      console.error('[products] Error fetching products:', error);
      return c.json({ success: true, products: [], total: 0 }, 200);
    }
  });

  /**
   * GET /ecommerce/products
   * Public endpoint for customer shop — supports pagination, server-side sort,
   * server-side search, and price filtering.
   *
   * Query params:
   *   limit      — page size (default SHOP_DEFAULT_LIMIT, max SHOP_MAX_LIMIT)
   *   offset     — row offset for pagination (default 0)
   *   sort       — one of: popular | price_low | price_high | newest | rating
   *   search     — ILIKE substring filter on name and description
   *   category   — UUID or name filter
   *   min_price  — inclusive lower price bound
   *   max_price  — inclusive upper price bound
   *   featured   — true/1 to show only featured products
   *   vendorId   — optional vendor scope
   *   view       — card | plp for lean PLP payload (default: full row)
   *   include_total — true/1 to run COUNT(*) (default: skip; uses LIMIT+1 hasMore)
   *
   * Response: { success, products, total?, offset, limit, hasMore }
   */
  /** Shared list handler — also registered under /public/ecommerce/products for guest browse. */
  const handleListEcommerceProducts = async (c: any) => {
    /** Default and max page sizes — keep in sync with SHOP_PAGE_SIZE on the frontend. */
    const SHOP_DEFAULT_LIMIT = 10;
    const SHOP_MAX_LIMIT = 50;

    try {
      const vendorId = c.req.query('vendorId');
      const category = c.req.query('category');
      const search = c.req.query('search');
      const featuredOnly =
        c.req.query('featured') === 'true' || c.req.query('featured') === '1';
      const includeTotal =
        c.req.query('include_total') === 'true' || c.req.query('include_total') === '1';
      const cardView = isStorefrontCardView(c.req.query('view'));

      const rawLimit = parseInt(c.req.query('limit') || String(SHOP_DEFAULT_LIMIT), 10);
      const limit = Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(rawLimit, SHOP_MAX_LIMIT)
        : SHOP_DEFAULT_LIMIT;
      const rawOffset = parseInt(c.req.query('offset') || '0', 10);
      const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

      const sortParam = c.req.query('sort') ?? 'popular';
      const productCols = await getProductsColumnSet();
      let orderBy = resolveStorefrontProductOrderBy(sortParam, productCols);

      const minPriceRaw = parseFloat(c.req.query('min_price') ?? '');
      const maxPriceRaw = parseFloat(c.req.query('max_price') ?? '');

      const baseWhere = await storefrontProductBaseWhereSql();
      let whereClause = baseWhere;
      const filterParams: any[] = [];
      let paramIndex = 1;

      if (featuredOnly) {
        whereClause += ` AND COALESCE(p.is_featured, false) = true`;
      }

      if (vendorId) {
        whereClause += ` AND p.vendor_id = $${paramIndex}`;
        filterParams.push(vendorId);
        paramIndex++;
      }

      if (category) {
        const categoryFilter = await buildStorefrontCategoryFilter(category, paramIndex);
        if (categoryFilter) {
          whereClause += categoryFilter.clause;
          filterParams.push(...categoryFilter.params);
          paramIndex = categoryFilter.nextParamIndex;
        }
      }

      if (search) {
        whereClause += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
        filterParams.push(`%${search}%`);
        paramIndex++;
      }

      if (Number.isFinite(minPriceRaw) && minPriceRaw > 0) {
        whereClause += ` AND p.price >= $${paramIndex}`;
        filterParams.push(minPriceRaw);
        paramIndex++;
      }

      if (Number.isFinite(maxPriceRaw) && maxPriceRaw < 999999) {
        whereClause += ` AND p.price <= $${paramIndex}`;
        filterParams.push(maxPriceRaw);
        paramIndex++;
      }

      const selectClause = cardView ? STOREFRONT_PLP_CARD_SELECT : STOREFRONT_PLP_FULL_SELECT;
      const fromJoin = cardView
        ? 'FROM products p'
        : 'FROM products p LEFT JOIN vendors v ON p.vendor_id = v.id';

      const fetchLimit = storefrontListFetchLimit(limit);

      const runListQuery = async (orderByClause: string) => {
        const listQuery = `
        SELECT ${selectClause}
        ${fromJoin}
        WHERE ${whereClause}
        ORDER BY ${orderByClause}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
        const paginatedParams = [...filterParams, fetchLimit, offset];
        return query(listQuery, paginatedParams);
      };

      const runCountQuery = async () => {
        const countQuery = `
        SELECT COUNT(*) AS count
        FROM products p
        LEFT JOIN vendors v ON p.vendor_id = v.id
        WHERE ${whereClause}
      `;
        const countResult = await query(countQuery, filterParams);
        return parseInt(
          (countResult?.rows?.[0] as Record<string, string>)?.count ?? '0',
          10,
        );
      };

      let products;
      let totalCount: number | null = null;
      try {
        products = await runListQuery(orderBy);
        if (includeTotal) {
          totalCount = await runCountQuery();
        }
      } catch (error: any) {
        const isMissingColumn =
          error.code === '42703' || String(error.message ?? '').includes('column');
        const isMissingTable =
          error.code === '42P01' ||
          String(error.message ?? '').includes('relation "products" does not exist');
        const isInvalidUuid = String(error.message ?? '').includes(
          'invalid input syntax for type uuid',
        );

        if (isMissingTable || isInvalidUuid) {
          return c.json({
            success: true,
            products: [],
            total: includeTotal ? 0 : null,
            offset,
            limit,
            hasMore: false,
            message: 'No products available yet',
          });
        }

        if (isMissingColumn) {
          const safeOrderBy = resolveStorefrontSafeOrderBy(productCols);
          if (safeOrderBy !== orderBy) {
            console.warn(
              '[ecommerce/products] ORDER BY failed, retrying with safe fallback',
              { sortParam, orderBy, safeOrderBy, error: error.message },
            );
            orderBy = safeOrderBy;
            products = await runListQuery(orderBy);
            if (includeTotal) {
              totalCount = await runCountQuery();
            }
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }

      const rawRows = (products?.rows || []) as Record<string, unknown>[];
      const { items: pageRows, hasMore } = sliceStorefrontListPage(rawRows, limit);
      const customerId = resolveOptionalStorefrontCustomerId(c);
      const signedProducts = await enrichStorefrontProductListRows(pageRows, customerId, cardView);

      const response: Record<string, unknown> = {
        success: true,
        products: signedProducts,
        offset,
        limit,
        hasMore,
      };
      if (includeTotal && totalCount != null) {
        response.total = totalCount;
      }

      return c.json(response);
    } catch (error: any) {
      console.error('Error fetching ecommerce products:', error);
      return c.json({ error: error.message }, 500);
    }
  };

  app.get("/ecommerce/products", handleListEcommerceProducts);
  /** Guest-safe public-read alias (auth middleware allows /^\/public\//). */
  app.get("/public/ecommerce/products", handleListEcommerceProducts);

  /**
   * GET /ecommerce/products/:productId
   * Same as GET /products/:productId — customer shop and wishlist use this path.
   */
  app.get("/ecommerce/products/:productId", (c) =>
    handleGetPublicProductById(c, '[ecommerce/products/:productId]')
  );
  app.get("/public/ecommerce/products/:productId", (c) =>
    handleGetPublicProductById(c, '[public/ecommerce/products/:productId]')
  );

  /**
   * POST /ecommerce/orders
   * Create order from customer shop (handles both naming conventions)
   */
  app.post("/ecommerce/orders", async (c) => {
    try {
      const orderData = await c.req.json();

      // Handle both naming conventions from frontend
      const customerPhone = orderData.customer_phone || orderData.customerPhone;
      const items = orderData.items || [];
      const shippingAddress = orderData.shipping_address || orderData.shippingAddress || {};
      // Shop checkout is online/Razorpay; do not default to COD (unpaid COD would skip hold).
      const paymentMethod = orderData.payment_method || orderData.paymentMethod || 'online';
      const couponCode = orderData.coupon_code || orderData.couponCode;
      const walletAmountApplied = Math.max(0, parseFloat(String(orderData.walletAmountApplied || orderData.wallet_amount_applied || '0')) || 0);

      const shopPaymentGuard = assertShopCheckoutPaymentAllowed({
        paymentMethod,
        walletAmountApplied,
      });
      if (!shopPaymentGuard.ok) {
        return c.json({ error: shopPaymentGuard.error }, shopPaymentGuard.status as ContentfulStatusCode);
      }

      if (!customerPhone || !items || items.length === 0) {
        return c.json({ error: 'customer_phone and items are required' }, 400);
      }

      // Idempotency: client must supply a UUID per checkout attempt (prevents double-tap duplicate orders).
      // If the same key is replayed within 30 min the first order response is returned unchanged.
      const idempotencyKey = String(orderData.idempotencyKey || orderData.idempotency_key || '').trim();
      if (idempotencyKey) {
        const existing = await checkIdempotencyKey(`ecommerce_order:${idempotencyKey}`);
        if (existing.exists) {
          const cached = typeof existing.response === 'string' ? JSON.parse(existing.response) : existing.response;
          return c.json(cached, (existing.httpStatus ?? 201) as ContentfulStatusCode);
        }
      }

      // Get or create customer by phone
      let customerId = null;
      try {
        const customers = await query(
          'SELECT id FROM customers WHERE phone = $1',
          [customerPhone]
        );
        if (customers.rows.length > 0) {
          customerId = customers.rows[0].id;
        } else {
          // Create a new customer
          const newCustomerId = randomUUID();
          const customerName = shippingAddress.name || `Customer ${customerPhone.slice(-4)}`;
          await insert('customers', {
            id: newCustomerId,
            name: customerName,
            full_name: customerName,
            phone: customerPhone,
            is_active: true,
            status: 'new',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          customerId = newCustomerId;
          console.log('Created new customer:', customerId);
        }
      } catch (e: any) {
        // Customer table might not exist or insert failed
        console.log('Could not find/create customer by phone:', e.message);
        // Try to create minimal customer record
        try {
          const newCustomerId = randomUUID();
          await insert('customers', {
            id: newCustomerId,
            name: shippingAddress.name || `Customer ${customerPhone.slice(-4)}`,
            full_name: shippingAddress.name || `Customer ${customerPhone.slice(-4)}`,
            phone: customerPhone,
            is_active: true,
            status: 'new',
          });
          customerId = newCustomerId;
        } catch (e2: any) {
          console.log('Failed to create customer:', e2.message);
        }
      }

      const bodyCustomerId = String(orderData.customerId || orderData.customer_id || '').trim();
      if (!customerId && bodyCustomerId) {
        customerId = bodyCustomerId;
      }

      if (!customerId) {
        return c.json({ error: 'Could not resolve customer for this order' }, 400);
      }

      // Calculate totals
      let subtotal = 0;
      const orderItems = [];
      let firstVendorId = null;

      const customerCity = String(
        shippingAddress.city ?? shippingAddress.City ?? '',
      ).trim();

      for (const item of items) {
        try {
          const resolved = await resolveEcommerceOrderLine(item as Record<string, unknown>);
          if (!resolved) continue;
          if (await productIdIsExcludedFromEcommerceStorefront(resolved.product_id)) {
            return c.json({ error: 'Product is not available in the shop' }, 400);
          }
          await assertProductDeliverableToCity(
            resolved.product_id,
            resolved.product_name,
            customerCity,
          );
          subtotal += resolved.total;
          if (!firstVendorId && resolved.vendor_id) {
            firstVendorId = resolved.vendor_id;
          }
          orderItems.push({
            product_id: resolved.product_id,
            product_sku_id: resolved.product_sku_id,
            product_name: resolved.product_name,
            quantity: resolved.quantity,
            unit_price: resolved.unit_price,
            total: resolved.total,
            variant_info: resolved.variant_info,
            skuRowIdForStock: resolved.skuRowIdForStock,
            hsn_code: resolved.hsn_code,
            category_id: resolved.category_id,
          });
        } catch (lineErr: unknown) {
          const msg = lineErr instanceof Error ? lineErr.message : String(lineErr);
          return c.json({ error: msg }, 400);
        }
      }

      if (orderItems.length === 0) {
        return c.json({ error: 'No valid products found for this order' }, 400);
      }

      // Create order
      const orderId = randomUUID();
      const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      let priorOrderCount = 0;
      let containsPetFood = false;
      if (customerId) {
        try {
          const cnt = await query(
            `SELECT COUNT(*)::int AS c FROM orders WHERE customer_id = $1::uuid AND COALESCE(order_status, '') NOT IN ('cancelled', 'failed')`,
            [customerId]
          );
          priorOrderCount = cnt.rows[0]?.c ?? 0;
        } catch {
          priorOrderCount = 0;
        }
      }
      for (const item of orderItems) {
        const n = String(item.product_name || '').toLowerCase();
        if (
          n.includes('food') ||
          n.includes('treat') ||
          n.includes('kibble') ||
          n.includes('nutrition')
        ) {
          containsPetFood = true;
          break;
        }
      }

      const bodyShipping =
        orderData.shippingFee ?? orderData.shipping_fee ?? orderData.shipping_amount;
      const bodyTax = orderData.taxAmount ?? orderData.tax_amount;
      const bodyDiscount = orderData.discountAmount ?? orderData.discount_amount ?? 0;
      const bodyTotal = orderData.totalAmount ?? orderData.total_amount;
      const taxBreakdown = orderData.taxBreakdown ?? orderData.tax_breakdown ?? null;
      const bodyCgst = orderData.cgstAmount ?? orderData.cgst_amount;
      const bodySgst = orderData.sgstAmount ?? orderData.sgst_amount;
      const bodyIgst = orderData.igstAmount ?? orderData.igst_amount;
      const promoId = orderData.promotionId ?? orderData.promotion_id ?? null;
      // Fix D (Commercial Campaign Engine): the customer picks exactly ONE promotion in
      // CartPromotionSelect, tagged with its source table. We validate ONLY that table
      // server-side and never sum a vendor discount with an admin discount.
      const requestedPromotionSource: 'vendor' | 'admin' | null = (() => {
        const raw = String(orderData.promotionSource ?? orderData.promotion_source ?? '')
          .trim()
          .toLowerCase();
        return raw === 'admin' || raw === 'vendor' ? raw : null;
      })();

      const { resolveOrderPromoLineCategory } = await import(
        '../../../utils/fill-product-category-if-missing'
      );
      const rawCartLines: CartLineItem[] = orderItems.map((oi) => {
        const raw = items.find(
          (it: Record<string, unknown>) =>
            String(it.productId || it.product_id || '') === String(oi.product_id)
        );
        const ownershipRaw = raw?.listingOwnership ?? raw?.listing_ownership;
        const categoryId = resolveOrderPromoLineCategory(
          raw?.categoryId || raw?.category,
          oi.category_id
        );
        return {
          productId: String(oi.product_id),
          quantity: oi.quantity,
          price: oi.unit_price,
          category: categoryId,
          categoryId,
          listingOwnership:
            ownershipRaw === 'own_brand' || ownershipRaw === 'third_party'
              ? String(ownershipRaw)
              : undefined,
        };
      });
      const { enrichLinesWithListingOwnership } = await import(
        '../../../utils/compute-listing-ownership'
      );
      const cartLines = await enrichLinesWithListingOwnership(rawCartLines);

      let serverPromoDiscount = 0;
      let appliedPromotionId: string | null = promoId ? String(promoId) : null;
      let promotionSource: 'vendor' | 'admin' | null = null;
      let campaignIsLegacy = false;

      const wantsPromotion =
        cartLines.length > 0 && Boolean(couponCode || promoId || Number(bodyDiscount) > 0);
      // Client-requested source can still force a single side; otherwise evaluate both and
      // let ECOMMERCE Policy Center choose Best Offer vs stack (allowPlatformWithVendor).
      const tryVendor = wantsPromotion && Boolean(firstVendorId) && requestedPromotionSource !== 'admin';
      const tryAdmin = wantsPromotion && requestedPromotionSource !== 'vendor';

      let vendorCandidateDiscount = 0;
      let vendorCandidateId: string | null = null;
      let adminCandidateDiscount = 0;
      let adminCandidateId: string | null = null;
      /** Distinguishes platform `coupons` wins from ecommerce_admin/legacy campaign promos. */
      let adminCandidateKind: 'coupon' | 'campaign' | null = null;

      if (tryVendor) {
        try {
          const promosRes = await query(
            `SELECT * FROM vendor_promotions
             WHERE vendor_id = $1::uuid
               AND is_active = true
               AND start_date <= NOW()
               AND end_date >= NOW()
               AND (usage_limit IS NULL OR usage_count < usage_limit)`,
            [firstVendorId]
          );
          const promos = (promosRes.rows || []).map((row: Record<string, unknown>) =>
            normalizePromotionRow(row)
          );
          const priorVendorOrderCount =
            customerId && firstVendorId
              ? await countPriorVendorOrders(String(customerId), String(firstVendorId))
              : 0;

          const autoResult = await calculateBestCartPromotionAsync(promos, cartLines, {
            vendorId: String(firstVendorId),
            customerId: customerId ? String(customerId) : undefined,
            priorVendorOrderCount,
          });

          const codeResult = couponCode
            ? await calculateBestCartPromotionAsync(
                promos,
                cartLines,
                {
                  vendorId: String(firstVendorId),
                  customerId: customerId ? String(customerId) : undefined,
                  priorVendorOrderCount,
                  manualCode: String(couponCode).trim(),
                },
                { platformCouponCode: String(couponCode).trim() }
              )
            : null;

          const autoDiscount = autoResult.bestPromotion?.discountAmount ?? autoResult.totalSavings ?? 0;
          const vendorManualDiscount = codeResult?.bestPromotion?.discountAmount ?? 0;
          const platformManualDiscount = codeResult?.platformCouponDiscount ?? 0;
          vendorCandidateDiscount = Math.max(autoDiscount, vendorManualDiscount);
          const bestEval =
            vendorManualDiscount >= autoDiscount && codeResult?.bestPromotion
              ? codeResult.bestPromotion
              : autoResult.bestPromotion;
          if (bestEval) {
            vendorCandidateId = bestEval.promotionId;
          }
          // Platform coupons are admin-funded — fold into admin candidate below.
          if (platformManualDiscount > 0 && codeResult?.platformCouponId) {
            if (platformManualDiscount > adminCandidateDiscount) {
              adminCandidateDiscount = platformManualDiscount;
              adminCandidateId = String(codeResult.platformCouponId);
              adminCandidateKind = 'coupon';
            }
          }
        } catch (promoErr) {
          console.warn('[ecommerce/orders] vendor promotion validation skipped:', promoErr);
        }
      }

      if (tryAdmin) {
        try {
          const campaignResult = await resolveCommercialCampaignDiscount({
            promoId,
            couponCode: couponCode ? String(couponCode).trim() : null,
            cartLines,
            customerId: customerId ? String(customerId) : null,
          });
          if (campaignResult.discountAmount > 0 && campaignResult.promotionId) {
            if (campaignResult.discountAmount > adminCandidateDiscount) {
              adminCandidateDiscount = campaignResult.discountAmount;
              adminCandidateId = campaignResult.promotionId;
              adminCandidateKind = 'campaign';
              campaignIsLegacy = campaignResult.isLegacy;
            }
          }
        } catch (promoErr) {
          console.warn('[ecommerce/orders] admin campaign validation skipped:', promoErr);
        }

        // When client sent promotionSource=admin, tryVendor is skipped — still resolve
        // platform `coupons` table codes for Best Offer.
        if (couponCode && adminCandidateDiscount <= 0) {
          try {
            const { resolveEcommercePlatformCoupon } = await import(
              '../../../lib/services/promotion-code-validation-service'
            );
            const lineSubtotal = cartLines.reduce((s, l) => s + l.price * l.quantity, 0);
            const platformCoupon = await resolveEcommercePlatformCoupon(
              String(couponCode).trim(),
              lineSubtotal
            );
            if (platformCoupon && platformCoupon.discountAmount > 0) {
              adminCandidateDiscount = platformCoupon.discountAmount;
              adminCandidateId = platformCoupon.couponId as string;
              adminCandidateKind = 'coupon';
            }
          } catch (couponErr) {
            console.warn('[ecommerce/orders] platform coupon lookup skipped:', couponErr);
          }
        }
      }

      if (vendorCandidateDiscount > 0 || adminCandidateDiscount > 0) {
        const winner = await selectEcommercePromotionWinnerAsync({
          vendorDiscount: vendorCandidateDiscount,
          adminDiscount: adminCandidateDiscount,
        });
        serverPromoDiscount = winner.discountAmount;
        promotionSource = winner.promotionSource;
        if (winner.promotionSource === 'admin') {
          appliedPromotionId = adminCandidateId ?? appliedPromotionId;
        } else if (winner.promotionSource === 'vendor') {
          appliedPromotionId = vendorCandidateId ?? appliedPromotionId;
        }
      }

      if (Number(bodyDiscount) > 0) {
        if (
          serverPromoDiscount === 0 ||
          !discountsWithinTolerance(serverPromoDiscount, Number(bodyDiscount))
        ) {
          return c.json({ error: 'Promotion discount mismatch' }, 400);
        }
      }

      if (
        Number(bodyDiscount) > 0 &&
        serverPromoDiscount === 0 &&
        (couponCode || promoId)
      ) {
        return c.json({ error: 'Promotion validation failed' }, 400);
      }

      const discountAmount =
        serverPromoDiscount > 0
          ? serverPromoDiscount
          : bodyDiscount != null && Number.isFinite(Number(bodyDiscount)) && Number(bodyDiscount) >= 0
            ? Number(bodyDiscount)
            : 0;
      const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);

      // Fix C: delivery fee is always server-computed; reject if client supplied a different value.
      const serverShipping = computeEcommerceDeliveryFee(subtotalAfterDiscount);
      if (bodyShipping != null && Number.isFinite(Number(bodyShipping))) {
        if (Math.abs(Number(bodyShipping) - serverShipping) > 0.01) {
          return c.json(
            { error: `Delivery fee mismatch (expected ₹${serverShipping}, got ₹${Number(bodyShipping)})` },
            400
          );
        }
      }
      const shippingAmount = serverShipping;

      // Fix B: tax is backend-authoritative via taxCalculationService (CGST/SGST/IGST, place-of-supply aware).
      // Load vendor address for inter-state vs intra-state determination.
      let vendorAddressState: string | undefined;
      if (firstVendorId) {
        try {
          const vendorRows = await query(
            `SELECT address FROM vendors WHERE id = $1::uuid LIMIT 1`,
            [firstVendorId]
          );
          const rawAddr = vendorRows.rows?.[0]?.address;
          if (rawAddr) {
            const parsed = typeof rawAddr === 'string' ? JSON.parse(rawAddr) : rawAddr;
            if (parsed?.state) vendorAddressState = String(parsed.state);
          }
        } catch {
          // vendor address unavailable; taxCalculationService will default to intra-state
        }
      }

      let taxAmount: number;
      let cgstAmount: number | null;
      let sgstAmount: number | null;
      let igstAmount: number | null;
      // Ex-GST taxable value per order line (T), aligned by array index with `orderItems`.
      // Persisted on order_items.taxable_value and used as the commission base below —
      // NEVER derived from a discounted amount (see resolve-ecommerce-product-tax-item.ts).
      let lineTaxableValues: number[];

      // Fix B (locked decision): GST is ALWAYS computed on the ORIGINAL per-line catalog
      // price. Product MRP is GST-inclusive, so amountIsTaxInclusive is always true. A
      // discount (vendor or admin funded) NEVER changes the tax base — it is purely a
      // "Less: Promotional Discount" line applied after tax, not before.
      try {
        const { taxCalculationService } = await import('../../../lib/services/tax-calculation-service');
        const taxItems = buildEcommerceProductTaxItems(
          orderItems.map((oi) => ({
            productId: String(oi.product_id),
            unitPrice: oi.unit_price,
            quantity: oi.quantity,
            hsnCode: (oi as Record<string, unknown>).hsn_code as string | null,
          }))
        );
        const backendTaxResult = await taxCalculationService.calculateTax({
          items: taxItems,
          customerLocation: {
            state: shippingAddress.state || '',
            city: shippingAddress.city || '',
          },
          vendorLocation: vendorAddressState ? { state: vendorAddressState } : undefined,
        });
        taxAmount = Math.round(backendTaxResult.totalTax * 100) / 100;
        cgstAmount = Math.round(backendTaxResult.totalCGST * 100) / 100;
        sgstAmount = Math.round(backendTaxResult.totalSGST * 100) / 100;
        igstAmount = Math.round(backendTaxResult.totalIGST * 100) / 100;
        lineTaxableValues = backendTaxResult.items.map((b) => Math.round(b.baseAmount * 100) / 100);
        console.log(`[ecommerce/orders] Tax computed (original-price basis): total=₹${taxAmount} CGST=₹${cgstAmount} SGST=₹${sgstAmount} IGST=₹${igstAmount} interstate=${backendTaxResult.isInterstate}`);
      } catch (taxErr) {
        console.error('[ecommerce/orders] taxCalculationService failed; using 18% fallback:', taxErr);
        taxAmount = Math.round(subtotal * 0.18 * 100) / 100;
        cgstAmount = null;
        sgstAmount = null;
        igstAmount = null;
        // 18%-inclusive fallback per line, matching the aggregate fallback above.
        lineTaxableValues = orderItems.map((oi) => Math.round(((oi.unit_price * oi.quantity) / 1.18) * 100) / 100);
      }

      // Fix A: total is always server-computed; reject if client supplied a value that differs by more than ₹1.
      // Formula: (original subtotal - discount) + shipping. GST is already inside the
      // GST-inclusive subtotal, so it is never added a second time.
      const recomputedTotal = Math.round((subtotalAfterDiscount + shippingAmount) * 100) / 100;
      if (bodyTotal != null && Number.isFinite(Number(bodyTotal))) {
        const diff = Math.abs(Number(bodyTotal) - recomputedTotal);
        if (diff > 1) {
          return c.json(
            { error: `Order total mismatch (expected ₹${recomputedTotal}, got ₹${Number(bodyTotal)})` },
            400
          );
        }
      }
      const totalAmount = recomputedTotal;

      // Wallet redemption validation
      let effectiveWalletApplied = 0;
      if (walletAmountApplied > 0) {
        if (walletAmountApplied > totalAmount + 0.01) {
          return c.json({ error: 'wallet_amount_applied exceeds order total' }, 400);
        }
        if (!customerId) {
          return c.json({ error: 'Customer account required to use wallet balance' }, 400);
        }
        const walletRow = await query(
          `SELECT COALESCE(balance, 0)::numeric AS balance FROM customer_wallets WHERE customer_id = $1::uuid`,
          [customerId]
        ).catch(() => ({ rows: [] as any[] }));
        const walletBalance = parseFloat(String(walletRow.rows[0]?.balance ?? '0'));
        if (walletBalance < walletAmountApplied) {
          return c.json(
            { error: `Insufficient wallet balance. Available: ₹${walletBalance.toFixed(2)}` },
            400
          );
        }
        effectiveWalletApplied = Math.min(walletAmountApplied, totalAmount);
      }

      const normalizedAddress = {
        name: shippingAddress.name || '',
        phone: shippingAddress.phone || customerPhone,
        line1: shippingAddress.line1 || shippingAddress.addressLine1 || '',
        city: shippingAddress.city || '',
        state: shippingAddress.state || '',
        pincode: shippingAddress.pincode || '',
      };

      // promotionSource was already resolved server-side above (Commercial Campaign Engine
      // / vendor_promotions strict per-source validation) — never re-inferred from
      // serverPromoDiscount, which would incorrectly default to 'admin' whenever the
      // vendor table simply had no match.
      const orderMetadata = {
        checkoutSnapshot: {
          subtotal,
          itemCount: orderItems.reduce((sum, i) => sum + (i.quantity || 0), 0),
          shipping_amount: shippingAmount,
          tax_amount: taxAmount,
          discount_amount: discountAmount,
          total_amount: totalAmount,
        },
        shippingAddress: normalizedAddress,
        promotionId: appliedPromotionId,
        promotionSource,
        couponCode: couponCode || null,
      };

      const pmLower = String(paymentMethod || 'online').toLowerCase();
      const isCod = pmLower === 'cod' || pmLower === 'cash_on_delivery';
      const amountDueAfterWallet = Math.max(0, Math.round((totalAmount - effectiveWalletApplied) * 100) / 100);
      const fullyCoveredByWallet = !isCod && amountDueAfterWallet <= 0;
      const holdStarted = new Date();
      const draftOrderStatus = fullyCoveredByWallet
        ? 'pending'
        : isCod
          ? 'pending'
          : 'pending_payment';
      const draftPaymentStatus = fullyCoveredByWallet ? 'paid' : 'pending';

      const order: Record<string, unknown> = {
        id: orderId,
        order_number: orderNumber,
        customer_id: customerId,
        vendor_id: firstVendorId,
        order_status: draftOrderStatus,
        payment_status: draftPaymentStatus,
        payment_method: paymentMethod,
        subtotal: subtotal,
        shipping_amount: shippingAmount,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        shipping_address: normalizedAddress.line1 || '',
        shipping_city: normalizedAddress.city || '',
        shipping_state: normalizedAddress.state || '',
        shipping_pincode: normalizedAddress.pincode || '',
        shipping_phone: customerPhone,
        metadata: orderMetadata,
        order_type: 'ecommerce',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (draftOrderStatus === 'pending_payment') {
        order.payment_checkout_started_at = holdStarted.toISOString();
        order.payment_hold_expires_at = paymentHoldExpiresAt(holdStarted).toISOString();
      }

      const normalizedTaxBreakdown = normalizeTaxBreakdownForDb(taxBreakdown);
      if (normalizedTaxBreakdown) {
        order.tax_breakdown = normalizedTaxBreakdown;
      }
      if (cgstAmount != null) order.cgst_amount = cgstAmount;
      if (sgstAmount != null) order.sgst_amount = sgstAmount;
      if (igstAmount != null) order.igst_amount = igstAmount;

      // Fix D: write promotion source and amounts as top-level columns for settlement calculation.
      // vendor_promotion_amount is deducted from vendor payout; admin_promotion_amount absorbs the cost on Warmpawz side.
      order.promotion_source = promotionSource ?? null;
      order.vendor_promotion_amount = promotionSource === 'vendor' ? discountAmount : 0;
      order.admin_promotion_amount  = promotionSource === 'admin'  ? discountAmount : 0;

      // Wallet redemption: store applied amount on the order row
      order.wallet_amount_applied = effectiveWalletApplied;

      await insert('orders', order);
      const insertedOrderItemIds: string[] = [];
      for (let i = 0; i < orderItems.length; i++) {
        const item = orderItems[i];
        await insert('order_items', {
          order_id: orderId,
          product_id: item.product_id,
          product_sku_id: item.product_sku_id ?? null,
          name: item.product_name || 'Product',
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total,
          variant_info: item.variant_info ?? null,
          taxable_value: lineTaxableValues[i] ?? item.total,
        });
        if (item.skuRowIdForStock) {
          await decrementSkuStock(item.skuRowIdForStock, item.quantity);
        }
      }

      // Resolve commission at order creation. Admin/platform discounts keep commission on
      // original ex-GST taxable T. Vendor-funded discounts commission on discounted goods
      // (scale line taxable by (P − D) / P). applyOrderCommissionAudit reconciles later.
      if (firstVendorId) {
        try {
          const vendorDiscountScale =
            promotionSource === 'vendor' && subtotal > 0
              ? Math.max(0, subtotal - discountAmount) / subtotal
              : 1;
          const lineItemsForCommission = orderItems.map((item, idx) => ({
            lineSubtotal: (lineTaxableValues[idx] ?? item.total) * vendorDiscountScale,
            productId: item.product_id ?? null,
            categoryId: (item as Record<string, unknown>).category_id as string | null ?? null,
          }));
          const commResult = await resolveOrderCommission(firstVendorId, lineItemsForCommission);
          const snap = buildCommissionSnapshot(commResult);
          const platformDefaultLines = snap.lineBreakdown.filter(
            (line) => line.source === 'platform_default'
          );
          if (platformDefaultLines.length > 0) {
            console.warn(
              `[COMMISSION] Order ${orderId}: ${platformDefaultLines.length} line(s) used platform default — check vendor commission config and product listing_ownership`
            );
          }
          await query(
            `UPDATE orders SET
               commission_rate = $2,
               commission_amount = $3,
               vendor_payout_amount = GREATEST(
                 COALESCE(subtotal, 0)
                 - COALESCE(vendor_promotion_amount, 0)
                 - $3,
                 0
               ),
               commission_snapshot = COALESCE(commission_snapshot, $4::jsonb),
               updated_at = NOW()
             WHERE id = $1::uuid`,
            [orderId, snap.effectiveRate, snap.commissionAmount, JSON.stringify(snap)]
          );
          const orderItemIds = await loadOrderItemIds(orderId);
          await persistOrderItemCommission(orderId, snap.lineBreakdown, orderItemIds);
        } catch (commErr) {
          console.warn('[COMMISSION] resolution at order creation failed (non-fatal):', commErr);
        }
      }

      if (appliedPromotionId && discountAmount > 0) {
        try {
          if (promotionSource === 'admin' && adminCandidateKind === 'coupon') {
            await recordEcommercePlatformCouponUsage({
              couponId: appliedPromotionId,
              orderId,
              customerId: customerId ? String(customerId) : null,
              discountAmount,
            });
          } else if (promotionSource === 'admin') {
            await recordCommercialCampaignUsage({
              promotionId: appliedPromotionId,
              isLegacy: campaignIsLegacy,
              orderId,
              customerId: customerId ? String(customerId) : null,
              discountAmount,
              orderSubtotal: subtotal,
            });
          } else {
            await recordVendorPromotionUsage({
              promotionId: appliedPromotionId,
              orderId,
              customerId: customerId ? String(customerId) : null,
              discountAmount,
              orderSubtotal: subtotal,
            });
          }
        } catch (usageErr) {
          console.warn('[ecommerce/orders] promotion usage record failed:', usageErr);
        }
      }

      // Deduct wallet balance and record transaction (non-fatal if table unavailable)
      if (effectiveWalletApplied > 0 && customerId) {
        try {
          await query(
            `UPDATE customer_wallets
             SET balance = GREATEST(0, balance - $1::numeric), updated_at = NOW()
             WHERE customer_id = $2::uuid`,
            [effectiveWalletApplied, customerId]
          );
          await query(
            `INSERT INTO wallet_transactions
               (customer_id, transaction_type, amount, description, reference_type, reference_id, created_at)
             VALUES ($1::uuid, 'debit', $2, $3, 'order', $4::uuid, NOW())
             ON CONFLICT DO NOTHING`,
            [customerId, effectiveWalletApplied, `Applied to order ${orderNumber}`, orderId]
          );
        } catch (walletErr: any) {
          console.warn('[ecommerce/orders] wallet deduction failed (non-fatal):', walletErr?.message);
        }
      }

      const successResponse = {
        success: true,
        customerId,
        totalAmount,
        isFirstPlatformProductOrder: priorOrderCount === 0,
        containsPetFood,
        appliedPromotion: appliedPromotionId
          ? { id: appliedPromotionId, discountAmount, type: promotionSource ?? 'vendor' }
          : undefined,
        order: {
          id: orderId,
          order_number: orderNumber,
          status: draftOrderStatus,
          payment_status: draftPaymentStatus,
          payment_hold_expires_at: order.payment_hold_expires_at ?? null,
          total: totalAmount,
          items: orderItems,
          shipping_address: shippingAddress,
          payment_method: paymentMethod,
          created_at: order.created_at,
        },
        message: fullyCoveredByWallet
          ? 'Order placed successfully!'
          : 'Order created — complete payment within 5 minutes.',
      };

      // Persist idempotency key so a replayed checkout attempt returns the same order (30 min TTL).
      if (idempotencyKey) {
        try {
          await storeIdempotencyKey(
            `ecommerce_order:${idempotencyKey}`,
            'order',
            orderId,
            JSON.stringify(successResponse),
            201,
            0.5 // 30 minutes
          );
        } catch (idemErr) {
          console.warn('[ecommerce/orders] idempotency key store failed (non-fatal):', idemErr);
        }
      }

      if (fullyCoveredByWallet) {
        void notifyShopOrderPaid(orderId).catch((e) =>
          console.warn('[ecommerce/orders] notifyShopOrderPaid (wallet-full) failed:', e)
        );
        // Order is paid in full at creation (no Razorpay verify-payment call happens for
        // wallet-only checkouts) — write the batch settlement ledger row here instead.
        void writeEcommerceOrderSettlementLedgerRow(orderId).catch((e) =>
          console.warn('[ecommerce/orders] settlement ledger write (wallet-full) failed:', e)
        );
      }

      return c.json(successResponse, 201);
    } catch (error: any) {
      console.error('Error creating ecommerce order:', error);
      return c.json({ error: error.message || 'Failed to create order' }, 500);
    }
  });

  /**
   * GET /products/:productId
   * Get product details (alias path; prefer /ecommerce/products/:productId in customer app)
   */
  app.get("/products/:productId", (c) => handleGetPublicProductById(c, '[products/:productId]'));

/**
 * Product count per category:
 * - parent: products with category_id = parent (canonical) or legacy child ids or links under children
 * - subcategory: membership links (and legacy direct category_id)
 */
  async function storefrontCategoryProductCountLateral(): Promise<string> {
    const exclude = await storefrontExcludeMealProductsSql();
    let linksClause = '';
    try {
      await query(`SELECT 1 FROM product_category_links LIMIT 0`);
      linksClause = `
        OR EXISTS (
          SELECT 1 FROM product_category_links pcl
          WHERE pcl.product_id = p.id AND pcl.subcategory_id = ec.id
        )`;
    } catch {
      /* migration not applied yet */
    }
    return `
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS product_count
      FROM products p
      WHERE (
        p.category_id = ec.id
        OR p.category_id IN (
          SELECT id FROM ecommerce_categories WHERE parent_category_id = ec.id
        )
        ${linksClause}
      )
        AND ${STOREFRONT_ACTIVE_STATUS_SQL}
        ${exclude}
    ) pc ON true`;
  }

  /**
   * GET /ecommerce/categories
   * Get e-commerce product categories
   * Query: with_products_only=true — omit categories with zero storefront-active products
   * Also registered under /public/ecommerce/categories for guest browse.
   */
  const handleListEcommerceCategories = async (c: any) => {
    try {
      const withProductsOnly =
        c.req.query('with_products_only') === 'true' ||
        c.req.query('with_products_only') === '1';

      const categoryLateral = await storefrontCategoryProductCountLateral();
      let categories;
      try {
        categories = await query(
          `SELECT ec.id::text AS id, ec.name, ec.description, ec.display_order, ec.is_active,
                  ec.image_url, ec.created_at, ec.parent_category_id::text AS parent_category_id,
                  COALESCE(pc.product_count, 0) AS product_count
           FROM ecommerce_categories ec
           ${categoryLateral}
           WHERE ec.is_active = true
           ${withProductsOnly ? 'AND COALESCE(pc.product_count, 0) > 0' : ''}
           ORDER BY ec.display_order ASC, ec.name ASC`
        );
      } catch (dbError: any) {
        // Handle table not existing
        if (dbError.message?.includes('relation "ecommerce_categories" does not exist') ||
          dbError.code === '42P01') {
          return c.json({
            success: true,
            categories: [],
            total: 0,
            message: 'Categories table not initialized. Please seed categories via admin panel.',
          });
        }
        if (dbError.message?.includes('parent_category_id') || dbError.code === '42703') {
          try {
            categories = await query(
              `SELECT ec.id::text AS id, ec.name, ec.description, ec.display_order, ec.is_active,
                      ec.image_url, ec.created_at,
                      COALESCE(pc.product_count, 0) AS product_count
               FROM ecommerce_categories ec
               ${categoryLateral}
               WHERE ec.is_active = true
               ${withProductsOnly ? 'AND COALESCE(pc.product_count, 0) > 0' : ''}
               ORDER BY ec.display_order ASC, ec.name ASC`
            );
          } catch (noParentErr: any) {
            if (noParentErr.message?.includes('column "image_url"') || noParentErr.code === '42703') {
              categories = await query(
                `SELECT ec.id::text AS id, ec.name, ec.description, ec.display_order, ec.is_active,
                        ec.created_at,
                        COALESCE(pc.product_count, 0) AS product_count
                 FROM ecommerce_categories ec
                 ${categoryLateral}
                 WHERE ec.is_active = true
                 ${withProductsOnly ? 'AND COALESCE(pc.product_count, 0) > 0' : ''}
                 ORDER BY ec.display_order ASC, ec.name ASC`
              );
            } else {
              throw noParentErr;
            }
          }
        } else if (dbError.message?.includes('column "image_url"') || dbError.code === '42703') {
          categories = await query(
            `SELECT ec.id::text AS id, ec.name, ec.description, ec.display_order, ec.is_active,
                    ec.created_at, ec.parent_category_id::text AS parent_category_id,
                    COALESCE(pc.product_count, 0) AS product_count
             FROM ecommerce_categories ec
             ${categoryLateral}
             WHERE ec.is_active = true
             ${withProductsOnly ? 'AND COALESCE(pc.product_count, 0) > 0' : ''}
             ORDER BY ec.display_order ASC, ec.name ASC`
          );
        } else {
          throw dbError;
        }
      }

      const rows = (categories?.rows || []) as Record<string, unknown>[];
      const mapped = await mapCategoryRowsForPublic(rows);

      return c.json({
        success: true,
        categories: mapped,
        total: mapped.length,
      });
    } catch (error: any) {
      console.error('Error fetching e-commerce categories:', error);
      return c.json({ error: error.message }, 500);
    }
  };

  app.get("/ecommerce/categories", handleListEcommerceCategories);
  /** Guest-safe public-read alias (auth middleware allows /^\/public\//). */
  app.get("/public/ecommerce/categories", handleListEcommerceCategories);

  // ============================================
  // SHOPPING CART
  // ============================================

  /**
   * GET /cart/:customerId
   * Get customer cart
   */
  app.get("/cart/:customerId", async (c) => {
    try {
      const { customerId } = c.req.param();
      const excludeMealSql = await storefrontExcludeMealProductsSql();

      const cartItems = await query(
        `SELECT ci.*, p.name as product_name, p.price, p.images, v.business_name as vendor_name
         FROM cart_items ci
         INNER JOIN products p ON ci.product_id = p.id
         LEFT JOIN vendors v ON p.vendor_id = v.id
         WHERE ci.customer_id = $1
           ${excludeMealSql}
         ORDER BY ci.created_at DESC`,
        [customerId]
      );

      const subtotal = cartItems.rows.reduce((sum: number, item: any) => {
        return sum + (parseFloat(item.price || 0) * (item.quantity || 1));
      }, 0);

      return c.json({
        success: true,
        cart: {
          items: cartItems.rows,
          subtotal,
          total: subtotal, // Add tax/shipping if needed
          itemCount: cartItems.rows.length,
        },
      });
    } catch (error: any) {
      console.error('Error fetching cart:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /cart/:customerId/items
   * Add item to cart
   */
  app.post("/cart/:customerId/items", async (c) => {
    try {
      const { customerId } = c.req.param();
      const { productId, quantity } = await c.req.json();

      if (!productId || !quantity) {
        return c.json({ error: 'productId and quantity are required' }, 400);
      }

      if (await productIdIsExcludedFromEcommerceStorefront(String(productId))) {
        return c.json({ error: 'Product is not available in the shop' }, 404);
      }

      // Check if item already in cart
      const existing = await query(
        'SELECT * FROM cart_items WHERE customer_id = $1 AND product_id = $2',
        [customerId, productId]
      );

      if (existing.rows.length > 0) {
        // Update quantity
        const updated = await update('cart_items',
          { id: existing.rows[0].id },
          { quantity: (existing.rows[0].quantity || 0) + quantity }
        );
        return c.json({ success: true, cartItem: updated[0] });
      } else {
        // Add new item
        const newItem = await insert('cart_items', {
          customer_id: customerId,
          product_id: productId,
          quantity: quantity,
        });
        return c.json({ success: true, cartItem: newItem[0] });
      }
    } catch (error: any) {
      console.error('Error adding to cart:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /cart/:customerId/items/:itemId
   * Remove item from cart
   */
  app.delete("/cart/:customerId/items/:itemId", async (c) => {
    try {
      const { itemId } = c.req.param();

      await query('DELETE FROM cart_items WHERE id = $1', [itemId]);

      return c.json({ success: true, message: 'Item removed from cart' });
    } catch (error: any) {
      console.error('Error removing from cart:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // ORDERS
  // ============================================

  /**
   * POST /orders
   * Create order from cart
   */
  app.post("/orders", async (c) => {
    try {
      const orderData = await c.req.json();
      const {
        customerId,
        vendorId,
        items,
        shippingAddress,
        paymentMethod,
        couponCode,
      } = orderData;

      if (!customerId || !items || items.length === 0) {
        return c.json({ error: 'customerId and items are required' }, 400);
      }

      // Calculate totals with tax calculation service
      let subtotal = 0;
      const orderItems = [];
      const taxCalculationItems = [];

      // Get customer and vendor locations for tax calculation
      let customerLocation: { state: string; city?: string; pincode?: string } | undefined = undefined;
      let vendorLocation: { state: string; city?: string } | undefined = undefined;

      if (customerId) {
        const customers = await select('customers', { id: customerId });
        if (customers.length > 0 && customers[0].address) {
          const addr = typeof customers[0].address === 'string'
            ? JSON.parse(customers[0].address)
            : customers[0].address;
          if (addr?.state) {
            customerLocation = {
              state: addr.state,
              city: addr.city,
              pincode: addr.pincode,
            };
          }
        }
      }

      if (vendorId) {
        const vendors = await select('vendors', { id: vendorId });
        if (vendors.length > 0 && vendors[0].address) {
          const addr = typeof vendors[0].address === 'string'
            ? JSON.parse(vendors[0].address)
            : vendors[0].address;
          if (addr?.state) {
            vendorLocation = {
              state: addr.state,
              city: addr.city,
            };
          }
        }
      }

      const customerCity = String(
        shippingAddress?.city ?? shippingAddress?.City ?? customerLocation?.city ?? '',
      ).trim();

      for (const item of items) {
        try {
          const resolved = await resolveEcommerceOrderLine(item as Record<string, unknown>);
          if (!resolved) continue;
          if (await productIdIsExcludedFromEcommerceStorefront(resolved.product_id)) {
            return c.json({ error: 'Product is not available in the shop' }, 400);
          }
          await assertProductDeliverableToCity(
            resolved.product_id,
            resolved.product_name,
            customerCity,
          );
          subtotal += resolved.total;

          const products = await select('products', { id: resolved.product_id });
          const product = products[0] as {
            hsn_code?: string;
            category?: string;
          };

          orderItems.push({
            product_id: resolved.product_id,
            product_sku_id: resolved.product_sku_id,
            quantity: resolved.quantity,
            price: resolved.unit_price,
            total: resolved.total,
            name: resolved.product_name,
            variant_info: resolved.variant_info,
            skuRowIdForStock: resolved.skuRowIdForStock,
          });

          taxCalculationItems.push({
            id: resolved.product_id,
            type: 'product' as const,
            hsnCode: product?.hsn_code,
            amount: resolved.unit_price,
            quantity: resolved.quantity,
            category: product?.category,
          });
        } catch (lineErr: unknown) {
          const msg = lineErr instanceof Error ? lineErr.message : String(lineErr);
          return c.json({ error: msg }, 400);
        }
      }

      if (orderItems.length === 0) {
        return c.json({ error: 'No valid products found for this order' }, 400);
      }

      // Calculate tax using tax calculation service
      let taxAmount = 0;
      let taxBreakdown = null;
      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;
      let gstRuleId = null;

      if (taxCalculationItems.length > 0) {
        try {
          const { taxCalculationService } = await import('../../../lib/services/tax-calculation-service');
          const taxResult = await taxCalculationService.calculateTax({
            items: taxCalculationItems,
            customerLocation,
            vendorLocation,
            vendorId: vendorId || undefined,
          });

          taxAmount = taxResult.totalTax;
          cgstAmount = taxResult.totalCGST;
          sgstAmount = taxResult.totalSGST;
          igstAmount = taxResult.totalIGST;
          taxBreakdown = taxResult;
          gstRuleId = taxResult.items[0]?.taxRuleId || null;
        } catch (error) {
          console.error('Error calculating tax, falling back to default 18%:', error);
          // Fallback to default 18% if tax calculation fails
          taxAmount = subtotal * 0.18;
        }
      }

      const shippingAmount = shippingAddress ? 50 : 0; // Should be calculated
      const totalAmount = subtotal + taxAmount + shippingAmount;

      let priorOrderCount = 0;
      let containsPetFood = false;
      try {
        const cnt = await query(
          `SELECT COUNT(*)::int AS c FROM orders WHERE customer_id = $1::uuid AND COALESCE(order_status, '') NOT IN ('cancelled', 'failed')`,
          [customerId]
        );
        priorOrderCount = cnt.rows[0]?.c ?? 0;
      } catch {
        priorOrderCount = 0;
      }
      for (const item of orderItems) {
        const p = await select('products', { id: item.product_id });
        const cat = String((p[0] as { category?: string })?.category || '').toLowerCase();
        const name = String((p[0] as { name?: string })?.name || item.name || '').toLowerCase();
        if (
          cat.includes('food') ||
          cat.includes('treat') ||
          name.includes('food') ||
          name.includes('treat') ||
          name.includes('kibble')
        ) {
          containsPetFood = true;
          break;
        }
      }

      // Generate order number
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Create order with tax breakdown
      const order = await insert('orders', {
        customer_id: customerId,
        vendor_id: vendorId || null,
        order_number: orderNumber,
        order_status: 'pending',
        subtotal: subtotal,
        tax_amount: taxAmount,
        cgst_amount: cgstAmount,
        sgst_amount: sgstAmount,
        igst_amount: igstAmount,
        shipping_amount: shippingAmount,
        total_amount: totalAmount,
        payment_method: paymentMethod || 'online',
        shipping_address: shippingAddress || null,
        tax_breakdown: normalizeTaxBreakdownForDb(taxBreakdown),
        ...(couponCode
          ? { metadata: { couponCode: String(couponCode).trim() } }
          : {}),
      });

      // Order purchase loyalty: handled by action_sources → loyalty-events-consumer (not inline here).

      // Create order items
      for (const item of orderItems) {
        await insert('order_items', {
          order_id: order[0].id,
          product_id: item.product_id,
          product_sku_id: item.product_sku_id ?? null,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.total,
          variant_info: item.variant_info ?? null,
        });
        if (item.skuRowIdForStock) {
          await decrementSkuStock(item.skuRowIdForStock, item.quantity);
        }
      }

      // Clear cart
      await query('DELETE FROM cart_items WHERE customer_id = $1', [customerId]);

      const ord = order[0] as { id?: string; total_amount?: number };
      return c.json({
        success: true,
        customerId,
        orderId: ord.id,
        totalAmount: ord.total_amount != null ? Number(ord.total_amount) : totalAmount,
        isFirstPlatformProductOrder: priorOrderCount === 0,
        containsPetFood,
        order: order[0],
        message: 'Order created successfully',
      });
    } catch (error: any) {
      console.error('Error creating order:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /orders/:orderId
   * Get order details
   */
  app.get("/orders/:orderId", async (c) => {
    try {
      const { orderId } = c.req.param();

      const orders = await query(
        `SELECT o.*, c.full_name as customer_name, v.business_name as vendor_name
         FROM orders o
         LEFT JOIN customers c ON o.customer_id = c.id
         LEFT JOIN vendors v ON o.vendor_id = v.id
         WHERE o.id = $1`,
        [orderId]
      );

      if (orders.rows.length === 0) {
        return c.json({ error: 'Order not found' }, 404);
      }

      const order = orders.rows[0];

      // Get order items
      const items = await query(
        `SELECT oi.*, p.name as product_name, p.images
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = $1`,
        [orderId]
      );

      return c.json({
        success: true,
        order: {
          ...order,
          items: items.rows,
        },
      });
    } catch (error: any) {
      console.error('Error fetching order:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /orders/customer/:customerId
   * Get customer orders
   */
  app.get("/orders/customer/:customerId", async (c) => {
    try {
      const { customerId } = c.req.param();

      await reconcilePendingShopPayments({
        customerId,
        limit: 30,
        source: 'orders-customer-list',
      }).catch((e) =>
        console.warn('[orders/customer] reconcilePendingShopPayments failed:', e)
      );

      await expireShopPaymentHolds({ limit: 30, requestId: randomUUID() }).catch((e) =>
        console.warn('[orders/customer] expireShopPaymentHolds failed:', e)
      );

      const orders = await query(
        `SELECT o.*, v.business_name as vendor_name
         FROM orders o
         LEFT JOIN vendors v ON o.vendor_id = v.id
         WHERE o.customer_id = $1
         ORDER BY o.created_at DESC`,
        [customerId]
      );

      return c.json({
        success: true,
        orders: orders.rows,
        total: orders.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching customer orders:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /ecommerce/process-payment-hold-expiry
   * Sweep unpaid shop checkout drafts past the 5-minute hold (EventBridge / manual).
   */
  app.post('/ecommerce/process-payment-hold-expiry', async (c) => {
    try {
      const results = await expireShopPaymentHolds({ limit: 200, requestId: randomUUID() });
      return c.json({ success: true, ...results });
    } catch (error: any) {
      console.error('[ecommerce] process-payment-hold-expiry failed:', error);
      return c.json({ error: error.message || 'Failed to expire payment holds' }, 500);
    }
  });

  // ============================================
  // ADMIN E-COMMERCE ENDPOINTS
  // ============================================

  /**
   * GET /admin/ecommerce/analytics/platform
   * Get platform-wide e-commerce analytics (admin dashboard)
   */
  app.get("/admin/ecommerce/analytics/platform", async (c) => {
    try {
      const suppression = getTemporaryVendorSuppressionParams();
      const settlementSuppressionWhere = suppression
        ? ` WHERE ${sqlExcludeSuppressedSettlementRows('settlements', 1, 2)}`
        : '';
      const settlementSuppressionParams =
        suppression && suppression.vendorIds?.length ? [suppression.vendorIds, suppression.cutoffDateIst] : [];

      const platformGrowth = buildPlatformPeriodGrowthSql();

      const [
        revenueStats,
        sellerStats,
        activeProductsRow,
        pendingApprovalsRow,
        processingOrdersRow,
        settlementAggRow,
        platformGrowthRow,
      ] = await Promise.all([
        query(
          `SELECT 
           COUNT(*) as total_orders,
           COALESCE(SUM(o.total_amount), 0) as total_gmv,
           COALESCE(SUM(o.total_amount) FILTER (WHERE o.order_status = 'delivered'), 0) as total_revenue,
           COALESCE(SUM(o.total_amount) FILTER (WHERE o.order_status = 'delivered' AND o.created_at >= DATE_TRUNC('month', CURRENT_DATE)), 0) as this_month_revenue
         FROM orders o
         WHERE ${SQL_ADMIN_SHOP_ORDER_TYPE}`
        ).catch(() => ({ rows: [{}] })),
        query(buildEcommerceSellerStatsSql().sql).catch(() => ({ rows: [{}] })),
        query(
          `SELECT COUNT(*)::int AS c FROM products p
           WHERE p.is_active = true
             AND LOWER(COALESCE(NULLIF(TRIM(p.status::text), ''), 'pending')) = 'active'`
        ).catch(() => ({ rows: [{ c: 0 }] })),
        query(
          `SELECT COUNT(*)::int AS c FROM products p
           WHERE (
             p.status IS NULL
             OR LOWER(TRIM(p.status::text)) IN ('pending', 'pending_approval', 'submit_for_approval', 'submitted')
           )`
        ).catch(() => ({ rows: [{ c: 0 }] })),
        query(
          `SELECT COUNT(*)::int AS c FROM orders o
           WHERE o.order_status IN ('confirmed', 'processing', 'shipped')
             AND ${SQL_ADMIN_SHOP_ORDER_TYPE}`
        ).catch(() => ({ rows: [{ c: 0 }] })),
        (async () => {
          try {
            return await query(
              `SELECT 
                COUNT(*) FILTER (WHERE COALESCE(settlement_status, status) IN ('pending', 'processing'))::int AS pending_count,
                COALESCE(SUM(COALESCE(net_amount, vendor_amount, total_amount)) FILTER (WHERE COALESCE(settlement_status, status) IN ('pending', 'processing')), 0) AS pending_amount
              FROM settlements
              ${settlementSuppressionWhere}`,
              settlementSuppressionParams.length ? settlementSuppressionParams : undefined
            );
          } catch {
            try {
              return await query(
                `SELECT 
                  0::int AS pending_count,
                  COALESCE(SUM(COALESCE(net_amount, vendor_amount, total_amount)), 0) AS pending_amount
                FROM settlements
                ${settlementSuppressionWhere}`,
                settlementSuppressionParams.length ? settlementSuppressionParams : undefined
              );
            } catch {
              return { rows: [{ pending_count: 0, pending_amount: 0 }] };
            }
          }
        })(),
        query(platformGrowth.sql, platformGrowth.params).catch(() => ({ rows: [{}] })),
      ]);

      // Aggregate commission from paid orders (fallback to platform default when column absent)
      let totalCommission = 0;
      try {
        const commissionAgg = await query(
          `SELECT COALESCE(SUM(commission_amount), 0) AS total_commission
           FROM orders
           WHERE payment_status = 'paid' AND commission_amount IS NOT NULL`
        );
        totalCommission = parseFloat(String(commissionAgg.rows[0]?.total_commission ?? 0)) || 0;
      } catch {
        const totalRevenue = parseFloat(revenueStats.rows[0]?.total_revenue || '0');
        const settingsRes = await query(
          `SELECT default_rate FROM ecommerce_commission_settings WHERE setting_key = 'default' LIMIT 1`
        ).catch(() => ({ rows: [{ default_rate: 10 }] }));
        const fallbackRate = parseFloat(String(settingsRes.rows[0]?.default_rate ?? 10)) || 10;
        totalCommission = totalRevenue * (fallbackRate / 100);
      }
      const totalRevenue = parseFloat(revenueStats.rows[0]?.total_revenue || '0');
      const totalGMV = parseFloat(revenueStats.rows[0]?.total_gmv || '0') || totalRevenue;
      const activeProducts = parseInt(String(activeProductsRow.rows[0]?.c ?? '0'), 10) || 0;
      const pendingApprovals = parseInt(String(pendingApprovalsRow.rows[0]?.c ?? '0'), 10) || 0;
      const processingOrders = parseInt(String(processingOrdersRow.rows[0]?.c ?? '0'), 10) || 0;
      const settlementRow = settlementAggRow.rows[0] || {};
      const pendingSettlements = parseInt(String(settlementRow.pending_count ?? '0'), 10) || 0;
      const pendingSettlementAmount = parseFloat(String(settlementRow.pending_amount ?? '0')) || 0;
      const growthRow = platformGrowthRow.rows[0] || {};
      const currentGmv = parseFloat(String(growthRow.current_gmv ?? 0)) || 0;
      const previousGmv = parseFloat(String(growthRow.previous_gmv ?? 0)) || 0;
      const currentOrders = parseInt(String(growthRow.current_orders ?? 0), 10) || 0;
      const previousOrders = parseInt(String(growthRow.previous_orders ?? 0), 10) || 0;
      const currentCommission = parseFloat(String(growthRow.current_commission ?? 0)) || 0;
      const previousCommission = parseFloat(String(growthRow.previous_commission ?? 0)) || 0;

      return c.json({
        success: true,
        data: {
          totalRevenue,
          totalGMV,
          totalCommission,
          totalOrders: parseInt(revenueStats.rows[0]?.total_orders || '0', 10),
          activeSellers: parseInt(sellerStats.rows[0]?.active_sellers || '0', 10),
          totalSellers: parseInt(sellerStats.rows[0]?.total_sellers || '0', 10),
          thisMonthRevenue: parseFloat(revenueStats.rows[0]?.this_month_revenue || '0'),
          activeProducts,
          pendingApprovals,
          processingOrders,
          pendingSettlements,
          pendingSettlementAmount,
          growth: {
            gmv: calcPeriodGrowthPercent(currentGmv, previousGmv),
            commission: calcPeriodGrowthPercent(currentCommission, previousCommission),
            orders: calcPeriodGrowthPercent(currentOrders, previousOrders),
          },
        },
      });
    } catch (error: any) {
      console.error('Error fetching platform analytics:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/ecommerce/analytics
   * Get e-commerce analytics with date range
   */
  app.get("/admin/ecommerce/analytics", async (c) => {
    try {
      const days = clampAnalyticsDays(c.req.query('days'));
      const { currentStart, previousStart } = buildPeriodStartDates(days);
      const currentStartIso = currentStart.toISOString();
      const previousStartIso = previousStart.toISOString();
      const nowIso = new Date().toISOString();

      const dailyRevenue = buildDailyRevenueSql();
      const periodTotals = buildPeriodTotalsSql();
      const sellersWithOrders = buildSellersWithOrdersSql();
      const productStats = buildProductStatsSql();
      const sellerStats = buildEcommerceSellerStatsSql();
      const topProducts = buildTopProductsSql();
      const topSellers = buildTopSellersSql();
      const orderStatusCounts = buildAdminEcommerceOrderStatusCountsSqlForDays(days);

      const [
        revenueStats,
        totalsResult,
        currentSellersResult,
        previousSellersResult,
        productStatsResult,
        sellerStatsResult,
        topProductsResult,
        topSellersResult,
        orderStatusResult,
      ] = await Promise.all([
        query(dailyRevenue.sql, [currentStartIso]),
        query(periodTotals.sql, [currentStartIso, previousStartIso]),
        query(sellersWithOrders.sql, [currentStartIso, nowIso]),
        query(sellersWithOrders.sql, [previousStartIso, currentStartIso]),
        query(productStats.sql, productStats.params),
        query(sellerStats.sql, sellerStats.params),
        query(topProducts.sql, [currentStartIso]),
        query(topSellers.sql, [currentStartIso]),
        query(orderStatusCounts.sql, orderStatusCounts.params),
      ]);

      const totals = totalsResult.rows[0] || {};
      const currentGmv = parseFloat(String(totals.current_gmv ?? 0)) || 0;
      const previousGmv = parseFloat(String(totals.previous_gmv ?? 0)) || 0;
      const currentDeliveredRevenue =
        parseFloat(String(totals.current_delivered_revenue ?? 0)) || 0;
      const previousDeliveredRevenue =
        parseFloat(String(totals.previous_delivered_revenue ?? 0)) || 0;
      const totalOrders = parseInt(String(totals.current_orders ?? 0), 10) || 0;
      const previousOrders = parseInt(String(totals.previous_orders ?? 0), 10) || 0;
      const currentSellersWithOrders =
        parseInt(String(currentSellersResult.rows[0]?.seller_count ?? 0), 10) || 0;
      const previousSellersWithOrders =
        parseInt(String(previousSellersResult.rows[0]?.seller_count ?? 0), 10) || 0;

      const productRow = productStatsResult.rows[0] || {};
      const ordersByStatus = stripAllStatusKey(normalizeAdminOrderStatusCounts(orderStatusResult.rows));

      const revenue = (revenueStats.rows || []).map((row: any) => ({
        date: row.date,
        order_count: parseInt(String(row.order_count ?? 0), 10) || 0,
        gmv: parseFloat(String(row.gmv ?? 0)) || 0,
        delivered_revenue: parseFloat(String(row.delivered_revenue ?? 0)) || 0,
        // Backward compatibility for older clients
        revenue: parseFloat(String(row.delivered_revenue ?? 0)) || 0,
      }));

      return c.json({
        success: true,
        data: {
          revenue,
          topProducts: topProductsResult.rows,
          topSellers: topSellersResult.rows,
          totalRevenue: currentDeliveredRevenue,
          totalGMV: currentGmv,
          totalOrders,
          activeSellers: parseInt(String(sellerStatsResult.rows[0]?.active_sellers ?? 0), 10) || 0,
          totalSellers: parseInt(String(sellerStatsResult.rows[0]?.total_sellers ?? 0), 10) || 0,
          growth: {
            gmv: calcPeriodGrowthPercent(currentGmv, previousGmv),
            deliveredRevenue: calcPeriodGrowthPercent(currentDeliveredRevenue, previousDeliveredRevenue),
            orders: calcPeriodGrowthPercent(totalOrders, previousOrders),
            sellersWithOrders: calcPeriodGrowthPercent(
              currentSellersWithOrders,
              previousSellersWithOrders,
            ),
          },
          ordersByStatus,
          products: {
            total: parseInt(String(productRow.total ?? 0), 10) || 0,
            active: parseInt(String(productRow.active ?? 0), 10) || 0,
            lowStock: parseInt(String(productRow.low_stock ?? 0), 10) || 0,
          },
          periodDays: days,
        },
      });
    } catch (error: any) {
      console.error('Error fetching analytics:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/ecommerce/orders/counts
   * Status badge counts for admin marketplace orders
   */
  app.get('/admin/ecommerce/orders/counts', async (c) => {
    try {
      const period = c.req.query('period');
      const { sql, params } = buildAdminEcommerceOrderStatusCountsSql(period);
      const result = await query(sql, params);
      const counts = normalizeAdminOrderStatusCounts(result.rows);

      return c.json({
        success: true,
        counts,
      });
    } catch (error: any) {
      console.error('Error fetching admin order counts:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  /**
   * GET /admin/ecommerce/orders/:orderId
   * Full marketplace order detail for admin
   */
  app.get('/admin/ecommerce/orders/:orderId', async (c) => {
    try {
      const { orderId } = c.req.param();

      const orders = await query(
        `SELECT
           o.*,
           o.order_status AS status,
           c.full_name AS customer_name,
           c.phone AS customer_phone,
           c.email AS customer_email,
           v.business_name AS vendor_name,
           v.phone AS vendor_phone,
           s.awb_code AS shipment_tracking_number,
           s.tracking_url AS shipment_tracking_url,
           s.courier_name AS shipment_carrier_name,
           s.logistics_partner AS shipment_carrier_id
         FROM orders o
         LEFT JOIN customers c ON o.customer_id = c.id
         LEFT JOIN vendors v ON o.vendor_id = v.id
         LEFT JOIN LATERAL (
           SELECT awb_code, tracking_url, courier_name, logistics_partner
           FROM shipments
           WHERE order_id = o.id
           ORDER BY created_at DESC
           LIMIT 1
         ) s ON true
         WHERE o.id = $1`,
        [orderId],
      );

      if (orders.rows.length === 0) {
        return c.json({ success: false, error: 'Order not found' }, 404);
      }

      const items = await query(
        `SELECT oi.*, p.name AS product_name, p.images
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = $1`,
        [orderId],
      );

      const order = enrichAdminEcommerceOrderDetail({
        ...orders.rows[0],
        items: items.rows,
      });

      return c.json({
        success: true,
        order,
      });
    } catch (error: any) {
      console.error('Error fetching admin order detail:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  /**
   * GET /admin/ecommerce/orders
   * Lean marketplace order list for admin (filters + pagination)
   */
  app.get('/admin/ecommerce/orders', async (c) => {
    try {
      const status = c.req.query('status');
      const period = c.req.query('period');
      const search = c.req.query('search');
      const limit = parseInt(c.req.query('limit') || '25', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      const filters = { status, period, search };
      const listQuery = buildAdminEcommerceOrderListSql(filters, limit, offset);
      const countQuery = buildAdminEcommerceOrderCountSql(filters);

      const [ordersResult, countResult] = await Promise.all([
        query(listQuery.sql, listQuery.params),
        query(countQuery.sql, countQuery.params),
      ]);

      return c.json({
        success: true,
        orders: ordersResult.rows,
        total: countResult.rows[0]?.total ?? 0,
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  /**
   * GET /admin/ecommerce/products
   * Get products with status filter (admin)
   */
  app.get("/admin/ecommerce/products", async (c) => {
    try {
      const status = c.req.query('status');
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let productsQuery = `
        SELECT 
          p.*,
          v.business_name as vendor_name,
          v.id as vendor_id
        FROM products p
        LEFT JOIN vendors v ON p.vendor_id = v.id
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (status === 'pending_approval') {
        productsQuery += ` AND (
          p.status IS NULL
          OR LOWER(TRIM(p.status::text)) IN ('pending', 'pending_approval', 'submit_for_approval', 'submitted')
        )`;
      } else if (status) {
        productsQuery += ` AND p.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      productsQuery += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const products = await query(productsQuery, params);

      return c.json({
        success: true,
        products: products.rows,
        total: products.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching products:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  app.put("/admin/ecommerce/product/:productId", async (c) => {
    try {
      const { productId } = c.req.param();
      const body = await c.req.json();
      const { status } = body;

      if (!status) {
        return c.json({ error: 'status is required' }, 400);
      }

      const normalized = normalizeAdminProductLifecycleStatus(status);
      const willBeActiveStorefront =
        normalized.status === 'active' && normalized.is_active;

      if (willBeActiveStorefront) {
        const chk = await query('SELECT category_id FROM products WHERE id = $1', [productId]);
        if (chk.rows.length === 0) {
          return c.json({ success: false, error: 'Product not found' }, 404);
        }
        const cid = chk.rows[0]?.category_id;
        if (cid == null || String(cid).trim() === '') {
          return c.json(
            {
              success: false,
              error:
                'Cannot approve: product has no catalog category (category_id). Assign a category on the product before approving.',
            },
            400,
          );
        }
      }

      const updated = await update(
        'products',
        { id: productId },
        { status: normalized.status, is_active: normalized.is_active },
      );

      if (!updated || updated.length === 0) {
        return c.json(
          { success: false, error: 'Product not found or could not be updated (check product id).' },
          404,
        );
      }

      const approved = normalized.status === 'active' && normalized.is_active;
      return c.json({
        success: true,
        product: updated[0],
        message: approved ? 'Product approved' : `Product ${normalized.status}`,
      });
    } catch (error: any) {
      console.error('Error updating product:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /admin/ecommerce/vendors/:vendorId/products/approve-all
   * Approve all pending products for a vendor (skips rows missing category_id).
   */
  app.post('/admin/ecommerce/vendors/:vendorId/products/approve-all', async (c) => {
    try {
      const { vendorId } = c.req.param();
      if (!isValidUUID(String(vendorId || '').trim())) {
        return c.json({ success: false, error: 'Invalid vendorId' }, 400);
      }

      const pending = await query(
        `SELECT id, category_id, name
         FROM products
         WHERE vendor_id = $1
           AND (
             status IS NULL
             OR LOWER(TRIM(status::text)) IN ('pending', 'pending_approval', 'submit_for_approval', 'submitted')
           )`,
        [vendorId],
      );

      let approved = 0;
      let skipped = 0;
      const skippedProducts: { id: string; name: string; reason: string }[] = [];

      for (const row of pending.rows || []) {
        const pid = String(row.id || '').trim();
        const cid = row.category_id;
        if (!pid) continue;
        if (cid == null || String(cid).trim() === '') {
          skipped++;
          skippedProducts.push({
            id: pid,
            name: String(row.name || 'Product'),
            reason: 'missing category_id',
          });
          continue;
        }
        const updated = await update(
          'products',
          { id: pid },
          { status: 'active', is_active: true },
        );
        if (updated && updated.length > 0) {
          approved++;
        } else {
          skipped++;
          skippedProducts.push({
            id: pid,
            name: String(row.name || 'Product'),
            reason: 'update failed',
          });
        }
      }

      return c.json({
        success: true,
        approved,
        skipped,
        total: (pending.rows || []).length,
        skippedProducts,
        message:
          approved > 0
            ? `Approved ${approved} product${approved === 1 ? '' : 's'}`
            : 'No products were approved',
      });
    } catch (error: any) {
      console.error('Error bulk approving vendor products:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/ecommerce/categories
   * Get e-commerce categories (admin)
   */
  app.get("/admin/ecommerce/categories", async (c) => {
    try {
      const categories = await queryAdminCategories();
      const rows = (categories?.rows || []) as Record<string, unknown>[];
      const mapped = await mapCategoryRowsForPublic(rows, { includeInactive: true });

      return c.json({
        success: true,
        categories: mapped,
      });
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /admin/ecommerce/categories
   * Bulk upsert e-commerce categories (admin)
   */
  app.put("/admin/ecommerce/categories", async (c) => {
    try {
      const body = await c.req.json();
      const { categories } = body;

      if (!Array.isArray(categories)) {
        return c.json({ error: 'categories must be an array' }, 400);
      }

      for (const rawItem of categories) {
        const item = parseAdminCategoryPayloadItem(
          (rawItem && typeof rawItem === 'object' ? rawItem : {}) as Record<string, unknown>
        );

        if (!item.name) {
          return c.json({ error: 'Category name is required' }, 400);
        }

        const row: Record<string, unknown> = {
          name: item.name,
          description: item.description,
          display_order: item.display_order,
          is_active: item.is_active,
          image_url: item.image_url,
          parent_category_id: item.parent_category_id,
        };
        if (item.default_commission_rate != null) {
          row.default_commission_rate = item.default_commission_rate;
        }
        row.returns_enabled = item.returns_enabled === true;

        try {
          if (item.id && isEcommerceCategoryUuid(item.id)) {
            const updated = await update('ecommerce_categories', { id: item.id }, row);
            if (!updated?.length) {
              await insert('ecommerce_categories', { id: item.id, ...row });
            }
          } else {
            await insert('ecommerce_categories', row);
          }
        } catch (dbErr: any) {
          if (
            dbErr.code === '23505' ||
            String(dbErr.message || '').includes('ecommerce_categories_name_key')
          ) {
            return c.json(
              { error: `Category name "${item.name}" already exists`, code: 'DUPLICATE_NAME' },
              409
            );
          }
          if (
            dbErr.message?.includes('parent_category_id') &&
            (dbErr.code === '42703' || dbErr.message?.includes('does not exist'))
          ) {
            const { parent_category_id: _p, ...rowWithoutParent } = row;
            if (item.id && isEcommerceCategoryUuid(item.id)) {
              await update('ecommerce_categories', { id: item.id }, rowWithoutParent);
            } else {
              await insert('ecommerce_categories', rowWithoutParent);
            }
          } else if (dbErr.message?.includes('default_commission_rate') || dbErr.code === '42703') {
            const { default_commission_rate: _c, ...rowWithoutCommission } = row;
            if (item.id && isEcommerceCategoryUuid(item.id)) {
              await update('ecommerce_categories', { id: item.id }, rowWithoutCommission);
            } else {
              await insert('ecommerce_categories', rowWithoutCommission);
            }
          } else if (dbErr.message?.includes('returns_enabled') || dbErr.code === '42703') {
            const { returns_enabled: _r, ...rowWithoutReturns } = row;
            if (item.id && isEcommerceCategoryUuid(item.id)) {
              await update('ecommerce_categories', { id: item.id }, rowWithoutReturns);
            } else {
              await insert('ecommerce_categories', rowWithoutReturns);
            }
          } else if (dbErr.message?.includes('column "image_url"') || dbErr.code === '42703') {
            const { image_url: _img, ...rowWithoutImage } = row;
            if (item.id && isEcommerceCategoryUuid(item.id)) {
              await update('ecommerce_categories', { id: item.id }, rowWithoutImage);
            } else {
              await insert('ecommerce_categories', rowWithoutImage);
            }
          } else {
            throw dbErr;
          }
        }
      }

      const refreshed = await queryAdminCategories();

      const rows = (refreshed?.rows || []) as Record<string, unknown>[];
      const mapped = await mapCategoryRowsForPublic(rows, { includeInactive: true });

      return c.json({
        success: true,
        message: 'Categories updated',
        categories: mapped,
      });
    } catch (error: any) {
      console.error('Error updating categories:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/ecommerce/services
   * Get services with status filter (admin)
   */
  app.get("/admin/ecommerce/services", async (c) => {
    try {
      const status = c.req.query('status');
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let servicesQuery = `
        SELECT 
          s.*,
          v.business_name as vendor_name,
          v.id as vendor_id
        FROM vendor_services s
        LEFT JOIN vendors v ON s.vendor_id = v.id
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // vendor_services table uses publish_status, not status
      // pending_approval means draft or not published
      if (status === 'pending_approval') {
        servicesQuery += ` AND (s.publish_status = 'draft' OR s.publish_status IS NULL)`;
      } else if (status) {
        // Map status to publish_status values
        const statusMap: Record<string, string> = {
          'active': 'published',
          'published': 'published',
          'draft': 'draft',
          'archived': 'archived',
        };
        const publishStatus = statusMap[status] || status;
        servicesQuery += ` AND s.publish_status = $${paramIndex}`;
        params.push(publishStatus);
        paramIndex++;
      }

      servicesQuery += ` ORDER BY s.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const services = await query(servicesQuery, params);

      return c.json({
        success: true,
        services: services.rows,
        total: services.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching services:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /admin/ecommerce/service/:serviceId
   * Update service status (approve/reject)
   */
  app.put("/admin/ecommerce/service/:serviceId", async (c) => {
    try {
      const { serviceId } = c.req.param();
      const body = await c.req.json();
      const { status } = body;

      if (!status) {
        return c.json({ error: 'status is required' }, 400);
      }

      // Map status to publish_status (vendor_services uses publish_status, not status)
      const statusMap: Record<string, string> = {
        'active': 'published',
        'published': 'published',
        'draft': 'draft',
        'rejected': 'draft',
        'archived': 'archived',
      };
      const publishStatus = statusMap[status] || status;

      const updated = await update('vendor_services', { id: serviceId }, {
        publish_status: publishStatus,
        is_enabled: publishStatus === 'published'
      });

      return c.json({
        success: true,
        service: updated[0],
        message: `Service ${status === 'active' ? 'approved' : 'rejected'}`,
      });
    } catch (error: any) {
      console.error('Error updating service:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/ecommerce/commission/settings
   * Get commission settings
   */
  app.get("/admin/ecommerce/commission/settings", async (c) => {
    try {
      // Get commission settings from ecommerce_commission_settings table (migration 029)
      // Fallback to platform_settings if table doesn't exist
      let settings;
      try {
        settings = await query(
          `SELECT * FROM ecommerce_commission_settings WHERE setting_key = 'default' LIMIT 1`
        );

        if (settings.rows.length > 0) {
          const row = settings.rows[0];
          return c.json({
            success: true,
            settings: buildCommissionSettingsResponse(row),
          });
        }
      } catch (tableError: any) {
        // Table doesn't exist, try platform_settings fallback
        console.warn('[Commission] ecommerce_commission_settings table not found, using platform_settings fallback');
      }

      // Fallback to platform_settings (old KV-based approach)
      settings = await query(
        `SELECT * FROM platform_settings WHERE setting_key = 'ecommerce_commission' LIMIT 1`
      );

      const defaultSettings = {
        commissionRate: 10,
        minCommission: 0,
        maxCommission: null,
      };

      if (settings.rows.length > 0) {
        const config = typeof settings.rows[0].value === 'string'
          ? JSON.parse(settings.rows[0].value)
          : settings.rows[0].value;
        return c.json({
          success: true,
          settings: { ...defaultSettings, ...config },
        });
      }

      return c.json({
        success: true,
        settings: defaultSettings,
      });
    } catch (error: any) {
      console.error('Error fetching commission settings:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /admin/ecommerce/commission/settings
   * Update commission settings
   */
  app.put("/admin/ecommerce/commission/settings", async (c) => {
    try {
      const body = await c.req.json();
      const existing = await query(
        `SELECT * FROM ecommerce_commission_settings WHERE setting_key = 'default' LIMIT 1`
      );
      const existingRow = existing.rows[0] as Record<string, unknown> | undefined;

      const defaultRate = normalizeCommissionRate(
        body.defaultRate ?? body.commissionRate ?? existingRow?.default_rate
      );
      if (defaultRate == null) {
        return c.json({ error: 'defaultRate must be between 0 and 100' }, 400);
      }

      const existingRules =
        typeof existingRow?.rules === 'string'
          ? JSON.parse(existingRow.rules as string)
          : Array.isArray(existingRow?.rules)
            ? existingRow.rules
            : [];
      const rules = body.rules !== undefined
        ? (Array.isArray(body.rules) ? body.rules : [])
        : existingRules;
      const sellerRates = normalizeSellerRatesForResponse(
        body.sellerRates ?? body.seller_rates ?? existingRow?.seller_rates ?? {}
      );

      if (existing.rows.length > 0) {
        await query(
          `UPDATE ecommerce_commission_settings
           SET default_rate = $1, rules = $2::jsonb, seller_rates = $3::jsonb, updated_at = NOW()
           WHERE setting_key = 'default'`,
          [defaultRate, JSON.stringify(rules), JSON.stringify(sellerRates)]
        );
      } else {
        await insert('ecommerce_commission_settings', {
          setting_key: 'default',
          default_rate: defaultRate,
          rules: JSON.stringify(rules),
          seller_rates: JSON.stringify(sellerRates),
        });
      }

      const refreshed = await query(
        `SELECT * FROM ecommerce_commission_settings WHERE setting_key = 'default' LIMIT 1`
      );
      const row = refreshed.rows[0] || {
        default_rate: defaultRate,
        rules,
        seller_rates: sellerRates,
      };

      return c.json({
        success: true,
        message: 'Commission settings updated',
        settings: buildCommissionSettingsResponse(row),
      });
    } catch (error: any) {
      console.error('Error updating commission settings:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/ecommerce/commission/vendors/:vendorId
   * Vendor commission V2 config (model, rates, category matrix)
   */
  app.get("/admin/ecommerce/commission/vendors/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      if (!isValidUUID(vendorId)) {
        return c.json({ error: 'Invalid vendor ID' }, 400);
      }

      const config = await getVendorCommissionConfigResponse(vendorId);
      return c.json({ success: true, ...config });
    } catch (error: any) {
      console.error('Error fetching vendor commission:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /admin/ecommerce/commission/vendors/:vendorId
   * Update vendor commission model, rates, and category matrix
   */
  app.put("/admin/ecommerce/commission/vendors/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      if (!isValidUUID(vendorId)) {
        return c.json({ error: 'Invalid vendor ID' }, 400);
      }

      const body = await c.req.json();
      const config = await upsertVendorCommissionConfig(vendorId, body);
      return c.json({ success: true, message: 'Vendor commission updated', ...config });
    } catch (error: any) {
      console.error('Error updating vendor commission:', error);
      const status = error.message?.includes('commissionModel') ? 400 : 500;
      return c.json({ error: error.message }, status);
    }
  });

  /**
   * GET /admin/ecommerce/commission/vendors/:vendorId/products-without-ownership
   * Guardrail: products missing listing_ownership for ownership commission model.
   */
  app.get('/admin/ecommerce/commission/vendors/:vendorId/products-without-ownership', async (c) => {
    try {
      const { vendorId } = c.req.param();
      if (!isValidUUID(vendorId)) {
        return c.json({ error: 'Invalid vendor ID' }, 400);
      }
      const count = await countProductsWithoutListingOwnership(vendorId);
      return c.json({ success: true, vendorId, count });
    } catch (error: any) {
      console.error('Error counting products without ownership:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /admin/ecommerce/commission/orders/:orderId/re-resolve
   * Force re-resolve commission using current vendor/product config.
   */
  app.post('/admin/ecommerce/commission/orders/:orderId/re-resolve', async (c) => {
    try {
      const { orderId } = c.req.param();
      if (!isValidUUID(orderId)) {
        return c.json({ error: 'Invalid order ID' }, 400);
      }

      const body = await c.req.json().catch(() => ({}));
      const force = Boolean(body?.force);

      const orderRes = await query(
        `SELECT vendor_id::text FROM orders WHERE id = $1::uuid LIMIT 1`,
        [orderId]
      );
      const vendorId = orderRes.rows?.[0]?.vendor_id;
      if (!vendorId) {
        return c.json({ error: 'Order not found or missing vendor' }, 404);
      }

      const result = await forceApplyOrderCommissionAudit(orderId, String(vendorId));
      if (!result) {
        return c.json({ error: 'Commission re-resolve failed' }, 500);
      }

      const ledger = await syncEcommerceOrderSettlementLedgerRow(orderId, { force });

      return c.json({
        success: true,
        orderId,
        previous: result.previous,
        current: result.current,
        ledger,
      });
    } catch (error: any) {
      console.error('Error re-resolving order commission:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/ecommerce/commission/products/:productId
   * Read product-level commission override (highest priority in resolution chain).
   */
  app.get('/admin/ecommerce/commission/products/:productId', async (c) => {
    try {
      const { productId } = c.req.param();
      if (!isValidUUID(productId)) {
        return c.json({ error: 'Invalid product ID' }, 400);
      }
      const result = await query(
        `SELECT product_id::text, commission_rate, is_active, created_at, updated_at
         FROM product_commission_overrides WHERE product_id = $1::uuid LIMIT 1`,
        [productId]
      );
      return c.json({ success: true, override: result.rows[0] ?? null });
    } catch (error: any) {
      console.error('Error fetching product commission override:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /admin/ecommerce/commission/products/:productId
   * Set or update product-level commission override.
   * Pass { commissionRate: number } — a value of null or omission disables the override.
   */
  app.put('/admin/ecommerce/commission/products/:productId', async (c) => {
    try {
      const { productId } = c.req.param();
      if (!isValidUUID(productId)) {
        return c.json({ error: 'Invalid product ID' }, 400);
      }
      const body = await c.req.json();

      if (body.commissionRate === null || body.commission_rate === null) {
        // Disable the override (soft delete — keeps audit trail)
        await query(
          `UPDATE product_commission_overrides
           SET is_active = false, updated_at = NOW()
           WHERE product_id = $1::uuid`,
          [productId]
        );
        return c.json({ success: true, message: 'Product commission override disabled' });
      }

      const rate = normalizeCommissionRate(body.commissionRate ?? body.commission_rate);
      if (rate == null) {
        return c.json({ error: 'commissionRate must be a number between 0 and 100' }, 400);
      }

      await query(
        `INSERT INTO product_commission_overrides
           (product_id, commission_rate, is_active, created_at, updated_at)
         VALUES ($1::uuid, $2, true, NOW(), NOW())
         ON CONFLICT (product_id) DO UPDATE
           SET commission_rate = EXCLUDED.commission_rate,
               is_active = true,
               updated_at = NOW()`,
        [productId, rate]
      );
      return c.json({ success: true, message: 'Product commission override saved', commissionRate: rate });
    } catch (error: any) {
      console.error('Error updating product commission override:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /admin/ecommerce/categories/:categoryId/commission
   * Update the default commission rate for an ecommerce category.
   * This is the fallback rate used when no vendor-level or product-level override exists.
   */
  app.put('/admin/ecommerce/categories/:categoryId/commission', async (c) => {
    try {
      const { categoryId } = c.req.param();
      if (!isValidUUID(categoryId)) {
        return c.json({ error: 'Invalid category ID' }, 400);
      }
      const body = await c.req.json();
      const rate = normalizeCommissionRate(body.commissionRate ?? body.commission_rate);
      if (rate == null) {
        return c.json({ error: 'commissionRate must be a number between 0 and 100' }, 400);
      }
      const result = await query(
        `UPDATE ecommerce_categories
         SET default_commission_rate = $1, updated_at = NOW()
         WHERE id = $2::uuid
         RETURNING id::text, name, default_commission_rate`,
        [rate, categoryId]
      );
      if (!result.rows.length) {
        return c.json({ error: 'Category not found' }, 404);
      }
      return c.json({ success: true, message: 'Category commission rate updated', category: result.rows[0] });
    } catch (error: any) {
      console.error('Error updating category commission rate:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/vendor/list
   * Get all e-commerce sellers only
   * Filters for e-commerce sellers based on role and seller_status
   */
  app.get("/admin/vendor/list", async (c) => {
    try {
      const vendors = await query(
        `SELECT 
          v.*,
          r.id as role_id,
          r.name as role_name,
          r.display_name as role_display_name,
          COALESCE(pc_total.product_count, 0) as product_count,
          COALESCE(pc_active.active_product_count, 0) as active_product_count
        FROM vendors v
        LEFT JOIN roles r ON v.role_id = r.id
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS product_count
          FROM products p
          WHERE p.vendor_id = v.id
        ) pc_total ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS active_product_count
          FROM products p
          WHERE p.vendor_id = v.id
            AND p.is_active = true
            AND LOWER(COALESCE(NULLIF(TRIM(p.status::text), ''), 'pending')) = 'active'
        ) pc_active ON true
        WHERE (v.status = 'active' OR v.is_active = true)
          AND (v.is_deleted IS NULL OR v.is_deleted = false)
          AND (
            r.name = 'pet_product' OR 
            r.name = 'pet_products_store' OR 
            r.name = 'product_seller' OR 
            r.name = 'pet_product_seller' OR
            r.name = 'seller' OR
            (v.seller_status IS NOT NULL AND v.seller_status != 'not_applied')
          )
        ORDER BY v.created_at DESC`
      );

      return c.json({
        success: true,
        data: {
          vendors: vendors.rows,
        },
        vendors: vendors.rows, // Also include at top level for compatibility
      });
    } catch (error: any) {
      console.error('Error fetching vendor list:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /ecommerce/vendors/list
   * Get all e-commerce sellers only
   * Filters for e-commerce sellers based on role and seller_status
   */
  app.get("/ecommerce/vendors/list", async (c) => {
    try {
      const vendors = await query(
        `SELECT 
          v.*,
          r.id as role_id,
          r.name as role_name,
          r.display_name as role_display_name,
          COALESCE(pc_total.product_count, 0) as product_count,
          COALESCE(pc_active.active_product_count, 0) as active_product_count
        FROM vendors v
        LEFT JOIN roles r ON v.role_id = r.id
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS product_count
          FROM products p
          WHERE p.vendor_id = v.id
        ) pc_total ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS active_product_count
          FROM products p
          WHERE p.vendor_id = v.id
            AND p.is_active = true
            AND LOWER(COALESCE(NULLIF(TRIM(p.status::text), ''), 'pending')) = 'active'
        ) pc_active ON true
        WHERE (v.status = 'active' OR v.is_active = true)
          AND (v.is_deleted IS NULL OR v.is_deleted = false)
          AND (
            r.name = 'pet_product' OR 
            r.name = 'pet_products_store' OR 
            r.name = 'product_seller' OR 
            r.name = 'pet_product_seller' OR
            r.name = 'seller' OR
            (v.seller_status IS NOT NULL AND v.seller_status != 'not_applied')
          )
        ORDER BY v.created_at DESC`
      );

      return c.json({
        success: true,
        vendors: vendors.rows,
      });
    } catch (error: any) {
      console.error('Error fetching e-commerce vendors list:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /ecommerce/vendors/:vendorId
   * Seller profile with product and order stats (admin seller detail view)
   */
  app.get("/ecommerce/vendors/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      if (!vendorId) {
        return c.json({ error: 'Vendor ID is required' }, 400);
      }

      const result = await query(
        `SELECT 
          v.*,
          r.id as role_id,
          r.name as role_name,
          r.display_name as role_display_name,
          COALESCE(pc_total.product_count, 0) as product_count,
          COALESCE(pc_active.active_product_count, 0) as active_product_count,
          COALESCE(rev_stats.total_revenue, 0) as total_revenue,
          COALESCE(rev_stats.total_orders, 0) as total_orders,
          COALESCE(rev_stats.pending_orders, 0) as pending_orders
        FROM vendors v
        LEFT JOIN roles r ON v.role_id = r.id
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS product_count
          FROM products p
          WHERE p.vendor_id = v.id
        ) pc_total ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS active_product_count
          FROM products p
          WHERE p.vendor_id = v.id
            AND p.is_active = true
            AND LOWER(COALESCE(NULLIF(TRIM(p.status::text), ''), 'pending')) = 'active'
        ) pc_active ON true
        LEFT JOIN LATERAL (
          SELECT 
            COALESCE(SUM(o.total_amount) FILTER (WHERE o.order_status = 'delivered'), 0) as total_revenue,
            COUNT(o.id) FILTER (WHERE o.order_status = 'delivered')::int as total_orders,
            COUNT(o.id) FILTER (
              WHERE o.order_status IN ('pending', 'confirmed', 'processing', 'shipped')
            )::int as pending_orders
          FROM orders o
          WHERE o.vendor_id = v.id
        ) rev_stats ON true
        WHERE v.id = $1
          AND (v.is_deleted IS NULL OR v.is_deleted = false)`,
        [vendorId]
      );

      if (!result.rows.length) {
        return c.json({ error: 'Seller not found' }, 404);
      }

      return c.json({
        success: true,
        vendor: result.rows[0],
      });
    } catch (error: any) {
      console.error('Error fetching e-commerce vendor details:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
 * GET /admin/ecommerce/top-sellers
 * Get top performing e-commerce sellers (admin dashboard)
 * Filters for e-commerce sellers only based on role and seller_status
 */
  app.get("/admin/ecommerce/top-sellers", async (c) => {
    try {
      const limit = parseInt(c.req.query('limit') || '5', 10);

      let topSellers;
      try {
        topSellers = await query(`
            SELECT 
              v.id,
              v.business_name as name,
              v.business_name,
              v.owner_name,
              v.email,
              v.phone,
              COALESCE(SUM(o.total_amount) FILTER (WHERE o.order_status = 'delivered'), 0) as total_revenue,
              COUNT(o.id) FILTER (WHERE o.order_status = 'delivered') as total_bookings,
              COUNT(DISTINCT p.id) FILTER (
                WHERE p.is_active = true
                  AND LOWER(COALESCE(NULLIF(TRIM(p.status::text), ''), 'pending')) = 'active'
              ) as product_count,
              COALESCE(AVG(rev.rating), 0) as avg_rating
            FROM vendors v
            INNER JOIN roles r ON v.role_id = r.id
            INNER JOIN orders o ON v.id = o.vendor_id AND o.order_status = 'delivered'
            LEFT JOIN reviews rev ON v.id = rev.vendor_id
            LEFT JOIN products p ON v.id = p.vendor_id
              AND p.is_active = true
              AND LOWER(COALESCE(NULLIF(TRIM(p.status::text), ''), 'pending')) = 'active'
            WHERE (v.status = 'active' OR v.is_active = true)
              AND (v.is_deleted IS NULL OR v.is_deleted = false)
              AND (
                r.name = 'pet_product' OR 
                r.name = 'pet_products_store' OR 
                r.name = 'product_seller' OR 
                r.name = 'pet_product_seller' OR
                r.name = 'seller' OR
                (v.seller_status IS NOT NULL AND v.seller_status != 'not_applied')
              )
            GROUP BY v.id, v.business_name, v.owner_name, v.email, v.phone
            HAVING SUM(o.total_amount) FILTER (WHERE o.order_status = 'delivered') > 0
            ORDER BY total_revenue DESC
            LIMIT $1
          `, [limit]);
      } catch (error: any) {
        console.error('Error fetching top e-commerce sellers:', error);
        topSellers = { rows: [] };
      }

      return c.json({
        success: true,
        sellers: topSellers.rows || [],
        topSellers: topSellers.rows || []
      });
    } catch (error: any) {
      console.error('Error fetching top e-commerce sellers:', error);
      return c.json({
        success: true,
        sellers: [],
        topSellers: []
      });
    }
  });

}

