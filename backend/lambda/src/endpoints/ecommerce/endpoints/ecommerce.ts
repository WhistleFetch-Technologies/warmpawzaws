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
import { randomUUID } from 'crypto';
import { select, insert, update, query, upsert } from '../../../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import {
  getTemporaryVendorSuppressionParams,
  sqlExcludeSuppressedSettlementRows,
} from '../../../utils/temporary-vendor-ui-suppression';
import { isValidUUID } from '../../../types/entities';
import { prepareStorefrontProductRow, prepareStorefrontProductRows, presignProductSkusForDisplay, presignProductImagesJsonb } from '../../../utils/s3-media-presign';
import { loadProductSkus, loadProductSkusForProducts } from '../../../utils/product-sku-service';
import {
  resolveEcommerceOrderLine,
  decrementSkuStock,
} from '../../../utils/product-sku-order';
import { assertProductDeliverableToCity } from '../../../utils/product-delivery-regions';
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
  discountsWithinTolerance,
  normalizePromotionRow,
  type CartLineItem,
} from '../../../utils/vendor-promotion-engine';
import { countPriorVendorOrders, recordVendorPromotionUsage } from '../../../utils/vendor-promotion-usage';
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
} from '../../../utils/ecommerce-commission-admin';

const ADMIN_CATEGORY_SELECT = `
  SELECT id::text AS id, name, description, display_order, is_active, image_url,
         default_commission_rate, created_at
  FROM ecommerce_categories
  ORDER BY display_order ASC, name ASC`;

const ADMIN_CATEGORY_SELECT_NO_IMAGE = `
  SELECT id::text AS id, name, description, display_order, is_active, created_at,
         default_commission_rate
  FROM ecommerce_categories
  ORDER BY display_order ASC, name ASC`;

const ADMIN_CATEGORY_SELECT_LEGACY = `
  SELECT id::text AS id, name, description, display_order, is_active, image_url, created_at
  FROM ecommerce_categories
  ORDER BY display_order ASC, name ASC`;

async function queryAdminCategories() {
  try {
    return await query(ADMIN_CATEGORY_SELECT);
  } catch (dbError: any) {
    if (dbError.message?.includes('default_commission_rate') || dbError.code === '42703') {
      try {
        return await query(ADMIN_CATEGORY_SELECT_NO_IMAGE);
      } catch (inner: any) {
        if (inner.message?.includes('column "image_url"') || inner.code === '42703') {
          return await query(
            `SELECT id::text AS id, name, description, display_order, is_active, created_at
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

/** Only admin-approved products appear on the public storefront (see products.status + is_active). */
const STOREFRONT_PRODUCT_SQL = `
  p.is_active = true
  AND LOWER(COALESCE(NULLIF(TRIM(p.status::text), ''), 'pending')) = 'active'
`;

/** Hide products tied to admin-disabled ecommerce categories. */
const STOREFRONT_ACTIVE_CATEGORY_SQL = `
  AND (
    p.category_id IS NULL
    OR EXISTS (
      SELECT 1 FROM ecommerce_categories ec
      WHERE ec.id = p.category_id AND ec.is_active = true
    )
  )
`;

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

/** Presign product rows and apply SKU listing pricing for variant products (single batch query). */
async function enrichStorefrontProductListRows(
  rows: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const signed = await prepareStorefrontProductRows(rows);
  const ids = signed.map((r) => String(r.id ?? '')).filter(Boolean);
  const skuMap = await loadProductSkusForProducts(ids);
  return signed.map((row) => {
    const pid = String(row.id ?? '');
    const skus = skuMap.get(pid) ?? [];
    if (skus.length === 0) return row;
    return applyStorefrontSkuPricingFields(row, skus);
  });
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

      const products = await query(
        `SELECT p.*, v.business_name as vendor_name, v.city as vendor_city
         FROM products p
         LEFT JOIN vendors v ON p.vendor_id = v.id
         WHERE p.id = $1 AND ${STOREFRONT_PRODUCT_SQL}${STOREFRONT_ACTIVE_CATEGORY_SQL}`,
        [productId]
      );

      if (products.rows.length === 0) {
        return c.json({ error: 'Product not found' }, 404);
      }

      const row = products.rows[0] as Record<string, unknown>;
      const product = await prepareStorefrontProductRow(row);

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

      return c.json({
        success: true,
        product,
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

      let productQuery = `
        SELECT p.*, v.business_name as vendor_name
        FROM products p
        LEFT JOIN vendors v ON p.vendor_id = v.id
        WHERE ${STOREFRONT_PRODUCT_SQL}${STOREFRONT_ACTIVE_CATEGORY_SQL}
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
      const signedProducts = await enrichStorefrontProductListRows(rows);

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
   * Public endpoint for customer shop - alias for /products
   */
  app.get("/ecommerce/products", async (c) => {
    try {
      const vendorId = c.req.query('vendorId');
      const category = c.req.query('category');
      const search = c.req.query('search');
      const featuredOnly =
        c.req.query('featured') === 'true' || c.req.query('featured') === '1';
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let productQuery = `
        SELECT p.*, v.business_name as vendor_name
        FROM products p
        LEFT JOIN vendors v ON p.vendor_id = v.id
        WHERE ${STOREFRONT_PRODUCT_SQL}${STOREFRONT_ACTIVE_CATEGORY_SQL}
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (featuredOnly) {
        productQuery += ` AND COALESCE(p.is_featured, false) = true`;
      }

      if (vendorId) {
        productQuery += ` AND p.vendor_id = $${paramIndex}`;
        params.push(vendorId);
        paramIndex++;
      }

      if (category) {
        if (isValidUUID(category)) {
          productQuery += ` AND p.category_id = $${paramIndex}::uuid`;
        } else {
          productQuery += ` AND LOWER(TRIM(COALESCE(p.category, ''))) = LOWER(TRIM($${paramIndex}))`;
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
      const signedProducts = await enrichStorefrontProductListRows(rows);

      return c.json({
        success: true,
        products: signedProducts,
        total: signedProducts.length,
      });
    } catch (error: any) {
      console.error('Error fetching ecommerce products:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /ecommerce/products/:productId
   * Same as GET /products/:productId — customer shop and wishlist use this path.
   */
  app.get("/ecommerce/products/:productId", (c) =>
    handleGetPublicProductById(c, '[ecommerce/products/:productId]')
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
      const paymentMethod = orderData.payment_method || orderData.paymentMethod || 'cod';
      const couponCode = orderData.coupon_code || orderData.couponCode;

      if (!customerPhone || !items || items.length === 0) {
        return c.json({ error: 'customer_phone and items are required' }, 400);
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

      const cartLines: CartLineItem[] = orderItems.map((oi) => {
        const raw = items.find(
          (it: Record<string, unknown>) =>
            String(it.productId || it.product_id || '') === String(oi.product_id)
        );
        return {
          productId: String(oi.product_id),
          quantity: oi.quantity,
          price: oi.unit_price,
          category:
            raw?.categoryId || raw?.category
              ? String(raw.categoryId || raw.category)
              : undefined,
          categoryId:
            raw?.categoryId || raw?.category
              ? String(raw.categoryId || raw.category)
              : undefined,
        };
      });

      let serverPromoDiscount = 0;
      let appliedPromotionId: string | null = promoId ? String(promoId) : null;

      if (
        firstVendorId &&
        (couponCode || promoId || (Number(bodyDiscount) > 0 && cartLines.length > 0))
      ) {
        try {
          const promosRes = await query(
            `SELECT * FROM vendor_promotions
             WHERE vendor_id = $1::uuid
               AND is_active = true
               AND start_date <= NOW()
               AND end_date >= NOW()`,
            [firstVendorId]
          );
          const promos = (promosRes.rows || []).map((row: Record<string, unknown>) =>
            normalizePromotionRow(row)
          );
          const priorVendorOrderCount =
            customerId && firstVendorId
              ? await countPriorVendorOrders(String(customerId), String(firstVendorId))
              : 0;

          const autoResult = calculateBestCartPromotion(promos, cartLines, {
            vendorId: String(firstVendorId),
            customerId: customerId ? String(customerId) : undefined,
            priorVendorOrderCount,
          });

          const codeResult = couponCode
            ? calculateBestCartPromotion(promos, cartLines, {
                vendorId: String(firstVendorId),
                customerId: customerId ? String(customerId) : undefined,
                priorVendorOrderCount,
                manualCode: String(couponCode).trim(),
              })
            : null;

          const autoDiscount = autoResult.bestPromotion?.discountAmount ?? 0;
          const codeDiscount = codeResult?.bestPromotion?.discountAmount ?? 0;
          serverPromoDiscount = Math.max(autoDiscount, codeDiscount);
          const bestEval =
            codeDiscount >= autoDiscount
              ? codeResult?.bestPromotion
              : autoResult.bestPromotion;
          if (bestEval) {
            appliedPromotionId = bestEval.promotionId;
          }

          if (Number(bodyDiscount) > 0) {
            if (
              serverPromoDiscount === 0 ||
              !discountsWithinTolerance(serverPromoDiscount, Number(bodyDiscount))
            ) {
              return c.json({ error: 'Promotion discount mismatch' }, 400);
            }
          }
        } catch (promoErr) {
          console.warn('[ecommerce/orders] promotion validation skipped:', promoErr);
        }
      }

      const discountAmount =
        serverPromoDiscount > 0
          ? serverPromoDiscount
          : bodyDiscount != null && Number.isFinite(Number(bodyDiscount)) && Number(bodyDiscount) >= 0
            ? Number(bodyDiscount)
            : 0;
      const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);
      const shippingAmount =
        bodyShipping != null && Number.isFinite(Number(bodyShipping))
          ? Number(bodyShipping)
          : computeEcommerceDeliveryFee(subtotalAfterDiscount);
      const taxAmount =
        bodyTax != null && Number.isFinite(Number(bodyTax)) && Number(bodyTax) >= 0
          ? Number(bodyTax)
          : subtotal * 0.18;
      const cgstAmount =
        bodyCgst != null && Number.isFinite(Number(bodyCgst)) ? Number(bodyCgst) : null;
      const sgstAmount =
        bodySgst != null && Number.isFinite(Number(bodySgst)) ? Number(bodySgst) : null;
      const igstAmount =
        bodyIgst != null && Number.isFinite(Number(bodyIgst)) ? Number(bodyIgst) : null;
      const recomputedTotal = subtotal + shippingAmount + taxAmount - discountAmount;
      const totalAmount =
        bodyTotal != null && Number.isFinite(Number(bodyTotal)) && Number(bodyTotal) > 0
          ? Number(bodyTotal)
          : recomputedTotal;

      const normalizedAddress = {
        name: shippingAddress.name || '',
        phone: shippingAddress.phone || customerPhone,
        line1: shippingAddress.line1 || shippingAddress.addressLine1 || '',
        city: shippingAddress.city || '',
        state: shippingAddress.state || '',
        pincode: shippingAddress.pincode || '',
      };

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
        couponCode: couponCode || null,
      };

      const order: Record<string, unknown> = {
        id: orderId,
        order_number: orderNumber,
        customer_id: customerId,
        vendor_id: firstVendorId,
        order_status: 'pending',
        payment_status: 'pending',
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

      const normalizedTaxBreakdown = normalizeTaxBreakdownForDb(taxBreakdown);
      if (normalizedTaxBreakdown) {
        order.tax_breakdown = normalizedTaxBreakdown;
      }
      if (cgstAmount != null) order.cgst_amount = cgstAmount;
      if (sgstAmount != null) order.sgst_amount = sgstAmount;
      if (igstAmount != null) order.igst_amount = igstAmount;

      await insert('orders', order);
      for (const item of orderItems) {
        await insert('order_items', {
          order_id: orderId,
          product_id: item.product_id,
          product_sku_id: item.product_sku_id ?? null,
          name: item.product_name || 'Product',
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total,
          variant_info: item.variant_info ?? null,
        });
        if (item.skuRowIdForStock) {
          await decrementSkuStock(item.skuRowIdForStock, item.quantity);
        }
      }

      if (appliedPromotionId && discountAmount > 0) {
        try {
          await recordVendorPromotionUsage({
            promotionId: appliedPromotionId,
            orderId,
            customerId: customerId ? String(customerId) : null,
            discountAmount,
            orderSubtotal: subtotal,
          });
        } catch (usageErr) {
          console.warn('[ecommerce/orders] promotion usage record failed:', usageErr);
        }
      }

      return c.json({
        success: true,
        customerId,
        totalAmount,
        isFirstPlatformProductOrder: priorOrderCount === 0,
        containsPetFood,
        appliedPromotion: appliedPromotionId
          ? { id: appliedPromotionId, discountAmount, type: 'vendor' }
          : undefined,
        order: {
          id: orderId,
          order_number: orderNumber,
          status: 'pending',
          total: totalAmount,
          items: orderItems,
          shipping_address: shippingAddress,
          payment_method: paymentMethod,
          created_at: order.created_at,
        },
        message: 'Order placed successfully!',
      });
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
   * GET /ecommerce/categories
   * Get e-commerce product categories
   */
  app.get("/ecommerce/categories", async (c) => {
    try {
      let categories;
      try {
        categories = await query(
          `SELECT id::text AS id, name, description, display_order, is_active, image_url, created_at
           FROM ecommerce_categories
           WHERE is_active = true
           ORDER BY display_order ASC, name ASC`
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
        if (dbError.message?.includes('column "image_url"') || dbError.code === '42703') {
          categories = await query(
            `SELECT id::text AS id, name, description, display_order, is_active, created_at
             FROM ecommerce_categories
             WHERE is_active = true
             ORDER BY display_order ASC, name ASC`
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
  });

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

      const cartItems = await query(
        `SELECT ci.*, p.name as product_name, p.price, p.images, v.business_name as vendor_name
         FROM cart_items ci
         INNER JOIN products p ON ci.product_id = p.id
         LEFT JOIN vendors v ON p.vendor_id = v.id
         WHERE ci.customer_id = $1
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

      const [
        revenueStats,
        sellerStats,
        activeProductsRow,
        pendingApprovalsRow,
        processingOrdersRow,
        settlementAggRow,
      ] = await Promise.all([
        query(
          `SELECT 
           COUNT(*) as total_orders,
           COALESCE(SUM(total_amount) FILTER (WHERE order_status = 'delivered'), 0) as total_revenue,
           COALESCE(SUM(total_amount) FILTER (WHERE order_status = 'delivered' AND created_at >= DATE_TRUNC('month', CURRENT_DATE)), 0) as this_month_revenue
         FROM orders`
        ).catch(() => ({ rows: [{}] })),
        query(
          `SELECT 
           COUNT(DISTINCT v.id) FILTER (WHERE 
             v.is_active = true 
             AND (v.is_deleted IS NULL OR v.is_deleted = false)
             AND (
               r.name = 'pet_product' OR 
               r.name = 'pet_products_store' OR 
               r.name = 'product_seller' OR 
               r.name = 'pet_product_seller' OR
               r.name = 'seller' OR
               (v.seller_status IS NOT NULL AND v.seller_status != 'not_applied')
             )
           ) as active_sellers,
           COUNT(DISTINCT v.id) FILTER (WHERE 
             (v.is_deleted IS NULL OR v.is_deleted = false)
             AND (
               r.name = 'pet_product' OR 
               r.name = 'pet_products_store' OR 
               r.name = 'product_seller' OR 
               r.name = 'pet_product_seller' OR
               r.name = 'seller' OR
               (v.seller_status IS NOT NULL AND v.seller_status != 'not_applied')
             )
           ) as total_sellers
         FROM vendors v
         LEFT JOIN roles r ON v.role_id = r.id`
        ).catch(() => ({ rows: [{}] })),
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
           WHERE o.order_status IN ('confirmed', 'processing', 'shipped')`
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
      const activeProducts = parseInt(String(activeProductsRow.rows[0]?.c ?? '0'), 10) || 0;
      const pendingApprovals = parseInt(String(pendingApprovalsRow.rows[0]?.c ?? '0'), 10) || 0;
      const processingOrders = parseInt(String(processingOrdersRow.rows[0]?.c ?? '0'), 10) || 0;
      const settlementRow = settlementAggRow.rows[0] || {};
      const pendingSettlements = parseInt(String(settlementRow.pending_count ?? '0'), 10) || 0;
      const pendingSettlementAmount = parseFloat(String(settlementRow.pending_amount ?? '0')) || 0;

      return c.json({
        success: true,
        data: {
          totalRevenue,
          totalGMV: totalRevenue,
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
      const days = parseInt(c.req.query('days') || '30', 10);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get revenue analytics
      const revenueStats = await query(
        `SELECT 
           DATE(created_at) as date,
           COUNT(*) as order_count,
           COALESCE(SUM(total_amount) FILTER (WHERE order_status = 'delivered'), 0) as revenue
         FROM orders
         WHERE created_at >= $1
         GROUP BY DATE(created_at)
         ORDER BY date DESC`,
        [startDate.toISOString()]
      );

      // Get top products
      const topProducts = await query(
        `SELECT 
           p.name,
           COUNT(oi.id) as sales,
           COALESCE(SUM(oi.total_price), 0) as revenue
         FROM order_items oi
         INNER JOIN products p ON oi.product_id = p.id
         INNER JOIN orders o ON oi.order_id = o.id
         WHERE o.created_at >= $1 AND o.order_status = 'delivered'
         GROUP BY p.id, p.name
         ORDER BY sales DESC
         LIMIT 10`,
        [startDate.toISOString()]
      );

      // Get e-commerce seller stats
      const sellerStats = await query(
        `SELECT 
           COUNT(DISTINCT v.id) FILTER (WHERE 
             v.is_active = true 
             AND (v.is_deleted IS NULL OR v.is_deleted = false)
             AND (
               r.name = 'pet_product' OR 
               r.name = 'pet_products_store' OR 
               r.name = 'product_seller' OR 
               r.name = 'pet_product_seller' OR
               r.name = 'seller' OR
               (v.seller_status IS NOT NULL AND v.seller_status != 'not_applied')
             )
           ) as active_sellers,
           COUNT(DISTINCT v.id) FILTER (WHERE 
             (v.is_deleted IS NULL OR v.is_deleted = false)
             AND (
               r.name = 'pet_product' OR 
               r.name = 'pet_products_store' OR 
               r.name = 'product_seller' OR 
               r.name = 'pet_product_seller' OR
               r.name = 'seller' OR
               (v.seller_status IS NOT NULL AND v.seller_status != 'not_applied')
             )
           ) as total_sellers
         FROM vendors v
         LEFT JOIN roles r ON v.role_id = r.id`
      );

      // Get top sellers by revenue (only vendors with actual sales)
      const topSellers = await query(
        `SELECT 
           v.id,
           v.business_name as name,
           COALESCE(SUM(o.total_amount) FILTER (WHERE o.order_status = 'delivered' AND o.created_at >= $1), 0) as revenue,
           COUNT(o.id) FILTER (WHERE o.order_status = 'delivered' AND o.created_at >= $1) as orders
         FROM vendors v
         INNER JOIN roles r ON v.role_id = r.id
         INNER JOIN orders o ON v.id = o.vendor_id AND o.order_status = 'delivered' AND o.created_at >= $1
         WHERE (v.is_deleted IS NULL OR v.is_deleted = false)
           AND (
             r.name = 'pet_product' OR 
             r.name = 'pet_products_store' OR 
             r.name = 'product_seller' OR 
             r.name = 'pet_product_seller' OR
             r.name = 'seller' OR
             (v.seller_status IS NOT NULL AND v.seller_status != 'not_applied')
           )
         GROUP BY v.id, v.business_name
         HAVING SUM(o.total_amount) FILTER (WHERE o.order_status = 'delivered' AND o.created_at >= $1) > 0
         ORDER BY revenue DESC
         LIMIT 10`,
        [startDate.toISOString()]
      );

      const totalRevenue = revenueStats.rows.reduce((sum: number, row: any) => sum + parseFloat(row.revenue || '0'), 0);
      const totalOrders = revenueStats.rows.reduce((sum: number, row: any) => sum + parseInt(row.order_count || '0', 10), 0);

      return c.json({
        success: true,
        data: {
          revenue: revenueStats.rows,
          topProducts: topProducts.rows,
          topSellers: topSellers.rows,
          totalRevenue,
          totalOrders,
          activeSellers: parseInt(sellerStats.rows[0]?.active_sellers || '0', 10),
          totalSellers: parseInt(sellerStats.rows[0]?.total_sellers || '0', 10),
        },
      });
    } catch (error: any) {
      console.error('Error fetching analytics:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/ecommerce/orders
   * Get all marketplace orders (admin)
   */
  app.get("/admin/ecommerce/orders", async (c) => {
    try {
      const status = c.req.query('status');
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let ordersQuery = `
        SELECT 
          o.*,
          c.full_name as customer_name,
          c.phone as customer_phone,
          v.business_name as vendor_name
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN vendors v ON o.vendor_id = v.id
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (status) {
        ordersQuery += ` AND o.order_status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      ordersQuery += ` ORDER BY o.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const orders = await query(ordersQuery, params);

      return c.json({
        success: true,
        orders: orders.rows,
        total: orders.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      return c.json({ error: error.message }, 500);
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

  /**
   * PUT /admin/ecommerce/product/:productId
   * Update product status (approve/reject)
   */
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
        };
        if (item.default_commission_rate != null) {
          row.default_commission_rate = item.default_commission_rate;
        }

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
          if (dbErr.message?.includes('default_commission_rate') || dbErr.code === '42703') {
            const { default_commission_rate: _c, ...rowWithoutCommission } = row;
            if (item.id && isEcommerceCategoryUuid(item.id)) {
              await update('ecommerce_categories', { id: item.id }, rowWithoutCommission);
            } else {
              await insert('ecommerce_categories', rowWithoutCommission);
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

