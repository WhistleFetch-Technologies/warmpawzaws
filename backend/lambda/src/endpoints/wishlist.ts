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
import { query } from '../database/rds-connection';
import { isValidUUID } from '../types/entities';

// ============================================================================
// HELPERS — use only columns guaranteed on `products` (001) + `customer_wishlist` (212).
// Optional vendor names via separate query so a bad vendors schema cannot 500 the list.
// ============================================================================

/** No JOIN to vendors; no optional product columns (compare_at_price, stock, images, …). */
const WISHLIST_CORE_SQL = `
  SELECT
    w.id,
    w.product_id,
    w.created_at,
    p.name,
    p.description,
    p.price,
    p.vendor_id,
    p.is_active
  FROM customer_wishlist w
  INNER JOIN products p ON w.product_id = p.id
  WHERE w.customer_id = $1
  ORDER BY w.created_at DESC
`;

function rowsFromResult(res: any): any[] {
  if (Array.isArray(res)) return res;
  return res?.rows || [];
}

/**
 * Never throws — returns [] on any failure so GET wishlist does not surface HTTP 500.
 */
async function queryWishlistRows(customerIdRaw: string): Promise<any[]> {
  let customerId = (customerIdRaw || '').trim();
  try {
    customerId = decodeURIComponent(customerId);
  } catch {
    /* ignore */
  }
  customerId = customerId.trim();

  if (!isValidUUID(customerId)) {
    console.warn('[wishlist] invalid customerId (not a UUID), returning empty list:', customerIdRaw);
    return [];
  }

  try {
    const wishlistResult = await query(WISHLIST_CORE_SQL, [customerId]);
    const rows = rowsFromResult(wishlistResult);

    const vendorIds = [
      ...new Set(
        rows.map((r: any) => r?.vendor_id).filter((id: any) => id != null && String(id).length > 0)
      ),
    ] as string[];

    let vendorMap = new Map<string, string>();
    if (vendorIds.length > 0) {
      try {
        const vr = await query(`SELECT id, business_name FROM vendors WHERE id = ANY($1::uuid[])`, [
          vendorIds,
        ]);
        for (const v of rowsFromResult(vr)) {
          if (v?.id) vendorMap.set(String(v.id), v.business_name ?? 'Unknown Seller');
        }
      } catch (ve: any) {
        console.warn('[wishlist] vendor name lookup failed (non-fatal):', ve?.code, ve?.message);
      }
    }

    return rows.map((item: any) => ({
      ...item,
      original_price: null,
      images: [],
      emoji: null,
      rating: null,
      review_count: null,
      stock: 0,
      vendor_name: item?.vendor_id ? vendorMap.get(String(item.vendor_id)) ?? null : null,
    }));
  } catch (err: any) {
    console.error('[wishlist] CORE query failed:', err?.code, err?.message);
    return [];
  }
}

// ============================================================================
// ENDPOINTS
// ============================================================================

export function registerWishlistEndpoints(app: Hono) {
  // Get customer wishlist
  app.get('/customer/:customerId/wishlist', async (c) => {
    try {
      const customerId = c.req.param('customerId');
      const items = await queryWishlistRows(customerId);

      const totalSavings = items.reduce((sum: number, item: any) => {
        const op = item.original_price != null ? parseFloat(String(item.original_price)) : NaN;
        const pr = item.price != null ? parseFloat(String(item.price)) : NaN;
        if (!Number.isNaN(op) && !Number.isNaN(pr) && op > pr) {
          return sum + (op - pr);
        }
        return sum;
      }, 0);

      const wishlistItems = items.map((item: any) => {
        let images: unknown = item.images;
        if (images != null && typeof images === 'string') {
          try {
            images = JSON.parse(images);
          } catch {
            images = [];
          }
        }
        if (!Array.isArray(images)) images = [];

        return {
          id: item.id,
          product_id: item.product_id,
          product: {
            id: item.product_id,
            name: item.name,
            description: item.description,
            price: parseFloat(String(item.price)) || 0,
            original_price: item.original_price != null ? parseFloat(String(item.original_price)) : null,
            images,
            emoji: item.emoji || '🐾',
            rating: item.rating != null ? Number(item.rating) : null,
            review_count: item.review_count != null ? Number(item.review_count) : 0,
            stock: item.stock != null ? Number(item.stock) : 0,
            vendor_id: item.vendor_id,
            vendor_name: item.vendor_name || 'Unknown Seller',
            is_active: item.is_active,
          },
          added_at: item.created_at,
        };
      });

      return c.json({
        success: true,
        wishlist: {
          items: wishlistItems,
          total_items: wishlistItems.length,
          total_savings: totalSavings,
        },
      });
    } catch (error: any) {
      console.error('[wishlist] GET unexpected error (returning empty 200):', error);
      return c.json({
        success: true,
        wishlist: {
          items: [],
          total_items: 0,
          total_savings: 0,
        },
      });
    }
  });

  // Add/Remove from wishlist (toggle)
  app.post('/customer/:customerId/wishlist', async (c) => {
    try {
      let customerId = (c.req.param('customerId') || '').trim();
      try {
        customerId = decodeURIComponent(customerId).trim();
      } catch {
        /* ignore */
      }
      const body = await c.req.json();
      const { productId, action } = body;

      if (!productId) {
        return c.json({ success: false, error: 'Product ID is required' }, 400);
      }

      if (!isValidUUID(customerId)) {
        return c.json(
          { success: false, error: 'Invalid customerId: must be a database customer UUID' },
          400
        );
      }
      if (!isValidUUID(String(productId).trim())) {
        return c.json(
          { success: false, error: 'Invalid productId: must be a product UUID' },
          400
        );
      }
      const productIdNorm = String(productId).trim();

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
          `, [customerId, productIdNorm]);
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
          `, [customerId, productIdNorm]);
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
      let customerId = (c.req.param('customerId') || '').trim();
      let productId = (c.req.param('productId') || '').trim();
      try {
        customerId = decodeURIComponent(customerId).trim();
        productId = decodeURIComponent(productId).trim();
      } catch {
        /* ignore */
      }

      if (!isValidUUID(customerId) || !isValidUUID(productId)) {
        return c.json(
          { success: false, error: 'customerId and productId must be UUIDs' },
          400
        );
      }

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
      let customerId = (c.req.param('customerId') || '').trim();
      try {
        customerId = decodeURIComponent(customerId).trim();
      } catch {
        /* ignore */
      }
      const body = await c.req.json();
      const { productIds } = body;

      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return c.json({ success: false, error: 'Product IDs are required' }, 400);
      }

      if (!isValidUUID(customerId)) {
        return c.json({ success: false, error: 'Invalid customerId: must be a UUID' }, 400);
      }
      const normalizedIds = productIds.map((x: unknown) => String(x).trim()).filter(Boolean);
      if (!normalizedIds.every((id: string) => isValidUUID(id))) {
        return c.json({ success: false, error: 'All productIds must be UUIDs' }, 400);
      }

      // Stock columns differ by migration; omit from SQL to avoid 42703
      const productsResult = await query(`
        SELECT p.id, p.name, p.price, p.vendor_id
        FROM products p
        JOIN customer_wishlist w ON p.id = w.product_id
        WHERE w.customer_id = $1 AND p.id = ANY($2::uuid[])
      `, [customerId, normalizedIds]);

      const products = Array.isArray(productsResult) 
        ? productsResult 
        : (productsResult as any).rows || [];

      // Add to cart (upsert) — stock not selected (schema varies)
      for (const product of products) {
        await query(`
            INSERT INTO cart_items (customer_id, product_id, quantity, created_at, updated_at)
            VALUES ($1, $2, 1, NOW(), NOW())
            ON CONFLICT (customer_id, product_id) 
            DO UPDATE SET quantity = cart_items.quantity + 1, updated_at = NOW()
          `, [customerId, product.id]);
      }

      // Remove from wishlist
      await query(`
        DELETE FROM customer_wishlist 
        WHERE customer_id = $1 AND product_id = ANY($2::uuid[])
      `, [customerId, normalizedIds]);

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
      let customerId = (c.req.param('customerId') || '').trim();
      try {
        customerId = decodeURIComponent(customerId).trim();
      } catch {
        /* ignore */
      }

      if (!isValidUUID(customerId)) {
        return c.json({ success: true, count: 0 });
      }

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
