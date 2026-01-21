/**
 * ============================================================================
 * WISHLIST ENDPOINTS
 * ============================================================================
 * 
 * Endpoints:
 * - GET /customer/:customerId/wishlist - Get customer wishlist
 * - POST /customer/:customerId/wishlist - Add/Remove from wishlist
 * - DELETE /customer/:customerId/wishlist/:productId - Remove from wishlist
 * - POST /customer/:customerId/wishlist/move-to-cart - Move items to cart
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, select, insert } from '../database/rds-connection';

// ============================================================================
// ENDPOINTS
// ============================================================================

export function registerWishlistEndpoints(app: Hono) {
  // Get customer wishlist
  app.get('/customer/:customerId/wishlist', async (c) => {
    try {
      const customerId = c.req.param('customerId');

      // Get wishlist items with product details
      const wishlistResult = await query(`
        SELECT 
          w.id,
          w.product_id,
          w.created_at,
          p.name,
          p.description,
          p.price,
          p.original_price,
          p.images,
          p.emoji,
          p.rating,
          p.review_count,
          p.stock_quantity as stock,
          p.vendor_id,
          v.business_name as vendor_name,
          p.is_active
        FROM customer_wishlist w
        JOIN products p ON w.product_id = p.id
        LEFT JOIN vendors v ON p.vendor_id = v.id
        WHERE w.customer_id = $1
        ORDER BY w.created_at DESC
      `, [customerId]);

      const items = Array.isArray(wishlistResult) 
        ? wishlistResult 
        : (wishlistResult as any).rows || [];

      // Calculate savings
      const totalSavings = items.reduce((sum: number, item: any) => {
        if (item.original_price && item.original_price > item.price) {
          return sum + (item.original_price - item.price);
        }
        return sum;
      }, 0);

      return c.json({
        success: true,
        wishlist: {
          items: items.map((item: any) => ({
            id: item.id,
            product_id: item.product_id,
            product: {
              id: item.product_id,
              name: item.name,
              description: item.description,
              price: parseFloat(item.price) || 0,
              original_price: item.original_price ? parseFloat(item.original_price) : null,
              images: item.images || [],
              emoji: item.emoji || '🐾',
              rating: item.rating || 4.5,
              review_count: item.review_count || 0,
              stock: item.stock || 0,
              vendor_id: item.vendor_id,
              vendor_name: item.vendor_name || 'Unknown Seller',
              is_active: item.is_active,
            },
            added_at: item.created_at,
          })),
          total_items: items.length,
          total_savings: totalSavings,
        },
      });
    } catch (error: any) {
      console.error('Error fetching wishlist:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // Add/Remove from wishlist (toggle)
  app.post('/customer/:customerId/wishlist', async (c) => {
    try {
      const customerId = c.req.param('customerId');
      const body = await c.req.json();
      const { productId, action } = body;

      if (!productId) {
        return c.json({ success: false, error: 'Product ID is required' }, 400);
      }

      // Check if item exists in wishlist
      const existingResult = await query(`
        SELECT id FROM customer_wishlist 
        WHERE customer_id = $1 AND product_id = $2
      `, [customerId, productId]);

      const existing = Array.isArray(existingResult) 
        ? existingResult 
        : (existingResult as any).rows || [];

      if (action === 'remove' || (existing.length > 0 && action !== 'add')) {
        // Remove from wishlist
        if (existing.length > 0) {
          await query(`
            DELETE FROM customer_wishlist 
            WHERE customer_id = $1 AND product_id = $2
          `, [customerId, productId]);
        }
        return c.json({ 
          success: true, 
          action: 'removed',
          message: 'Item removed from wishlist' 
        });
      } else {
        // Add to wishlist
        if (existing.length === 0) {
          await query(`
            INSERT INTO customer_wishlist (customer_id, product_id, created_at)
            VALUES ($1, $2, NOW())
          `, [customerId, productId]);
        }
        return c.json({ 
          success: true, 
          action: 'added',
          message: 'Item added to wishlist' 
        });
      }
    } catch (error: any) {
      console.error('Error updating wishlist:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // Remove specific item from wishlist
  app.delete('/customer/:customerId/wishlist/:productId', async (c) => {
    try {
      const customerId = c.req.param('customerId');
      const productId = c.req.param('productId');

      await query(`
        DELETE FROM customer_wishlist 
        WHERE customer_id = $1 AND product_id = $2
      `, [customerId, productId]);

      return c.json({ 
        success: true, 
        message: 'Item removed from wishlist' 
      });
    } catch (error: any) {
      console.error('Error removing from wishlist:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // Move wishlist items to cart
  app.post('/customer/:customerId/wishlist/move-to-cart', async (c) => {
    try {
      const customerId = c.req.param('customerId');
      const body = await c.req.json();
      const { productIds } = body;

      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return c.json({ success: false, error: 'Product IDs are required' }, 400);
      }

      // Get products from wishlist
      const productsResult = await query(`
        SELECT p.id, p.name, p.price, p.stock_quantity as stock, p.vendor_id
        FROM products p
        JOIN customer_wishlist w ON p.id = w.product_id
        WHERE w.customer_id = $1 AND p.id = ANY($2::uuid[])
      `, [customerId, productIds]);

      const products = Array.isArray(productsResult) 
        ? productsResult 
        : (productsResult as any).rows || [];

      // Add to cart (upsert)
      for (const product of products) {
        if (product.stock > 0) {
          await query(`
            INSERT INTO cart_items (customer_id, product_id, quantity, created_at, updated_at)
            VALUES ($1, $2, 1, NOW(), NOW())
            ON CONFLICT (customer_id, product_id) 
            DO UPDATE SET quantity = cart_items.quantity + 1, updated_at = NOW()
          `, [customerId, product.id]);
        }
      }

      // Remove from wishlist
      await query(`
        DELETE FROM customer_wishlist 
        WHERE customer_id = $1 AND product_id = ANY($2::uuid[])
      `, [customerId, productIds]);

      return c.json({ 
        success: true, 
        message: `${products.length} items moved to cart`,
        moved_count: products.length,
      });
    } catch (error: any) {
      console.error('Error moving to cart:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // Get wishlist count
  app.get('/customer/:customerId/wishlist/count', async (c) => {
    try {
      const customerId = c.req.param('customerId');

      const result = await query(`
        SELECT COUNT(*) as count 
        FROM customer_wishlist 
        WHERE customer_id = $1
      `, [customerId]);

      const rows = Array.isArray(result) ? result : (result as any).rows || [];
      const count = rows.length > 0 ? parseInt(rows[0].count) : 0;

      return c.json({ success: true, count });
    } catch (error: any) {
      console.error('Error getting wishlist count:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });
}
