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
          p.rating,
          p.review_count,
          p.category,
          cp.purchase_count,
          v.business_name as vendor_name
        FROM co_purchased cp
        JOIN products p ON cp.product_id = p.id
        LEFT JOIN vendors v ON p.vendor_id = v.id
        WHERE p.is_active = true AND p.stock_quantity > 0
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
              p.rating,
              p.review_count,
              p.category,
              0 as purchase_count,
              v.business_name as vendor_name
            FROM products p
            LEFT JOIN vendors v ON p.vendor_id = v.id
            WHERE p.is_active = true 
              AND p.stock_quantity > 0
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
        products: products.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: parseFloat(p.price),
          compareAtPrice: p.compare_at_price ? parseFloat(p.compare_at_price) : null,
          images: typeof p.images === 'string' ? JSON.parse(p.images || '[]') : (p.images || []),
          rating: parseFloat(p.rating) || 0,
          reviewCount: parseInt(p.review_count) || 0,
          category: p.category,
          vendorName: p.vendor_name,
          purchaseCount: parseInt(p.purchase_count) || 0,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching also-bought products:', error);
      return c.json({ success: false, error: error.message, products: [] }, 500);
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
        WHERE p.is_active = true AND p.stock_quantity > 0
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

      let whereClause = `WHERE p.is_active = true AND p.stock_quantity > 0`;
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
          p.rating,
          p.review_count,
          p.category,
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

      return c.json({
        success: true,
        period,
        products: (results.rows || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: parseFloat(p.price),
          compareAtPrice: p.compare_at_price ? parseFloat(p.compare_at_price) : null,
          images: typeof p.images === 'string' ? JSON.parse(p.images || '[]') : (p.images || []),
          rating: parseFloat(p.rating) || 0,
          reviewCount: parseInt(p.review_count) || 0,
          category: p.category,
          vendorName: p.vendor_name,
          unitsSold: parseInt(p.units_sold) || 0,
          isTrending: true,
        })),
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
            p.rating,
            p.review_count,
            p.category,
            v.business_name as vendor_name,
            CASE WHEN p.category IN (${categoryPlaceholders}) THEN 1 ELSE 0 END as category_match
          FROM products p
          LEFT JOIN vendors v ON p.vendor_id = v.id
          WHERE p.is_active = true 
            AND p.stock_quantity > 0
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
            p.rating,
            p.review_count,
            p.category,
            v.business_name as vendor_name,
            0 as category_match
          FROM products p
          LEFT JOIN vendors v ON p.vendor_id = v.id
          WHERE p.is_active = true 
            AND p.stock_quantity > 0
            ${excludeClause}
          ORDER BY p.rating DESC, p.sales_count DESC
          LIMIT $1
        `;
      }

      const results = await query(recommendationsQuery, params);

      return c.json({
        success: true,
        products: (results.rows || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: parseFloat(p.price),
          compareAtPrice: p.compare_at_price ? parseFloat(p.compare_at_price) : null,
          images: typeof p.images === 'string' ? JSON.parse(p.images || '[]') : (p.images || []),
          rating: parseFloat(p.rating) || 0,
          reviewCount: parseInt(p.review_count) || 0,
          category: p.category,
          vendorName: p.vendor_name,
          isPersonalized: purchasedCategories.length > 0,
        })),
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

      let whereClause = `WHERE p.is_active = true AND p.stock_quantity > 0 AND p.created_at > NOW() - INTERVAL '${days} days'`;
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
          p.rating,
          p.review_count,
          p.category,
          p.created_at,
          v.business_name as vendor_name
        FROM products p
        LEFT JOIN vendors v ON p.vendor_id = v.id
        ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT $${paramIdx}
      `;

      const results = await query(newArrivalsQuery, params);

      return c.json({
        success: true,
        products: (results.rows || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: parseFloat(p.price),
          compareAtPrice: p.compare_at_price ? parseFloat(p.compare_at_price) : null,
          images: typeof p.images === 'string' ? JSON.parse(p.images || '[]') : (p.images || []),
          rating: parseFloat(p.rating) || 0,
          reviewCount: parseInt(p.review_count) || 0,
          category: p.category,
          vendorName: p.vendor_name,
          createdAt: p.created_at,
          isNew: true,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching new arrivals:', error);
      return c.json({ success: false, error: error.message, products: [] }, 500);
    }
  });
}
