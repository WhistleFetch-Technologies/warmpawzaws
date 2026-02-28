/**
 * ============================================================================
 * PRODUCT VARIATIONS ENDPOINTS
 * ============================================================================
 * 
 * Endpoints:
 * - GET /vendor/:vendorId/products/:productId/variations - Get product variations
 * - POST /vendor/:vendorId/products/:productId/variations - Save product variations
 * - DELETE /vendor/:vendorId/products/:productId/variations/:variationId - Delete variation
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, select, insert } from '../database/rds-connection';

export function registerProductVariationsEndpoints(app: Hono) {
  // Get product variations
  app.get('/vendor/:vendorId/products/:productId/variations', async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const productId = c.req.param('productId');

      // Verify product belongs to vendor
      const products = await select('products', { id: productId, vendor_id: vendorId });
      if (products.length === 0) {
        return c.json({ success: false, error: 'Product not found' }, 404);
      }

      // Get variations with options
      const variationsResult = await query(`
        SELECT 
          v.id,
          v.name,
          v.type,
          v.is_required,
          v.sort_order,
          COALESCE(
            json_agg(
              json_build_object(
                'id', o.id,
                'value', o.value,
                'price_modifier', o.price_modifier,
                'stock_quantity', o.stock_quantity,
                'sku', o.sku,
                'image_url', o.image_url,
                'is_active', o.is_active
              ) ORDER BY o.sort_order
            ) FILTER (WHERE o.id IS NOT NULL),
            '[]'
          ) as options
        FROM product_variations v
        LEFT JOIN product_variation_options o ON v.id = o.variation_id
        WHERE v.product_id = $1
        GROUP BY v.id
        ORDER BY v.sort_order
      `, [productId]);

      const variations = Array.isArray(variationsResult) 
        ? variationsResult 
        : (variationsResult as any).rows || [];

      return c.json({
        success: true,
        variations: variations.map((v: any) => ({
          id: v.id,
          name: v.name,
          type: v.type,
          is_required: v.is_required,
          options: v.options || [],
        })),
      });
    } catch (error: any) {
      console.error('Error fetching variations:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // Save product variations (replaces all existing)
  app.post('/vendor/:vendorId/products/:productId/variations', async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const productId = c.req.param('productId');
      const body = await c.req.json();
      const { variations } = body;

      // Verify product belongs to vendor
      const products = await select('products', { id: productId, vendor_id: vendorId });
      if (products.length === 0) {
        return c.json({ success: false, error: 'Product not found' }, 404);
      }

      // Delete existing variations (cascade will delete options)
      await query('DELETE FROM product_variations WHERE product_id = $1', [productId]);

      // Insert new variations
      if (variations && variations.length > 0) {
        for (let i = 0; i < variations.length; i++) {
          const variation = variations[i];
          
          // Insert variation
          const varResult = await query(`
            INSERT INTO product_variations (product_id, name, type, is_required, sort_order)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
          `, [productId, variation.name, variation.type, variation.is_required || false, i]);

          const varRows = Array.isArray(varResult) ? varResult : (varResult as any).rows || [];
          const variationId = varRows[0]?.id;

          // Insert options
          if (variationId && variation.options && variation.options.length > 0) {
            for (let j = 0; j < variation.options.length; j++) {
              const option = variation.options[j];
              await query(`
                INSERT INTO product_variation_options 
                (variation_id, value, price_modifier, stock_quantity, sku, image_url, is_active, sort_order)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              `, [
                variationId,
                option.value,
                option.price_modifier || 0,
                option.stock_quantity || 0,
                option.sku || null,
                option.image_url || null,
                option.is_active !== false,
                j,
              ]);
            }
          }
        }

        // Update product has_variations flag
        await query('UPDATE products SET has_variations = true, updated_at = NOW() WHERE id = $1', [productId]);
      } else {
        // No variations - update flag
        await query('UPDATE products SET has_variations = false, updated_at = NOW() WHERE id = $1', [productId]);
      }

      return c.json({ 
        success: true, 
        message: 'Variations saved successfully',
        count: variations?.length || 0,
      });
    } catch (error: any) {
      console.error('Error saving variations:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // Delete a specific variation
  app.delete('/vendor/:vendorId/products/:productId/variations/:variationId', async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const productId = c.req.param('productId');
      const variationId = c.req.param('variationId');

      // Verify product belongs to vendor
      const products = await select('products', { id: productId, vendor_id: vendorId });
      if (products.length === 0) {
        return c.json({ success: false, error: 'Product not found' }, 404);
      }

      // Delete variation (cascade will delete options)
      await query('DELETE FROM product_variations WHERE id = $1 AND product_id = $2', [variationId, productId]);

      // Check if any variations remain
      const remaining = await query('SELECT COUNT(*) as count FROM product_variations WHERE product_id = $1', [productId]);
      const remainingRows = Array.isArray(remaining) ? remaining : (remaining as any).rows || [];
      const count = parseInt(remainingRows[0]?.count) || 0;

      if (count === 0) {
        await query('UPDATE products SET has_variations = false, updated_at = NOW() WHERE id = $1', [productId]);
      }

      return c.json({ success: true, message: 'Variation deleted' });
    } catch (error: any) {
      console.error('Error deleting variation:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // Get public product variations (for customer view)
  app.get('/products/:productId/variations', async (c) => {
    try {
      const productId = c.req.param('productId');

      const variationsResult = await query(`
        SELECT 
          v.id,
          v.name,
          v.type,
          v.is_required,
          COALESCE(
            json_agg(
              json_build_object(
                'value', o.value,
                'price_modifier', o.price_modifier,
                'stock', o.stock_quantity,
                'image', o.image_url
              ) ORDER BY o.sort_order
            ) FILTER (WHERE o.id IS NOT NULL AND o.is_active = true),
            '[]'
          ) as options
        FROM product_variations v
        LEFT JOIN product_variation_options o ON v.id = o.variation_id
        WHERE v.product_id = $1
        GROUP BY v.id
        ORDER BY v.sort_order
      `, [productId]);

      const variations = Array.isArray(variationsResult) 
        ? variationsResult 
        : (variationsResult as any).rows || [];

      return c.json({ success: true, variations });
    } catch (error: any) {
      console.error('Error fetching public variations:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // Record product view
  app.post('/products/:productId/view', async (c) => {
    try {
      const productId = c.req.param('productId');
      const body = await c.req.json().catch(() => ({}));
      const { customerId, sessionId, source } = body;

      await query(`
        INSERT INTO product_views (product_id, customer_id, session_id, source, viewed_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [productId, customerId || null, sessionId || null, source || 'direct']);

      // Update view count on product
      await query(`
        UPDATE products 
        SET view_count = COALESCE(view_count, 0) + 1 
        WHERE id = $1
      `, [productId]);

      return c.json({ success: true });
    } catch (error: any) {
      // Silently fail - not critical
      console.error('Error recording view:', error);
      return c.json({ success: true });
    }
  });
}
