/**
 * ============================================================================
 * RECOMMENDATIONS ENGINE
 * ============================================================================
 * 
 * Features:
 * - "Customers who bought this also bought" (order affinity analysis)
 * - Frequently bought together
 * - Recently viewed products
 * - Trending/Popular products
 * - Personalized recommendations
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, select, insert, update } from '../database/rds-connection';
import {
  normalizeProductImagesField,
  prepareStorefrontProductRow,
} from '../utils/s3-media-presign';

function preparedImagesToUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return normalizeProductImagesField(raw);
  }
  return raw
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const o = item as Record<string, unknown>;
        for (const k of ['url', 'src', 'image_url'] as const) {
          if (typeof o[k] === 'string' && (o[k] as string).trim()) {
            return (o[k] as string).trim();
          }
        }
      }
      return '';
    })
    .filter(Boolean);
}

/** Presign S3 product images and map to storefront recommendation shape (camelCase + snake_case for mappers). */
async function formatRecommendationProduct(
  row: Record<string, unknown>,
  extras?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const prepared = await prepareStorefrontProductRow(row);
  const images = preparedImagesToUrls(prepared.images);
  const compareAt = prepared.compare_at_price;

  return {
    id: prepared.id,
    name: prepared.name,
    description: prepared.description,
    price: parseFloat(String(prepared.price ?? 0)),
    compareAtPrice:
      compareAt != null && compareAt !== '' ? parseFloat(String(compareAt)) : null,
    compare_at_price: compareAt,
    images,
    rating: parseFloat(String(prepared.rating ?? 0)) || 0,
    reviewCount: parseInt(String(prepared.review_count ?? 0), 10) || 0,
    review_count: prepared.review_count,
    category: prepared.category,
    categoryId: prepared.category_id,
    category_id: prepared.category_id,
    vendorName: prepared.vendor_name,
    vendor_name: prepared.vendor_name,
    vendor_id: prepared.vendor_id,
    stock: prepared.stock ?? prepared.stock_quantity,
    stock_quantity: prepared.stock_quantity,
    ...extras,
  };
}

async function formatRecommendationProducts(
  rows: Record<string, unknown>[],
  extrasFn?: (row: Record<string, unknown>) => Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
  return Promise.all(
    rows.map((row) => formatRecommendationProduct(row, extrasFn?.(row))),
  );
}

export function registerRecommendationEndpoints(app: Hono) {

  // ============================================================================
  // CUSTOMERS WHO BOUGHT THIS ALSO BOUGHT
  // ============================================================================

  app.get('/products/:productId/also-bought', async (c) => {
    try {
      const productId = c.req.param('productId');
      const limit = parseInt(c.req.query('limit') || '6');

      // Find products that appear in the same orders as the given product
      const alsoBoughtQuery = `
        WITH product_orders AS (
          -- Get all orders containing this product
          SELECT DISTINCT oi.order_id
          FROM order_items oi
          WHERE oi.product_id = $1
        ),
        co_purchased AS (
          -- Find other products in those orders
          SELECT 
            oi.product_id,
            COUNT(DISTINCT oi.order_id) as purchase_count
          FROM order_items oi
          JOIN product_orders po ON oi.order_id = po.order_id
          WHERE oi.product_id != $1
          GROUP BY oi.product_id
          HAVING COUNT(DISTINCT oi.order_id) >= 2
          ORDER BY purchase_count DESC
          LIMIT $2
        )
        SELECT 
          p.id,
          p.name,
          p.description,
          p.price,
          p.compare_at_price,
          p.images,
          p.metadata,
          p.rating,
          p.review_count,
          p.category,
          p.category_id,
          p.vendor_id,
          p.stock,
          cp.purchase_count,
          v.business_name as vendor_name
        FROM co_purchased cp
        JOIN products p ON cp.product_id = p.id
        LEFT JOIN vendors v ON p.vendor_id = v.id
        WHERE p.is_active = true AND p.stock > 0
        ORDER BY cp.purchase_count DESC
      `;

      const results = await query(alsoBoughtQuery, [productId, limit]);

      // If not enough co-purchased products, supplement with similar category products
      let products = results.rows || [];
      
      if (products.length < limit) {
        const currentProduct = await select('products', { id: productId });
        if (currentProduct.length > 0) {
          const category = currentProduct[0].category;
          const existingIds = products.map((p: any) => p.id);
          existingIds.push(productId);

          const supplementQuery = `
            SELECT 
              p.id,
              p.name,
              p.description,
              p.price,
              p.compare_at_price,
              p.images,
              p.metadata,
              p.rating,
              p.review_count,
              p.category,
              p.category_id,
              p.vendor_id,
              p.stock,
              0 as purchase_count,
              v.business_name as vendor_name
            FROM products p
            LEFT JOIN vendors v ON p.vendor_id = v.id
            WHERE p.is_active = true 
              AND p.stock > 0
              AND p.category = $1
              AND p.id NOT IN (${existingIds.map((_, i) => `$${i + 2}`).join(',')})
            ORDER BY p.sales_count DESC, p.rating DESC
            LIMIT $${existingIds.length + 2}
          `;

          const supplement = await query(supplementQuery, [category, ...existingIds, limit - products.length]);
          products = [...products, ...(supplement.rows || [])];
        }
      }

      return c.json({
        success: true,
        products: await formatRecommendationProducts(products as Record<string, unknown>[], (p) => ({
          purchaseCount: parseInt(String(p.purchase_count), 10) || 0,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching also-bought products:', error);
      return c.json({ success: false, error: error.message, products: [] }, 500);
    }
  });

  // ============================================================================
  // CART-BASED CATEGORY RECOMMENDATIONS
  // ============================================================================

  app.post('/ecommerce/cart/recommendations', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const items = Array.isArray(body.items) ? body.items : [];
      const limit = Math.min(Math.max(parseInt(String(body.limit ?? '5'), 10) || 5, 1), 10);

      const excludeIds = new Set(
        items.map((i: { productId?: string }) => String(i.productId || '')).filter(Boolean)
      );

      const categorySpend = new Map<string, number>();
      for (const item of items) {
        const cat = item.categoryId ? String(item.categoryId) : '';
        if (!cat) continue;
        const spend = (Number(item.price) || 0) * (Number(item.quantity) || 1);
        categorySpend.set(cat, (categorySpend.get(cat) || 0) + spend);
      }

      const sortedCategories = [...categorySpend.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([cat]) => cat);

      if (sortedCategories.length === 0) {
        return c.json({ success: true, products: [] });
      }

      const results: Record<string, unknown>[] = [];

      const pickFromCategory = async (categoryId: string) => {
        const exclude = [...excludeIds];
        const params: unknown[] = [categoryId];
        let excludeClause = '';
        if (exclude.length > 0) {
          excludeClause = ` AND p.id NOT IN (${exclude.map((_, i) => `$${i + 2}`).join(',')})`;
          params.push(...exclude);
        }
        params.push(1);
        const limitParam = `$${params.length}`;
        const sql = `
          SELECT
            p.id,
            p.name,
            p.description,
            p.price,
            p.compare_at_price,
            p.images,
            p.metadata,
            p.rating,
            p.review_count,
            p.category,
            p.category_id,
            p.vendor_id,
            p.stock,
            v.business_name as vendor_name
          FROM products p
          LEFT JOIN vendors v ON p.vendor_id = v.id
          WHERE p.is_active = true
            AND p.stock > 0
            AND (p.category_id::text = $1 OR p.category = $1)
            ${excludeClause}
          ORDER BY COALESCE(p.sales_count, 0) DESC, COALESCE(p.rating, 0) DESC NULLS LAST
          LIMIT ${limitParam}
        `;
        const res = await query(sql, params);
        return (res.rows?.[0] as Record<string, unknown>) || null;
      };

      for (const cat of sortedCategories) {
        if (results.length >= limit) break;
        const row = await pickFromCategory(cat);
        if (row?.id) {
          results.push(row);
          excludeIds.add(String(row.id));
        }
      }

      for (const cat of sortedCategories) {
        while (results.length < limit) {
          const row = await pickFromCategory(cat);
          if (!row?.id) break;
          results.push(row);
          excludeIds.add(String(row.id));
        }
        if (results.length >= limit) break;
      }

      return c.json({
        success: true,
        products: await formatRecommendationProducts(results),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Recommendation failed';
      console.error('Error fetching cart recommendations:', error);
      return c.json({ success: false, error: message, products: [] }, 500);
    }
  });

  // ============================================================================
  // FREQUENTLY BOUGHT TOGETHER
  // ============================================================================

  app.get('/products/:productId/bought-together', async (c) => {
    try {
      const productId = c.req.param('productId');
      const limit = parseInt(c.req.query('limit') || '3');

      // Find products frequently purchased together in the same order
      const boughtTogetherQuery = `
        WITH this_product_orders AS (
          SELECT order_id FROM order_items WHERE product_id = $1
        ),
        paired_products AS (
          SELECT 
            oi.product_id,
            COUNT(*) as pair_count,
            SUM(oi.quantity) as total_quantity
          FROM order_items oi
          WHERE oi.order_id IN (SELECT order_id FROM this_product_orders)
            AND oi.product_id != $1
          GROUP BY oi.product_id
          ORDER BY pair_count DESC, total_quantity DESC
          LIMIT $2
        )
        SELECT 
          p.id,
          p.name,
          p.price,
          p.compare_at_price,
          p.images,
          pp.pair_count
        FROM paired_products pp
        JOIN products p ON pp.product_id = p.id
        WHERE p.is_active = true AND p.stock > 0
      `;

      const results = await query(boughtTogetherQuery, [productId, limit]);

      // Get the main product too
      const mainProduct = await select('products', { id: productId });

      if (mainProduct.length === 0) {
        return c.json({ success: false, error: 'Product not found' }, 404);
      }

      const bundleProducts = [
        mainProduct[0],
        ...(results.rows || [])
      ];

      // Calculate bundle price (with discount suggestion)
      const totalPrice = bundleProducts.reduce((sum, p) => sum + parseFloat(p.price), 0);
      const bundleDiscount = bundleProducts.length >= 3 ? 0.10 : 0.05; // 10% for 3+, 5% for 2
      const bundlePrice = totalPrice * (1 - bundleDiscount);

      return c.json({
        success: true,
        bundle: {
          products: bundleProducts.map((p: any) => ({
            id: p.id,
            name: p.name,
            price: parseFloat(p.price),
            compareAtPrice: p.compare_at_price ? parseFloat(p.compare_at_price) : null,
            image: typeof p.images === 'string' 
              ? (JSON.parse(p.images || '[]')[0]) 
              : (p.images?.[0]),
          })),
          originalTotal: totalPrice,
          bundlePrice: Math.round(bundlePrice * 100) / 100,
          savings: Math.round((totalPrice - bundlePrice) * 100) / 100,
          discountPercent: Math.round(bundleDiscount * 100),
        },
      });
    } catch (error: any) {
      console.error('Error fetching bought-together products:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================================================
  // RECENTLY VIEWED PRODUCTS
  // ============================================================================

  app.post('/customer/:customerId/viewed/:productId', async (c) => {
    try {
      const { customerId, productId } = c.req.param();

      // Insert or update view record
      const existingView = await query(
        `SELECT id FROM product_views WHERE customer_id = $1 AND product_id = $2`,
        [customerId, productId]
      );

      if (existingView.rows.length > 0) {
        await update('product_views', { id: existingView.rows[0].id }, {
          view_count: query(`view_count + 1`),
          last_viewed_at: new Date().toISOString(),
        });
      } else {
        await insert('product_views', {
          customer_id: customerId,
          product_id: productId,
          view_count: 1,
          last_viewed_at: new Date().toISOString(),
        });
      }

      // Also update product's overall view count
      await query(
        `UPDATE products SET view_count = COALESCE(view_count, 0) + 1 WHERE id = $1`,
        [productId]
      );

      return c.json({ success: true });
    } catch (error: any) {
      console.error('Error tracking product view:', error);
      return c.json({ success: true }); // Don't fail on tracking
    }
  });

  app.get('/customer/:customerId/recently-viewed', async (c) => {
    try {
      const customerId = c.req.param('customerId');
      const limit = parseInt(c.req.query('limit') || '10');

      const recentlyViewedQuery = `
        SELECT 
          p.id,
          p.name,
          p.price,
          p.compare_at_price,
          p.images,
          p.rating,
          pv.last_viewed_at
        FROM product_views pv
        JOIN products p ON pv.product_id = p.id
        WHERE pv.customer_id = $1
          AND p.is_active = true
        ORDER BY pv.last_viewed_at DESC
        LIMIT $2
      `;

      const results = await query(recentlyViewedQuery, [customerId, limit]);

      return c.json({
        success: true,
        products: (results.rows || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          price: parseFloat(p.price),
          compareAtPrice: p.compare_at_price ? parseFloat(p.compare_at_price) : null,
          image: typeof p.images === 'string' 
            ? (JSON.parse(p.images || '[]')[0]) 
            : (p.images?.[0]),
          rating: parseFloat(p.rating) || 0,
          viewedAt: p.last_viewed_at,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching recently viewed:', error);
      return c.json({ success: false, error: error.message, products: [] }, 500);
    }
  });

  // ============================================================================
  // TRENDING PRODUCTS
  // ============================================================================

  app.get('/products/trending', async (c) => {
    try {
      const category = c.req.query('category');
      const limit = parseInt(c.req.query('limit') || '12');
      const period = c.req.query('period') || 'week'; // day, week, month

      let periodInterval = "INTERVAL '7 days'";
      if (period === 'day') periodInterval = "INTERVAL '1 day'";
      if (period === 'month') periodInterval = "INTERVAL '30 days'";

      let whereClause = `WHERE p.is_active = true AND p.stock > 0`;
      const params: any[] = [];
      let paramIdx = 1;

      if (category) {
        whereClause += ` AND p.category = $${paramIdx++}`;
        params.push(category);
      }

      params.push(limit);

      const trendingQuery = `
        WITH recent_sales AS (
          SELECT 
            oi.product_id,
            SUM(oi.quantity) as units_sold,
            COUNT(DISTINCT oi.order_id) as order_count
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          WHERE o.created_at > NOW() - ${periodInterval}
            AND o.order_status NOT IN ('cancelled', 'returned')
          GROUP BY oi.product_id
        ),
        recent_views AS (
          SELECT 
            product_id,
            SUM(view_count) as total_views
          FROM product_views
          WHERE last_viewed_at > NOW() - ${periodInterval}
          GROUP BY product_id
        )
        SELECT 
          p.id,
          p.name,
          p.description,
          p.price,
          p.compare_at_price,
          p.images,
          p.metadata,
          p.rating,
          p.review_count,
          p.category,
          p.category_id,
          p.vendor_id,
          p.stock,
          v.business_name as vendor_name,
          COALESCE(rs.units_sold, 0) as units_sold,
          COALESCE(rv.total_views, 0) as views,
          -- Trending score: sales weight 70%, views 30%
          (COALESCE(rs.units_sold, 0) * 0.7 + COALESCE(rv.total_views, 0) * 0.01 * 0.3) as trending_score
        FROM products p
        LEFT JOIN vendors v ON p.vendor_id = v.id
        LEFT JOIN recent_sales rs ON p.id = rs.product_id
        LEFT JOIN recent_views rv ON p.id = rv.product_id
        ${whereClause}
        ORDER BY trending_score DESC, p.sales_count DESC
        LIMIT $${paramIdx}
      `;

      const results = await query(trendingQuery, params);

      const rows = (results.rows || []) as Record<string, unknown>[];
      const products = await formatRecommendationProducts(rows, (p) => ({
        unitsSold: parseInt(String(p.units_sold), 10) || 0,
        isTrending: true,
      }));

      return c.json({
        success: true,
        period,
        products,
      });
    } catch (error: any) {
      console.error('Error fetching trending products:', error);
      return c.json({ success: false, error: error.message, products: [] }, 500);
    }
  });

  // ============================================================================
  // PERSONALIZED RECOMMENDATIONS
  // ============================================================================

  app.get('/customer/:customerId/recommendations', async (c) => {
    try {
      const customerId = c.req.param('customerId');
      const limit = parseInt(c.req.query('limit') || '12');

      // Get customer's purchase history categories
      const purchaseHistoryQuery = `
        SELECT DISTINCT p.category
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN products p ON oi.product_id = p.id
        WHERE o.customer_id = $1
          AND o.order_status NOT IN ('cancelled', 'returned')
        ORDER BY p.category
      `;
      const purchaseHistory = await query(purchaseHistoryQuery, [customerId]);
      const purchasedCategories = purchaseHistory.rows.map((r: any) => r.category).filter(Boolean);

      // Get products customer has purchased
      const purchasedProductsQuery = `
        SELECT DISTINCT oi.product_id
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.customer_id = $1
      `;
      const purchasedProducts = await query(purchasedProductsQuery, [customerId]);
      const purchasedIds = purchasedProducts.rows.map((r: any) => r.product_id);

      // Get recently viewed products (for exclusion)
      const viewedQuery = `
        SELECT product_id FROM product_views 
        WHERE customer_id = $1 
        ORDER BY last_viewed_at DESC 
        LIMIT 20
      `;
      const viewedProducts = await query(viewedQuery, [customerId]);
      const viewedIds = viewedProducts.rows.map((r: any) => r.product_id);

      // Combine exclusions
      const excludeIds = [...new Set([...purchasedIds, ...viewedIds])];
      const excludeClause = excludeIds.length > 0 
        ? `AND p.id NOT IN (${excludeIds.map((_, i) => `$${i + 2}`).join(',')})` 
        : '';

      // Build recommendation query
      let recommendationsQuery: string;
      let params: any[] = [limit, ...excludeIds];

      if (purchasedCategories.length > 0) {
        // Recommend from similar categories
        const categoryPlaceholders = purchasedCategories.map((_, i) => `$${excludeIds.length + i + 2}`).join(',');
        recommendationsQuery = `
          SELECT 
            p.id,
            p.name,
            p.description,
            p.price,
            p.compare_at_price,
            p.images,
            p.metadata,
            p.rating,
            p.review_count,
            p.category,
            p.category_id,
            p.vendor_id,
            p.stock,
            v.business_name as vendor_name,
            CASE WHEN p.category IN (${categoryPlaceholders}) THEN 1 ELSE 0 END as category_match
          FROM products p
          LEFT JOIN vendors v ON p.vendor_id = v.id
          WHERE p.is_active = true 
            AND p.stock > 0
            ${excludeClause}
          ORDER BY category_match DESC, p.rating DESC, p.sales_count DESC
          LIMIT $1
        `;
        params = [limit, ...excludeIds, ...purchasedCategories];
      } else {
        // New customer - recommend popular products
        recommendationsQuery = `
          SELECT 
            p.id,
            p.name,
            p.description,
            p.price,
            p.compare_at_price,
            p.images,
            p.metadata,
            p.rating,
            p.review_count,
            p.category,
            p.category_id,
            p.vendor_id,
            p.stock,
            v.business_name as vendor_name,
            0 as category_match
          FROM products p
          LEFT JOIN vendors v ON p.vendor_id = v.id
          WHERE p.is_active = true 
            AND p.stock > 0
            ${excludeClause}
          ORDER BY p.rating DESC, p.sales_count DESC
          LIMIT $1
        `;
      }

      const results = await query(recommendationsQuery, params);
      const rows = (results.rows || []) as Record<string, unknown>[];
      const products = await formatRecommendationProducts(rows, () => ({
        isPersonalized: purchasedCategories.length > 0,
      }));

      return c.json({
        success: true,
        products,
        basedOn: purchasedCategories.length > 0 
          ? `Your interest in ${purchasedCategories.slice(0, 3).join(', ')}`
          : 'Popular products',
      });
    } catch (error: any) {
      console.error('Error fetching recommendations:', error);
      return c.json({ success: false, error: error.message, products: [] }, 500);
    }
  });

  // ============================================================================
  // NEW ARRIVALS
  // ============================================================================

  app.get('/products/new-arrivals', async (c) => {
    try {
      const category = c.req.query('category');
      const limit = parseInt(c.req.query('limit') || '12');
      const days = parseInt(c.req.query('days') || '30');

      let whereClause = `WHERE p.is_active = true AND p.stock > 0 AND p.created_at > NOW() - INTERVAL '${days} days'`;
      const params: any[] = [];
      let paramIdx = 1;

      if (category) {
        whereClause += ` AND p.category = $${paramIdx++}`;
        params.push(category);
      }

      params.push(limit);

      const newArrivalsQuery = `
        SELECT 
          p.id,
          p.name,
          p.description,
          p.price,
          p.compare_at_price,
          p.images,
          p.metadata,
          p.rating,
          p.review_count,
          p.category,
          p.category_id,
          p.vendor_id,
          p.stock,
          p.created_at,
          v.business_name as vendor_name
        FROM products p
        LEFT JOIN vendors v ON p.vendor_id = v.id
        ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT $${paramIdx}
      `;

      const results = await query(newArrivalsQuery, params);
      const rows = (results.rows || []) as Record<string, unknown>[];
      const products = await formatRecommendationProducts(rows, (p) => ({
        createdAt: p.created_at,
        isNew: true,
      }));

      return c.json({
        success: true,
        products,
      });
    } catch (error: any) {
      console.error('Error fetching new arrivals:', error);
      return c.json({ success: false, error: error.message, products: [] }, 500);
    }
  });
}
